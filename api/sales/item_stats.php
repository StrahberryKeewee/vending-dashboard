<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$pdo = Database::connect();

// Per-item sales stats
$statsStmt = $pdo->query(
    'SELECT   COALESCE(mc.product_name, p.name)  AS product_name,
              COALESCE(mc.category,     p.category) AS category,
              SUM(s.quantity)                      AS total_qty,
              SUM(s.amount * s.quantity)           AS total_revenue,
              AVG(s.amount)                        AS avg_price,
              MIN(s.sale_time)                     AS first_sold,
              MAX(s.sale_time)                     AS last_sold,
              COUNT(DISTINCT s.machine_id)         AS machine_count,
              COUNT(*)                             AS txn_count,
              COALESCE(SUM(
                  CASE WHEN pp.vending_price > 0
                       THEN s.amount * (pp.net_profit / pp.vending_price)
                       ELSE 0 END
              ), 0)                                AS total_profit,
              MAX(CASE WHEN pp.vending_price > 0
                       THEN ROUND(pp.net_profit / pp.vending_price * 100, 1)
                       ELSE NULL END)              AS profit_margin_pct,
              MAX(pp.net_profit)                   AS net_profit_per_unit
     FROM     sales s
     LEFT JOIN products p        ON p.id = s.product_id
     LEFT JOIN machine_columns mc ON mc.machine_id = s.machine_id
                                  AND mc.column_num = s.vend_column
     LEFT JOIN product_pricing pp ON LOWER(pp.product_name) = LOWER(COALESCE(mc.product_name, p.name))
     WHERE    COALESCE(mc.product_name, p.name) IS NOT NULL
     GROUP BY product_name, category
     ORDER BY total_revenue DESC'
);
$items = $statsStmt->fetchAll();

// Current stock per item — with location label
$stockStmt = $pdo->query(
    'SELECT   COALESCE(mc.product_name, p.name) AS product_name,
              m.location,
              mi.current_qty,
              mc.capacity,
              mi.updated_at
     FROM     machine_inventory mi
     JOIN     machine_columns mc ON mc.machine_id = mi.machine_id
                                AND mc.column_num  = mi.column_num
     JOIN     machines m         ON m.machine_id   = mi.machine_id
     LEFT JOIN products p        ON p.id = mc.product_id
     ORDER BY product_name, m.location'
);
$stockRows = $stockStmt->fetchAll();

// Group stock by product name
$stockByItem = [];
foreach ($stockRows as $row) {
    $stockByItem[$row['product_name']][] = [
        'location'   => $row['location'],
        'current_qty' => (int) $row['current_qty'],
        'capacity'   => $row['capacity'] !== null ? (int) $row['capacity'] : null,
        'updated_at' => $row['updated_at'],
    ];
}

$result = array_map(function ($item) use ($stockByItem) {
    $name = $item['product_name'];
    $daysSinceLast = $item['last_sold']
        ? (int) floor((time() - strtotime($item['last_sold'])) / 86400)
        : null;
    $daysActive = $item['first_sold']
        ? max(1, (int) ceil((time() - strtotime($item['first_sold'])) / 86400))
        : 1;
    return [
        'product_name'   => $name,
        'category'       => $item['category'],
        'total_qty'      => (int)   $item['total_qty'],
        'total_revenue'  => round((float) $item['total_revenue'], 2),
        'total_profit'      => round((float) $item['total_profit'],  2),
        'profit_margin_pct'   => $item['profit_margin_pct'] !== null ? (float) $item['profit_margin_pct'] : null,
        'net_profit_per_unit' => $item['net_profit_per_unit'] !== null ? round((float) $item['net_profit_per_unit'], 2) : null,
        'avg_price'      => round((float) $item['avg_price'], 2),
        'txn_count'      => (int)   $item['txn_count'],
        'machine_count'  => (int)   $item['machine_count'],
        'first_sold'     => $item['first_sold'],
        'last_sold'      => $item['last_sold'],
        'days_since_last' => $daysSinceLast,
        'avg_daily_qty'  => round($item['total_qty'] / $daysActive, 2),
        'stock'          => $stockByItem[$name] ?? [],
    ];
}, $items);

jsonResponse(['items' => $result]);
