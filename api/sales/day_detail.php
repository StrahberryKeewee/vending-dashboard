<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$date      = trim($_GET['date'] ?? '');
$machineId = trim($_GET['machine_id'] ?? '');

if (!$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    jsonError('valid date required (YYYY-MM-DD)', 400);
}

$mFilter = $machineId !== '' ? ' AND s.machine_id = :machine_id' : '';
$mParam  = $machineId !== '' ? [':machine_id' => $machineId] : [];

$pdo = Database::connect();

// Summary
$summaryStmt = $pdo->prepare(
    'SELECT COUNT(*)               AS txn_count,
            SUM(amount * quantity) AS revenue,
            AVG(amount)            AS avg_price
     FROM   sales s
     WHERE  DATE(s.sale_time) = :date' . $mFilter
);
$summaryStmt->execute(array_merge([':date' => $date], $mParam));
$summary = $summaryStmt->fetch();

// Items sold
$itemsStmt = $pdo->prepare(
    'SELECT COALESCE(mc.product_name, p.name)     AS product_name,
            COALESCE(mc.category,     p.category) AS category,
            SUM(s.quantity)                        AS qty,
            SUM(s.amount * s.quantity)             AS revenue
     FROM   sales s
     LEFT   JOIN products p        ON p.id = s.product_id
     LEFT   JOIN machine_columns mc ON mc.machine_id = s.machine_id
                                    AND mc.column_num = s.vend_column
     WHERE  DATE(s.sale_time) = :date' . $mFilter . '
     GROUP  BY product_name, category
     ORDER  BY qty DESC'
);
$itemsStmt->execute(array_merge([':date' => $date], $mParam));
$items = $itemsStmt->fetchAll();

// Individual transactions
$txnStmt = $pdo->prepare(
    'SELECT TIME_FORMAT(s.sale_time, "%h:%i %p")   AS time,
            COALESCE(mc.product_name, p.name)       AS product_name,
            s.amount,
            s.quantity,
            m.location
     FROM   sales s
     LEFT   JOIN products p        ON p.id = s.product_id
     LEFT   JOIN machine_columns mc ON mc.machine_id = s.machine_id
                                    AND mc.column_num = s.vend_column
     LEFT   JOIN machines m         ON m.machine_id = s.machine_id
     WHERE  DATE(s.sale_time) = :date' . $mFilter . '
     ORDER  BY s.sale_time'
);
$txnStmt->execute(array_merge([':date' => $date], $mParam));
$transactions = $txnStmt->fetchAll();

jsonResponse([
    'date'         => $date,
    'summary'      => [
        'txn_count' => (int)   $summary['txn_count'],
        'revenue'   => round((float) $summary['revenue'], 2),
        'avg_price' => round((float) $summary['avg_price'], 2),
    ],
    'items'        => array_map(fn($r) => [
        'product_name' => $r['product_name'],
        'category'     => $r['category'],
        'qty'          => (int)   $r['qty'],
        'revenue'      => round((float) $r['revenue'], 2),
    ], $items),
    'transactions' => array_map(fn($r) => [
        'time'         => $r['time'],
        'product_name' => $r['product_name'],
        'amount'       => (float) $r['amount'],
        'quantity'     => (int)   $r['quantity'],
        'location'     => $r['location'],
    ], $transactions),
]);
