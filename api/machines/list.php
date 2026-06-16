<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$pdo  = Database::connect();
$rows = $pdo->query(
    'SELECT machine_id, location, building, floor, status, has_data FROM machines ORDER BY machine_id'
)->fetchAll();

jsonResponse(['machines' => $rows]);
