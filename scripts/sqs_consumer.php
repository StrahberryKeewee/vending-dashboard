<?php

/**
 * SQS Consumer — run as a cron job or daemon on the EC2 instance.
 *
 * Cron example (every 5 minutes):
 *   /5 * * * * /usr/bin/php /var/www/html/scripts/sqs_consumer.php >> /var/log/vending_sqs.log 2>&1
 *
 * Expected SQS message body (JSON):
 * {
 *   "machine_id": "VM001",
 *   "product_sku": "BEV-001",
 *   "quantity": 1,
 *   "amount": 1.75,
 *   "timestamp": "2026-04-17T10:30:00Z"
 * }
 */

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
    'INSERT INTO sales (machine_id, product_id, quantity, amount, sale_time, sqs_message_id)
     VALUES (:machine_id, :product_id, :quantity, :amount, :sale_time, :sqs_message_id)
     ON DUPLICATE KEY UPDATE ingested_at = ingested_at'
);

$lookupProduct = $pdo->prepare('SELECT id FROM products WHERE sku = :sku LIMIT 1');

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

    $machineId  = trim($payload['machine_id']  ?? '');
    $productSku = trim($payload['product_sku'] ?? '');
    $quantity   = (int) ($payload['quantity']  ?? 1);
    $amount     = (float) ($payload['amount']  ?? 0.0);
    $timestamp  = $payload['timestamp']        ?? date('c');

    if ($machineId === '' || $amount <= 0) {
        echo "[WARN] Incomplete payload in message {$messageId}, skipping" . PHP_EOL;
        deleteMessage($sqs, $queueUrl, $receiptHandle);
        continue;
    }

    $productId = null;
    if ($productSku !== '') {
        $lookupProduct->execute([':sku' => $productSku]);
        $productId = $lookupProduct->fetchColumn() ?: null;
    }

    $saleTime = (new DateTime($timestamp))->format('Y-m-d H:i:s');

    $insertSale->execute([
        ':machine_id'      => $machineId,
        ':product_id'      => $productId,
        ':quantity'        => $quantity,
        ':amount'          => $amount,
        ':sale_time'       => $saleTime,
        ':sqs_message_id'  => $messageId,
    ]);

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
