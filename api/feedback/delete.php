<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonError('Method not allowed', 405);
}

$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);

if (!$id || $id < 1) {
    jsonError('Invalid or missing id');
}

$pdo  = Database::connect();
$stmt = $pdo->prepare('DELETE FROM feedback WHERE id = :id');
$stmt->execute([':id' => $id]);

if ($stmt->rowCount() === 0) {
    jsonError('Feedback not found', 404);
}

jsonResponse(['success' => true, 'deleted_id' => $id]);
