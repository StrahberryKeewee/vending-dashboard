<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = Database::connect();

if ($method === 'GET') {
    $machineId = trim($_GET['machine_id'] ?? '');
    if ($machineId === '') {
        jsonError('machine_id required', 400);
    }

    $stmt = $pdo->prepare(
        'SELECT mc.id, mc.column_num, mc.product_sku, p.name AS product_name, p.category
         FROM   machine_columns mc
         JOIN   products p ON p.sku = mc.product_sku
         WHERE  mc.machine_id = :machine_id
         ORDER BY CAST(mc.column_num AS UNSIGNED), mc.column_num'
    );
    $stmt->execute([':machine_id' => $machineId]);
    jsonResponse(['columns' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $body      = json_decode(file_get_contents('php://input'), true) ?? [];
    $machineId = trim($body['machine_id'] ?? '');
    $columnNum = trim($body['column_num']  ?? '');
    $sku       = trim($body['product_sku'] ?? '');

    if ($machineId === '' || $columnNum === '' || $sku === '') {
        jsonError('machine_id, column_num, and product_sku are required', 400);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO machine_columns (machine_id, column_num, product_sku)
         VALUES (:machine_id, :column_num, :sku)
         ON DUPLICATE KEY UPDATE product_sku = :sku2'
    );
    $stmt->execute([
        ':machine_id' => $machineId,
        ':column_num' => $columnNum,
        ':sku'        => $sku,
        ':sku2'       => $sku,
    ]);

    jsonResponse(['success' => true]);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonError('id required', 400);
    }

    $stmt = $pdo->prepare('DELETE FROM machine_columns WHERE id = :id');
    $stmt->execute([':id' => $id]);

    if ($stmt->rowCount() === 0) {
        jsonError('Not found', 404);
    }
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
