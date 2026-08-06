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

$mFilter = $machineId !== '' ? ' AND machine_id = :machine_id' : '';
$mParam  = $machineId !== '' ? [':machine_id' => $machineId] : [];

$pdo = Database::connect();

$stmt = $pdo->prepare(
    'SELECT DATE(sale_time)            AS date,
            COUNT(*)                   AS txn_count,
            SUM(amount * quantity)     AS revenue
     FROM   sales
     WHERE  YEAR(sale_time)  = :year
       AND  MONTH(sale_time) = :month' . $mFilter . '
     GROUP  BY DATE(sale_time)
     ORDER  BY date'
);
$stmt->execute(array_merge([':year' => $year, ':month' => $month], $mParam));
$rows = $stmt->fetchAll();

$days = [];
foreach ($rows as $r) {
    $days[$r['date']] = [
        'txn_count' => (int)   $r['txn_count'],
        'revenue'   => round((float) $r['revenue'], 2),
    ];
}

jsonResponse(['year' => $year, 'month' => $month, 'days' => $days]);
