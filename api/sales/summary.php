<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$yearRaw = $_GET['year'] ?? date('Y');
$allTime = ($yearRaw === 'all');
$year    = $allTime ? (int) date('Y') : (int) filter_var($yearRaw, FILTER_VALIDATE_INT);
if (!$allTime && ($year === false || $year < 2000 || $year > 2100)) {
    $year = (int) date('Y');
}

$machineId = trim($_GET['machine_id'] ?? '');

$pdo = Database::connect();

$machineFilter = $machineId !== '' ? ' AND s.machine_id = :machine_id' : '';
$machineParams = $machineId !== '' ? [':machine_id' => $machineId] : [];

$yearFilter = $allTime ? '' : ' AND YEAR(s.sale_time) = :year';

$profitExpr = "COALESCE(SUM(
    CASE WHEN pp.vending_price > 0
         THEN s.amount * (pp.net_profit / pp.vending_price)
         ELSE 0
    END
), 0)";

$totalStmt = $pdo->prepare(
    "SELECT COALESCE(SUM(s.amount), 0) AS total,
            $profitExpr AS profit
     FROM   sales s
     LEFT JOIN machine_columns mc ON mc.machine_id = s.machine_id AND mc.column_num = s.vend_column
     LEFT JOIN product_pricing pp ON LOWER(pp.product_name) = LOWER(mc.product_name)
     WHERE  1=1" . $yearFilter . $machineFilter
);
$totalStmt->execute(array_merge($allTime ? [] : [':year' => $year], $machineParams));
$totalRow  = $totalStmt->fetch();
$total     = (float) $totalRow['total'];
$profitYtd = (float) $totalRow['profit'];

$prevStmt = $pdo->prepare(
    'SELECT COALESCE(SUM(s.amount), 0) AS total
     FROM   sales s
     WHERE  YEAR(s.sale_time) = :prev_year' . $machineFilter
);
$prevStmt->execute(array_merge([':prev_year' => $year - 1], $machineParams));
$prevTotal = (float) $prevStmt->fetchColumn();

$growthPercent = $prevTotal > 0
    ? round((($total - $prevTotal) / $prevTotal) * 100, 1)
    : 0.0;

$catStmt = $pdo->prepare(
    "SELECT COALESCE(mc.category, p.category) AS category,
            COALESCE(SUM(s.amount), 0) AS revenue,
            $profitExpr AS profit
     FROM   sales s
     LEFT JOIN products p         ON p.id = s.product_id
     LEFT JOIN machine_columns mc ON mc.machine_id = s.machine_id AND mc.column_num = s.vend_column
     LEFT JOIN product_pricing pp ON LOWER(pp.product_name) = LOWER(mc.product_name)
     WHERE  YEAR(s.sale_time) = :year" . $machineFilter . '
     GROUP BY category'
);
$catStmt->execute(array_merge([':year' => $year], $machineParams));
$catRows = $catStmt->fetchAll();

$categoryMap = [
    'Snack'           => ['label' => 'Snacks',          'color' => '#ef4444'],
    'Beverage'        => ['label' => 'Beverages',       'color' => '#f59e0b'],
    'Health Products' => ['label' => 'Health Products', 'color' => '#3b82f6'],
    'School Supplies' => ['label' => 'School Supplies', 'color' => '#22c55e'],
];

$catData = [];
foreach ($catRows as $row) {
    $catData[$row['category']] = ['revenue' => (float)$row['revenue'], 'profit' => (float)$row['profit']];
}

$categories = [];
foreach ($categoryMap as $key => $meta) {
    $rev     = $catData[$key]['revenue'] ?? 0.0;
    $profit  = $catData[$key]['profit']  ?? 0.0;
    $percent = $total > 0 ? round(($rev / $total) * 100, 1) : 0.0;
    $categories[] = [
        'key'     => $key,
        'label'   => $meta['label'],
        'color'   => $meta['color'],
        'revenue' => $rev,
        'profit'  => $profit,
        'percent' => $percent,
    ];
}

jsonResponse([
    'year'           => $year,
    'total_ytd'      => $total,
    'profit_ytd'     => round($profitYtd, 2),
    'growth_percent' => $growthPercent,
    'categories'     => $categories,
]);
