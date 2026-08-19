<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$pdo = Database::connect();

$period    = strtolower(trim($_GET['period'] ?? 'weekly'));
$machineId = trim($_GET['machine_id'] ?? '');

if (!in_array($period, ['daily', 'weekly', 'monthly'], true)) {
    $period = 'weekly';
}

$mFilter = $machineId !== '' ? ' AND s.machine_id = :machine_id' : '';
$mParam  = $machineId !== '' ? [':machine_id' => $machineId] : [];

$profitExpr = "COALESCE(SUM(
    CASE WHEN pp.vending_price > 0
         THEN s.amount * (pp.net_profit / pp.vending_price)
         ELSE 0
    END
), 0)";

$joins = 'LEFT JOIN machine_columns mc ON mc.machine_id = s.machine_id AND mc.column_num = s.vend_column
          LEFT JOIN product_pricing pp ON pp.product_name = mc.product_name';

if ($period === 'daily') {
    $stmt = $pdo->prepare(
        "SELECT DATE_FORMAT(s.sale_time, '%a') AS label,
                COALESCE(SUM(s.amount * s.quantity), 0) AS revenue,
                $profitExpr AS profit
         FROM   sales s $joins
         WHERE  s.sale_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)$mFilter
         GROUP  BY DATE(s.sale_time), DAYOFWEEK(s.sale_time)
         ORDER  BY DATE(s.sale_time)"
    );
} elseif ($period === 'monthly') {
    $stmt = $pdo->prepare(
        "SELECT DATE_FORMAT(s.sale_time, '%b %Y') AS label,
                COALESCE(SUM(s.amount * s.quantity), 0) AS revenue,
                $profitExpr AS profit
         FROM   sales s $joins
         WHERE  s.sale_time >= DATE_SUB(NOW(), INTERVAL 12 MONTH)$mFilter
         GROUP  BY YEAR(s.sale_time), MONTH(s.sale_time)
         ORDER  BY YEAR(s.sale_time), MONTH(s.sale_time)"
    );
} else {
    $stmt = $pdo->prepare(
        "SELECT CONCAT('Week ', CEIL(DAY(s.sale_time) / 7.0)) AS label,
                COALESCE(SUM(s.amount * s.quantity), 0) AS revenue,
                $profitExpr AS profit
         FROM   sales s $joins
         WHERE  YEAR(s.sale_time) = YEAR(NOW()) AND MONTH(s.sale_time) = MONTH(NOW())$mFilter
         GROUP  BY CEIL(DAY(s.sale_time) / 7.0)
         ORDER  BY CEIL(DAY(s.sale_time) / 7.0)"
    );
}
$stmt->execute($mParam);

$rows   = $stmt->fetchAll();
$labels = [];
$data   = [];
$profit = [];

foreach ($rows as $row) {
    $labels[] = $row['label'];
    $data[]   = round((float) $row['revenue'], 2);
    $profit[]  = round((float) $row['profit'],  2);
}

jsonResponse([
    'period' => $period,
    'labels' => $labels,
    'data'   => $data,
    'profit' => $profit,
]);
