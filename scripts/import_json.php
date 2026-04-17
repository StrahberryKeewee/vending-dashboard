<?php

/**
 * One-time import script for SeedLive JSON activity exports.
 *
 * Usage:
 *   php scripts/import_json.php /path/to/activity.json
 */

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
    fwrite(STDERR, 'Usage: php import_json.php <path-to-json-file>' . PHP_EOL);
    exit(1);
}

$raw  = file_get_contents($file);
$rows = json_decode($raw, true);

if (!is_array($rows)) {
    fwrite(STDERR, 'Invalid JSON file.' . PHP_EOL);
    exit(1);
}

$pdo = Database::connect();

$insert = $pdo->prepare(
    'INSERT IGNORE INTO sales (machine_id, product_id, quantity, amount, sale_time, sqs_message_id)
     VALUES (:machine_id, NULL, 1, :amount, :sale_time, :msg_id)'
);

$imported = 0;
$skipped  = 0;

foreach ($rows as $i => $row) {
    $machineId = trim($row['Device'] ?? '');
    $day       = trim($row['Day']    ?? '');
    $amountRaw = trim($row['']       ?? '0');

    if ($machineId === '' || $day === '') {
        $skipped++;
        continue;
    }

    $amount = (float) str_replace(['$', ','], '', $amountRaw);
    if ($amount <= 0) {
        $skipped++;
        continue;
    }

    $date = DateTime::createFromFormat('m/d/Y', $day);
    if (!$date) {
        $skipped++;
        continue;
    }

    $saleTime = $date->format('Y-m-d') . ' 12:00:00';
    $msgId    = 'import-' . md5($machineId . $day . $amountRaw . $i);

    $insert->execute([
        ':machine_id' => $machineId,
        ':amount'     => $amount,
        ':sale_time'  => $saleTime,
        ':msg_id'     => $msgId,
    ]);

    $imported++;
    echo "[OK] {$machineId} | {$day} | \${$amount}" . PHP_EOL;
}

echo PHP_EOL . "Done. Imported: {$imported}, Skipped: {$skipped}" . PHP_EOL;
