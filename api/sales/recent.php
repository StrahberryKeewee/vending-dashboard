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
    'SELECT s.id, s.sale_time, s.vend_column, s.amount, p.name AS product_name
     FROM   sales s
     LEFT JOIN products p ON p.id = s.product_id
     WHERE  s.machine_id = :machine_id
     ORDER BY s.sale_time DESC
     LIMIT 30'
);
$stmt->execute([':machine_id' => $machineId]);

jsonResponse(['sales' => $stmt->fetchAll()]);
