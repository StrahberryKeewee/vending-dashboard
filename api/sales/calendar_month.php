<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$year      = (int) ($_GET['year']  ?? date('Y'));
$month     = (int) ($_GET['month'] ?? date('n'));
$machineId = trim($_GET['machine_id'] ?? '');

$mFilter = $machineId !== '' ? ' AND s.machine_id = :machine_id' : '';
$mParam  = $machineId !== '' ? [':machine_id' => $machineId] : [];

$pdo = Database::connect();

$stmt = $pdo->prepare(
    'SELECT DATE(s.sale_time) AS date,
            COUNT(*)          AS txn_count,
            COALESCE(SUM(s.amount), 0) AS revenue,
            COALESCE(SUM(
                CASE WHEN pp.vending_price > 0
                     THEN s.amount * (pp.net_profit / pp.vending_price)
                     ELSE 0 END
            ), 0) AS profit
     FROM   sales s
     LEFT JOIN machine_columns mc ON mc.machine_id = s.machine_id AND mc.column_num = s.vend_column
     LEFT JOIN product_pricing pp ON LOWER(pp.product_name) = LOWER(mc.product_name)
     WHERE  YEAR(s.sale_time)  = :year
       AND  MONTH(s.sale_time) = :month' . $mFilter . '
     GROUP  BY DATE(s.sale_time)
     ORDER  BY date'
);
$stmt->execute(array_merge([':year' => $year, ':month' => $month], $mParam));
$rows = $stmt->fetchAll();

$days = [];
foreach ($rows as $r) {
    $days[$r['date']] = [
        'txn_count' => (int)   $r['txn_count'],
        'revenue'   => round((float) $r['revenue'], 2),
        'profit'    => round((float) $r['profit'],  2),
    ];
}

jsonResponse(['year' => $year, 'month' => $month, 'days' => $days]);
