<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$pdo = Database::connect();

$period    = strtolower(trim($_GET['period']     ?? 'weekly'));
$machineId = trim($_GET['machine_id'] ?? '');

if (!in_array($period, ['daily', 'weekly', 'monthly'], true)) {
    $period = 'weekly';
}

$mFilter = $machineId !== '' ? ' AND machine_id = :machine_id' : '';
$mParam  = $machineId !== '' ? [':machine_id' => $machineId] : [];

if ($period === 'daily') {
    $stmt = $pdo->prepare(
        'SELECT DATE_FORMAT(sale_time, "%a") AS label,
                COALESCE(SUM(amount * quantity), 0) AS revenue
         FROM   sales
         WHERE  sale_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)' . $mFilter . '
         GROUP  BY DATE(sale_time), DAYOFWEEK(sale_time)
         ORDER  BY DATE(sale_time)'
    );
} elseif ($period === 'monthly') {
    $stmt = $pdo->prepare(
        'SELECT DATE_FORMAT(sale_time, "%b %Y") AS label,
                COALESCE(SUM(amount * quantity), 0) AS revenue
         FROM   sales
         WHERE  sale_time >= DATE_SUB(NOW(), INTERVAL 12 MONTH)' . $mFilter . '
         GROUP  BY YEAR(sale_time), MONTH(sale_time)
         ORDER  BY YEAR(sale_time), MONTH(sale_time)'
    );
} else {
    $stmt = $pdo->prepare(
        'SELECT CONCAT("Week ", CEIL(DAY(sale_time) / 7.0)) AS label,
                COALESCE(SUM(amount * quantity), 0) AS revenue
         FROM   sales
         WHERE  YEAR(sale_time) = YEAR(NOW()) AND MONTH(sale_time) = MONTH(NOW())' . $mFilter . '
         GROUP  BY CEIL(DAY(sale_time) / 7.0)
         ORDER  BY CEIL(DAY(sale_time) / 7.0)'
    );
}
$stmt->execute($mParam);

$rows = $stmt->fetchAll();
$labels = [];
$data   = [];

foreach ($rows as $row) {
    $labels[] = $row['label'];
    $data[]   = round((float) $row['revenue'], 2);
}

jsonResponse([
    'period' => $period,
    'labels' => $labels,
    'data'   => $data,
]);
