<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$pdo = Database::connect();

$stmt = $pdo->prepare(
    'SELECT s.sale_time, s.amount, s.machine_id, m.location, p.name AS product_name
     FROM   sales s
     LEFT JOIN machines m ON s.machine_id = m.machine_id
     LEFT JOIN products  p ON s.product_id = p.id
     ORDER BY s.sale_time DESC
     LIMIT 1'
);
$stmt->execute();
$row = $stmt->fetch();

if (!$row) {
    jsonResponse(['sale' => null]);
}

jsonResponse([
    'sale' => [
        'product_name' => $row['product_name'] ?? null,
        'sale_time'    => $row['sale_time'],
        'amount'       => (float) $row['amount'],
        'location'     => $row['location'] ?? $row['machine_id'],
    ]
]);
