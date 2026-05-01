<?php

require_once __DIR__ . '/../api/config/Database.php';

$dotenv = __DIR__ . '/../.env';
if (file_exists($dotenv)) {
    foreach (file($dotenv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $_ENV[trim($k)] = trim($v);
    }
}

$file = $argv[1] ?? null;
if (!$file || !file_exists($file)) {
    fwrite(STDERR, 'Usage: php import_transactions.php <path-to-json-file>' . PHP_EOL);
    exit(1);
}

$raw  = file_get_contents($file);
$rows = json_decode($raw, true);

if (!is_array($rows)) {
    fwrite(STDERR, 'Invalid JSON.' . PHP_EOL);
    exit(1);
}

if (isset($rows['EportID'])) {
    $rows = [$rows];
}

$pdo = Database::connect();

$lookupColumn = $pdo->prepare(
    'SELECT product_id FROM machine_columns
     WHERE machine_id = :machine_id AND column_num = :column_num
     LIMIT 1'
);

$insert = $pdo->prepare(
    'INSERT INTO sales (machine_id, product_id, vend_column, quantity, amount, sale_time, sqs_message_id)
     VALUES (:machine_id, :product_id, :vend_column, :quantity, :amount, :sale_time, :msg_id)
     ON DUPLICATE KEY UPDATE
       product_id   = IF(product_id IS NULL AND VALUES(product_id) IS NOT NULL, VALUES(product_id), product_id),
       vend_column  = IF(vend_column IS NULL, VALUES(vend_column), vend_column)'
);

$imported = 0;
$skipped  = 0;
$updated  = 0;

foreach ($rows as $row) {
    $machineId = trim($row['EportID']  ?? '');
    $txId      = trim($row['TransactionID'] ?? '');
    $txType    = trim($row['TransactionType'] ?? '');
    $amount    = (float) ($row['Amount'] ?? 0);
    $quantity  = (int) ($row['ProductCount'] ?? 1);
    $timestamp = $row['TransactionTime'] ?? null;
    $vendRaw   = trim($row['Vend Column'] ?? '');

    if ($machineId === '' || $amount <= 0 || $timestamp === null) {
        $skipped++;
        continue;
    }

    if (in_array($txType, ['F', 'T'], true)) {
        $skipped++;
        continue;
    }

    $colNum    = $vendRaw !== '' ? (ltrim(explode('(', $vendRaw)[0], '0') ?: '0') : null;
    $productId = null;

    if ($colNum !== null) {
        $lookupColumn->execute([':machine_id' => $machineId, ':column_num' => $colNum]);
        $result    = $lookupColumn->fetch();
        $productId = ($result && $result['product_id']) ? (int) $result['product_id'] : null;
    }

    try {
        $saleTime = (new DateTime($timestamp))->format('Y-m-d H:i:s');
    } catch (Exception) {
        $skipped++;
        continue;
    }

    $msgId = 'tx-' . ($txId !== '' ? $txId : md5($machineId . $timestamp . $amount));

    $insert->execute([
        ':machine_id' => $machineId,
        ':product_id' => $productId,
        ':vend_column' => $colNum,
        ':quantity'   => $quantity,
        ':amount'     => $amount,
        ':sale_time'  => $saleTime,
        ':msg_id'     => $msgId,
    ]);

    $imported++;
    $label = $productId ? "product_id={$productId}" : 'no mapping';
    echo "[OK] {$machineId} | col {$colNum} | \${$amount} | {$saleTime} | {$label}" . PHP_EOL;
}

echo PHP_EOL . "Done. Imported/updated: {$imported}, Skipped: {$skipped}" . PHP_EOL;
