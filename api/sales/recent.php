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

$pdo  = Database::connect();
$stmt = $pdo->prepare(
    "SELECT s.id,
            s.sale_time,
            s.vend_column,
            s.amount,
            COALESCE(mc.product_name, p.name) AS product_name,
            CASE WHEN pp.vending_price > 0
                 THEN s.amount * (pp.net_profit / pp.vending_price)
                 ELSE NULL END AS profit
     FROM   sales s
     LEFT JOIN products p         ON p.id = s.product_id
     LEFT JOIN machine_columns mc ON mc.machine_id = s.machine_id AND mc.column_num = s.vend_column
     LEFT JOIN product_pricing pp ON pp.product_name = COALESCE(mc.product_name, p.name)
     WHERE  s.machine_id = :machine_id
     ORDER BY s.sale_time DESC
     LIMIT 30"
);
$stmt->execute([':machine_id' => $machineId]);

$rows = array_map(fn($r) => [
    'id'           => (int)   $r['id'],
    'sale_time'    => $r['sale_time'],
    'vend_column'  => $r['vend_column'],
    'amount'       => (float) $r['amount'],
    'product_name' => $r['product_name'],
    'profit'       => $r['profit'] !== null ? round((float) $r['profit'], 2) : null,
], $stmt->fetchAll());

jsonResponse(['sales' => $rows]);
