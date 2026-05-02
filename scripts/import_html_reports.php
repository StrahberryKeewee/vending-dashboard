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

$dir = $argv[1] ?? null;
if (!$dir || !is_dir($dir)) {
    fwrite(STDERR, 'Usage: php import_html_reports.php <path-to-folder>' . PHP_EOL);
    exit(1);
}

$files = glob(rtrim($dir, '/') . '/*.htm') ?: [];
$files = array_merge($files, glob(rtrim($dir, '/') . '/*.html') ?: []);

if (!$files) {
    fwrite(STDERR, 'No HTML files found in ' . $dir . PHP_EOL);
    exit(1);
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
       product_id  = IF(product_id IS NULL AND VALUES(product_id) IS NOT NULL, VALUES(product_id), product_id),
       vend_column = IF(vend_column IS NULL, VALUES(vend_column), vend_column)'
);

$imported = 0;
$skipped  = 0;
$files    = array_unique($files);
sort($files);

foreach ($files as $file) {
    echo "Processing: " . basename($file) . PHP_EOL;

    $html = file_get_contents($file);
    if (!$html) { $skipped++; continue; }

    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    $dom->loadHTML($html, LIBXML_NOWARNING | LIBXML_NOERROR);
    libxml_clear_errors();

    $rows = $dom->getElementsByTagName('tr');
    if ($rows->length < 2) { continue; }

    // Map header names to column indexes
    $headers = [];
    foreach ($rows->item(0)->getElementsByTagName('th') as $i => $th) {
        $headers[strtolower(trim($th->textContent))] = $i;
    }

    // If no <th>, try first <td> row as header
    if (!$headers) {
        foreach ($rows->item(0)->getElementsByTagName('td') as $i => $td) {
            $headers[strtolower(trim($td->textContent))] = $i;
        }
    }

    $col = fn(string $name) => $headers[$name] ?? null;

    $iMachine  = $col('device serial num') ?? $col('device serial number') ?? $col('device');
    $iRef      = $col('ref nbr') ?? $col('reference number') ?? $col('ref');
    $iAmount   = $col('total amount') ?? $col('amount');
    $iVend     = $col('vend column') ?? $col('column');
    $iQty      = $col('quantity') ?? $col('qty');
    $iDate     = $col('tran date') ?? $col('transaction date') ?? $col('date');
    $iTime     = $col('tran time') ?? $col('transaction time') ?? $col('time');

    if ($iMachine === null || $iAmount === null || $iVend === null || $iDate === null) {
        echo "  [SKIP] Could not map required columns in " . basename($file) . PHP_EOL;
        continue;
    }

    $startRow = 1;

    for ($r = $startRow; $r < $rows->length; $r++) {
        $cells = $rows->item($r)->getElementsByTagName('td');
        if ($cells->length === 0) continue;

        $get = function(int $idx) use ($cells): string {
            return isset($cells[$idx]) ? trim($cells[$idx]->textContent) : '';
        };

        $machineId = $get($iMachine);
        $refNbr    = $get($iRef ?? 1);
        $amount    = (float) str_replace(['$', ','], '', $get($iAmount));
        $vendRaw   = trim($get($iVend));
        $quantity  = (int) ($iQty !== null ? $get($iQty) : 1) ?: 1;
        $dateStr   = $get($iDate);
        $timeStr   = $iTime !== null ? $get($iTime) : '00:00:00';

        if ($machineId === '' || $amount <= 0 || $dateStr === '') {
            $skipped++;
            continue;
        }

        // Parse date MM/DD/YYYY
        $date = DateTime::createFromFormat('m/d/Y', $dateStr);
        if (!$date) {
            $skipped++;
            continue;
        }
        $saleTime = $date->format('Y-m-d') . ' ' . ($timeStr ?: '00:00:00');

        // Strip leading zeros from vend column e.g. "0025" → "25"
        $colNum = $vendRaw !== '' ? (ltrim($vendRaw, '0') ?: '0') : null;

        $productId = null;
        if ($colNum !== null) {
            $lookupColumn->execute([':machine_id' => $machineId, ':column_num' => $colNum]);
            $result    = $lookupColumn->fetch();
            $productId = ($result && $result['product_id']) ? (int) $result['product_id'] : null;
        }

        $msgId = 'html-' . ($refNbr !== '' ? $refNbr : md5($machineId . $saleTime . $amount . $vendRaw));

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
        $label = $productId ? "product_id={$productId}" : 'unmapped';
        echo "  [OK] col {$colNum} | \${$amount} | {$saleTime} | {$label}" . PHP_EOL;
    }
}

echo PHP_EOL . "Done. Imported/updated: {$imported}, Skipped: {$skipped}" . PHP_EOL;
