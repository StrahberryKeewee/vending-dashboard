<?php

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../api/config/Database.php';
require_once __DIR__ . '/../api/config/AwsConfig.php';

use Aws\Sqs\SqsClient;
use Aws\Exception\AwsException;

$dotenv = __DIR__ . '/../.env';
if (file_exists($dotenv)) {
    foreach (file($dotenv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $_ENV[trim($k)] = trim($v);
    }
}

$maxMessages = 10;
$waitSeconds = 20;

try {
    $sqs = new SqsClient(AwsConfig::sqsClientArgs());
} catch (Throwable $e) {
    fwrite(STDERR, '[ERROR] Failed to create SQS client: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

$queueUrl = AwsConfig::queueUrl();
if ($queueUrl === '') {
    fwrite(STDERR, '[ERROR] SQS_QUEUE_URL is not configured.' . PHP_EOL);
    exit(1);
}

$pdo = Database::connect();

$insertSale = $pdo->prepare(
    'INSERT INTO sales (machine_id, product_id, vend_column, quantity, amount, sale_time, sqs_message_id)
     VALUES (:machine_id, :product_id, :vend_column, :quantity, :amount, :sale_time, :sqs_message_id)
     ON DUPLICATE KEY UPDATE ingested_at = ingested_at'
);

$decrInventory = $pdo->prepare(
    'UPDATE machine_inventory
     SET    current_qty = GREATEST(current_qty - :quantity, 0)
     WHERE  machine_id  = :machine_id
       AND  column_num  = :column_num'
);

$logInventory = $pdo->prepare(
    'INSERT INTO inventory_logs (machine_id, column_num, change_type, qty_before, qty_after, qty_change, note)
     SELECT :machine_id, :column_num, \'sale\',
            current_qty + :quantity,
            current_qty,
            -:quantity,
            \'Auto from sale\'
     FROM   machine_inventory
     WHERE  machine_id = :machine_id AND column_num = :column_num'
);

$lookupProduct = $pdo->prepare('SELECT id FROM products WHERE sku = :sku LIMIT 1');

$lookupColumn = $pdo->prepare(
    'SELECT product_id, product_name FROM machine_columns
     WHERE machine_id = :machine_id AND column_num = :column_num
     LIMIT 1'
);

$processed = 0;

try {
    $result = $sqs->receiveMessage([
        'QueueUrl'            => $queueUrl,
        'MaxNumberOfMessages' => $maxMessages,
        'WaitTimeSeconds'     => $waitSeconds,
        'AttributeNames'      => ['All'],
    ]);
} catch (AwsException $e) {
    fwrite(STDERR, '[ERROR] receiveMessage failed: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

$messages = $result->get('Messages') ?? [];

foreach ($messages as $message) {
    $receiptHandle = $message['ReceiptHandle'];
    $messageId     = $message['MessageId'];

    $payload = json_decode($message['Body'], true);

    if (!is_array($payload)) {
        echo "[WARN] Skipping non-JSON message {$messageId}" . PHP_EOL;
        deleteMessage($sqs, $queueUrl, $receiptHandle);
        continue;
    }

    if (isset($payload[0])) {
        $payload = $payload[0];
    }

    $machineId = trim($payload['EportID']      ?? $payload['machine_id'] ?? '');
    $quantity  = (int) ($payload['ProductCount'] ?? $payload['quantity']  ?? 1);
    $amount    = (float) ($payload['Amount']     ?? $payload['amount']    ?? 0.0);
    $timestamp = $payload['TransactionTime']     ?? $payload['timestamp'] ?? date('c');

    if ($machineId === '' || $amount <= 0) {
        echo "[WARN] Incomplete payload in message {$messageId}, skipping" . PHP_EOL;
        deleteMessage($sqs, $queueUrl, $receiptHandle);
        continue;
    }

    // Parse column number from "Vend Column" field e.g. "0004($7.50)" → "4"
    $productId = null;
    $vendCol   = trim($payload['Vend Column'] ?? $payload['product_sku'] ?? '');
    if ($vendCol !== '') {
        $colNum = ltrim(explode('(', $vendCol)[0], '0') ?: '0';
        $lookupColumn->execute([':machine_id' => $machineId, ':column_num' => $colNum]);
        $row         = $lookupColumn->fetch();
        $productId   = ($row && $row['product_id'])   ? (int)    $row['product_id']   : null;
        $productName = ($row && $row['product_name']) ? (string) $row['product_name'] : null;
    }

    $saleTime = (new DateTime($timestamp))->format('Y-m-d H:i:s');

    $insertSale->execute([
        ':machine_id'      => $machineId,
        ':product_id'      => $productId,
        ':vend_column'     => $colNum ?? null,
        ':quantity'        => $quantity,
        ':amount'          => $amount,
        ':sale_time'       => $saleTime,
        ':sqs_message_id'  => $messageId,
    ]);

    // Auto-decrement inventory if this machine+column has a tracked row
    if (($colNum ?? '') !== '' && $insertSale->rowCount() > 0) {
        $logInventory->execute([':machine_id' => $machineId, ':column_num' => $colNum, ':quantity' => $quantity]);
        $decrInventory->execute([':machine_id' => $machineId, ':column_num' => $colNum, ':quantity' => $quantity]);
    }

    // Publish sale event to MQTT if configured (e.g. for split-flap display)
    mqttPublishSale($machineId, $productName ?? 'Unknown', $amount, $colNum ?? null, $saleTime);

    deleteMessage($sqs, $queueUrl, $receiptHandle);
    $processed++;

    echo "[INFO] Ingested sale from {$machineId} — \${$amount} (msg: {$messageId})" . PHP_EOL;
}

echo "[INFO] Run complete. Processed {$processed} message(s)." . PHP_EOL;

function deleteMessage(SqsClient $sqs, string $queueUrl, string $receiptHandle): void {
    try {
        $sqs->deleteMessage(['QueueUrl' => $queueUrl, 'ReceiptHandle' => $receiptHandle]);
    } catch (AwsException $e) {
        fwrite(STDERR, '[WARN] deleteMessage failed: ' . $e->getMessage() . PHP_EOL);
    }
}

function mqttPublishSale(string $machineId, string $item, float $price, ?string $column, string $timestamp): void {
    $host = $_ENV['MQTT_HOST'] ?? '';
    if ($host === '') return; // MQTT not configured, skip silently

    try {
        $clientId = 'vending-consumer-' . substr(md5(uniqid()), 0, 8);
        $port     = (int) ($_ENV['MQTT_PORT'] ?? 8883);
        $useTls   = $port === 8883;

        $mqtt = new \PhpMqtt\Client\MqttClient($host, $port, $clientId);

        $settings = (new \PhpMqtt\Client\ConnectionSettings())
            ->setUsername($_ENV['MQTT_USER'] ?? '')
            ->setPassword($_ENV['MQTT_PASS'] ?? '')
            ->setUseTls($useTls)
            ->setConnectTimeout(5);

        $mqtt->connect($settings, true);
        $mqtt->publish(
            $_ENV['MQTT_TOPIC'] ?? 'vending/sale',
            json_encode([
                'machine_id' => $machineId,
                'item'       => $item,
                'price'      => $price,
                'column'     => $column,
                'timestamp'  => $timestamp,
            ]),
            0 // QoS 0 — fire and forget
        );
        $mqtt->disconnect();
    } catch (\Throwable $e) {
        fwrite(STDERR, '[WARN] MQTT publish failed: ' . $e->getMessage() . PHP_EOL);
    }
}
