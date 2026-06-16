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
    'SELECT mc.column_num,
            mc.product_name,
            mc.category,
            mc.capacity,
            COALESCE(mi.current_qty, 0)  AS current_qty,
            mi.updated_at
     FROM   machine_columns mc
     LEFT   JOIN machine_inventory mi
            ON  mi.machine_id = mc.machine_id
            AND mi.column_num = mc.column_num
     WHERE  mc.machine_id = :machine_id
     ORDER  BY mc.column_num + 0, mc.column_num'
);
$stmt->execute([':machine_id' => $machineId]);

jsonResponse(['inventory' => $stmt->fetchAll()]);
