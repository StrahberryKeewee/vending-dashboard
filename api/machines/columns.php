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
        'SELECT id, column_num, product_name, category, product_id
         FROM   machine_columns
         WHERE  machine_id = :machine_id
         ORDER BY CAST(column_num AS UNSIGNED), column_num'
    );
    $stmt->execute([':machine_id' => $machineId]);
    jsonResponse(['columns' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $body        = json_decode(file_get_contents('php://input'), true) ?? [];
    $machineId   = trim($body['machine_id']   ?? '');
    $columnNum   = trim($body['column_num']   ?? '');
    $productName = trim($body['product_name'] ?? '');
    $category    = trim($body['category']     ?? '');

    if ($machineId === '' || $columnNum === '' || $productName === '' || $category === '') {
        jsonError('machine_id, column_num, product_name, and category are required', 400);
    }

    // Find or create a product record for this name
    $check = $pdo->prepare('SELECT id FROM products WHERE name = :name LIMIT 1');
    $check->execute([':name' => $productName]);
    $productId = $check->fetchColumn();

    if (!$productId) {
        $sku    = strtoupper(preg_replace('/[^A-Z0-9]/', '', $productName));
        $sku    = (strlen($sku) > 8 ? substr($sku, 0, 8) : $sku) . '-' . strtoupper(substr(md5($productName), 0, 4));
        $create = $pdo->prepare(
            'INSERT IGNORE INTO products (sku, name, category, price) VALUES (:sku, :name, :category, 0.00)'
        );
        $create->execute([':sku' => $sku, ':name' => $productName, ':category' => $category]);
        $productId = $pdo->lastInsertId();

        if (!$productId) {
            $check->execute([':name' => $productName]);
            $productId = $check->fetchColumn();
        }
    }

    $stmt = $pdo->prepare(
        'INSERT INTO machine_columns (machine_id, column_num, product_name, category, product_id)
         VALUES (:machine_id, :column_num, :product_name, :category, :product_id)
         ON DUPLICATE KEY UPDATE
           product_name = :product_name2,
           category     = :category2,
           product_id   = :product_id2'
    );
    $stmt->execute([
        ':machine_id'    => $machineId,
        ':column_num'    => $columnNum,
        ':product_name'  => $productName,
        ':category'      => $category,
        ':product_id'    => $productId,
        ':product_name2' => $productName,
        ':category2'     => $category,
        ':product_id2'   => $productId,
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
