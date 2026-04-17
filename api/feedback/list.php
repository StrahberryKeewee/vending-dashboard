<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$limit  = min((int) ($_GET['limit']  ?? 50), 200);
$offset = max((int) ($_GET['offset'] ?? 0),  0);

$pdo = Database::connect();

$stmt = $pdo->prepare(
    'SELECT id, machine_id, location, rating, comments, items_purchased, suggestions,
            DATE_FORMAT(submitted_at, "%Y-%m-%d %H:%i:%s") AS submitted_at
     FROM   feedback
     ORDER  BY submitted_at DESC
     LIMIT  :limit OFFSET :offset'
);

$stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();

$rows = $stmt->fetchAll();

foreach ($rows as &$row) {
    $row['rating'] = (int) $row['rating'];
    $row['items_purchased'] = json_decode($row['items_purchased'] ?? '[]', true) ?? [];
}
unset($row);

$total = (int) $pdo->query('SELECT COUNT(*) FROM feedback')->fetchColumn();

jsonResponse([
    'total'    => $total,
    'limit'    => $limit,
    'offset'   => $offset,
    'feedback' => $rows,
]);
