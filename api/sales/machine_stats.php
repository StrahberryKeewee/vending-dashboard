<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$machineId = trim($_GET['machine_id'] ?? '');
if ($machineId === '') {
    jsonError('machine_id required', 400);
}

$pdo = Database::connect();

// ── Sales by hour of day ──────────────────────────────────────────────────────
$hourStmt = $pdo->prepare(
    'SELECT HOUR(sale_time)              AS hour,
            COUNT(*)                     AS txn_count,
            COALESCE(SUM(amount), 0) AS revenue
     FROM   sales
     WHERE  machine_id = :machine_id
     GROUP  BY HOUR(sale_time)
     ORDER  BY hour'
);
$hourStmt->execute([':machine_id' => $machineId]);
$hourRows = $hourStmt->fetchAll();

$byHour = [];
for ($i = 0; $i < 24; $i++) {
    $byHour[$i] = ['hour' => $i, 'count' => 0, 'revenue' => 0.0];
}
foreach ($hourRows as $row) {
    $h = (int) $row['hour'];
    $byHour[$h] = ['hour' => $h, 'count' => (int) $row['txn_count'], 'revenue' => (float) $row['revenue']];
}

// ── Sales by day of week (MySQL: 1=Sun … 7=Sat) ───────────────────────────────
$dowStmt = $pdo->prepare(
    'SELECT DAYOFWEEK(sale_time)         AS dow,
            COUNT(*)                     AS txn_count,
            COALESCE(SUM(amount), 0) AS revenue
     FROM   sales
     WHERE  machine_id = :machine_id
     GROUP  BY DAYOFWEEK(sale_time)
     ORDER  BY dow'
);
$dowStmt->execute([':machine_id' => $machineId]);
$dowRows = $dowStmt->fetchAll();

$dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
$byDow = [];
for ($i = 1; $i <= 7; $i++) {
    $byDow[$i] = ['dow' => $i, 'label' => $dowLabels[$i - 1], 'count' => 0, 'revenue' => 0.0];
}
foreach ($dowRows as $row) {
    $d = (int) $row['dow'];
    $byDow[$d] = ['dow' => $d, 'label' => $dowLabels[$d - 1], 'count' => (int) $row['txn_count'], 'revenue' => (float) $row['revenue']];
}

// ── Top 5 sellers ─────────────────────────────────────────────────────────────
$topStmt = $pdo->prepare(
    'SELECT COALESCE(mc.product_name, p.name) AS product_name,
            COALESCE(mc.category, p.category) AS category,
            SUM(s.quantity)            AS total_qty,
            SUM(s.amount) AS total_revenue
     FROM   sales s
     LEFT   JOIN products p       ON p.id = s.product_id
     LEFT   JOIN machine_columns mc ON mc.machine_id = s.machine_id AND mc.column_num = s.vend_column
     WHERE  s.machine_id = :machine_id
     GROUP  BY s.vend_column, product_name, category
     ORDER  BY total_qty DESC
     LIMIT  5'
);
$topStmt->execute([':machine_id' => $machineId]);
$topSellers = $topStmt->fetchAll();

// ── Period comparison ─────────────────────────────────────────────────────────
$now = new DateTime();
$today = $now->format('Y-m-d');

// Rolling 7-day windows (avoids Monday = $0 problem with calendar weeks)
$last7Start  = (clone $now)->modify('-6 days')->format('Y-m-d');  // today included = 7 days
$prev7Start  = (clone $now)->modify('-13 days')->format('Y-m-d');
$prev7End    = (clone $now)->modify('-7 days')->format('Y-m-d');

$thisMonthStart = $now->format('Y-m-01');
$lastMonthStart = (clone $now)->modify('first day of last month')->format('Y-m-d');
$lastMonthEnd   = (clone $now)->modify('last day of last month')->format('Y-m-d');

$periodStmt = $pdo->prepare(
    'SELECT COALESCE(SUM(amount), 0) AS revenue,
            COUNT(*)                 AS txn_count
     FROM   sales
     WHERE  machine_id = :machine_id
       AND  DATE(sale_time) BETWEEN :start AND :end'
);

$fetchPeriod = function(string $start, string $end) use ($pdo, $periodStmt, $machineId): array {
    $periodStmt->execute([':machine_id' => $machineId, ':start' => $start, ':end' => $end]);
    $row = $periodStmt->fetch();
    return ['revenue' => (float) $row['revenue'], 'txns' => (int) $row['txn_count']];
};

$thisWeek  = $fetchPeriod($last7Start, $today);
$lastWeek  = $fetchPeriod($prev7Start, $prev7End);
$thisMonth = $fetchPeriod($thisMonthStart, $today);
$lastMonth = $fetchPeriod($lastMonthStart, $lastMonthEnd);

$pctChange = fn($curr, $prev) => $prev > 0 ? round((($curr - $prev) / $prev) * 100, 1) : null;

// ── Slow movers (mapped columns with no sale in 30 days, or never sold) ───────
$deadStmt = $pdo->prepare(
    'SELECT mc.column_num,
            mc.product_name,
            mc.category,
            MAX(s.sale_time)                    AS last_sold,
            DATEDIFF(NOW(), MAX(s.sale_time))   AS days_since
     FROM   machine_columns mc
     LEFT   JOIN sales s
            ON  s.machine_id  = mc.machine_id
            AND s.vend_column  = mc.column_num
     WHERE  mc.machine_id = :machine_id
     GROUP  BY mc.id, mc.column_num, mc.product_name, mc.category
     HAVING last_sold IS NULL OR days_since > 30
     ORDER  BY days_since DESC, last_sold ASC'
);
$deadStmt->execute([':machine_id' => $machineId]);
$deadStock = $deadStmt->fetchAll();

// ── Response ──────────────────────────────────────────────────────────────────
jsonResponse([
    'by_hour'     => array_values($byHour),
    'by_dow'      => array_values($byDow),
    'top_sellers' => array_map(fn($r) => [
        'product_name'  => $r['product_name'],
        'category'      => $r['category'],
        'quantity'      => (int)   $r['total_qty'],
        'revenue'       => (float) $r['total_revenue'],
    ], $topSellers),
    'period_compare' => [
        'week'  => ['current' => $thisWeek['revenue'],  'previous' => $lastWeek['revenue'],  'txns_current' => $thisWeek['txns'],  'txns_previous' => $lastWeek['txns'],  'change_pct' => $pctChange($thisWeek['revenue'],  $lastWeek['revenue'])],
        'month' => ['current' => $thisMonth['revenue'], 'previous' => $lastMonth['revenue'], 'txns_current' => $thisMonth['txns'], 'txns_previous' => $lastMonth['txns'], 'change_pct' => $pctChange($thisMonth['revenue'], $lastMonth['revenue'])],
    ],
    'dead_stock' => array_map(fn($r) => [
        'column_num'   => $r['column_num'],
        'product_name' => $r['product_name'],
        'category'     => $r['category'],
        'last_sold'    => $r['last_sold'],
        'days_since'   => $r['days_since'] !== null ? (int) $r['days_since'] : null,
    ], $deadStock),
]);
