<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$year = filter_var($_GET['year'] ?? date('Y'), FILTER_VALIDATE_INT);
if ($year === false || $year < 2000 || $year > 2100) {
    $year = (int) date('Y');
}

$machineId = trim($_GET['machine_id'] ?? '');

$pdo = Database::connect();

$machineFilter  = $machineId !== '' ? ' AND s.machine_id = :machine_id' : '';
$machineParams  = $machineId !== '' ? [':machine_id' => $machineId] : [];

$totalStmt = $pdo->prepare(
    'SELECT COALESCE(SUM(s.amount * s.quantity), 0) AS total
     FROM   sales s
     WHERE  YEAR(s.sale_time) = :year' . $machineFilter
);
$totalStmt->execute(array_merge([':year' => $year], $machineParams));
$total = (float) $totalStmt->fetchColumn();

$prevStmt = $pdo->prepare(
    'SELECT COALESCE(SUM(s.amount * s.quantity), 0) AS total
     FROM   sales s
     WHERE  YEAR(s.sale_time) = :prev_year' . $machineFilter
);
$prevStmt->execute(array_merge([':prev_year' => $year - 1], $machineParams));
$prevTotal = (float) $prevStmt->fetchColumn();

$growthPercent = $prevTotal > 0
    ? round((($total - $prevTotal) / $prevTotal) * 100, 1)
    : 0.0;

$catStmt = $pdo->prepare(
    'SELECT   p.category,
              COALESCE(SUM(s.amount * s.quantity), 0) AS revenue
     FROM     sales s
     JOIN     products p ON p.id = s.product_id
     WHERE    YEAR(s.sale_time) = :year' . $machineFilter . '
     GROUP BY p.category'
);
$catStmt->execute(array_merge([':year' => $year], $machineParams));
$catRows = $catStmt->fetchAll();

$categoryMap = [
    'Beverage'        => ['label' => 'Beverages',       'color' => '#22c55e'],
    'Snack'           => ['label' => 'Snacks',           'color' => '#3b82f6'],
    'Health Products' => ['label' => 'Health Products',  'color' => '#ef4444'],
    'School Supplies' => ['label' => 'School Supplies',  'color' => '#f59e0b'],
];

$categories = [];
$catRevenue = [];
foreach ($catRows as $row) {
    $catRevenue[$row['category']] = (float) $row['revenue'];
}

foreach ($categoryMap as $key => $meta) {
    $rev     = $catRevenue[$key] ?? 0.0;
    $percent = $total > 0 ? round(($rev / $total) * 100, 1) : 0.0;
    $categories[] = [
        'key'     => $key,
        'label'   => $meta['label'],
        'color'   => $meta['color'],
        'revenue' => $rev,
        'percent' => $percent,
    ];
}

jsonResponse([
    'year'           => $year,
    'total_ytd'      => $total,
    'growth_percent' => $growthPercent,
    'categories'     => $categories,
]);
