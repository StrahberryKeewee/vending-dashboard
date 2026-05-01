<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonError('Method not allowed', 405);
}

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    jsonError('id required', 400);
}

$pdo  = Database::connect();
$stmt = $pdo->prepare('DELETE FROM sales WHERE id = :id');
$stmt->execute([':id' => $id]);

if ($stmt->rowCount() === 0) {
    jsonError('Not found', 404);
}

jsonResponse(['success' => true]);
