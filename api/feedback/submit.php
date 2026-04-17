<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!is_array($body)) {
    jsonError('Invalid JSON payload');
}

$location   = trim($body['location']   ?? '');
$machine_id = trim($body['machine_id'] ?? '');
$rating     = filter_var($body['rating']    ?? null, FILTER_VALIDATE_INT);
$comments   = trim($body['comments']   ?? '');
$items      = $body['items_purchased'] ?? [];
$suggestions = trim($body['suggestions'] ?? '');

if ($location === '') {
    jsonError('Location is required');
}

if ($rating === false || $rating < 1 || $rating > 5) {
    jsonError('Rating must be an integer between 1 and 5');
}

if ($comments === '') {
    jsonError('Comments field is required');
}

if (!is_array($items)) {
    jsonError('items_purchased must be an array');
}

$sanitizedItems = array_values(array_filter(array_map('strval', $items)));

$itemsJson = json_encode($sanitizedItems);

$pdo = Database::connect();

$stmt = $pdo->prepare(
    'INSERT INTO feedback (machine_id, location, rating, comments, items_purchased, suggestions)
     VALUES (:machine_id, :location, :rating, :comments, :items_purchased, :suggestions)'
);

$stmt->execute([
    ':machine_id'      => $machine_id !== '' ? $machine_id : null,
    ':location'        => $location,
    ':rating'          => $rating,
    ':comments'        => $comments !== '' ? $comments : null,
    ':items_purchased' => $itemsJson,
    ':suggestions'     => $suggestions !== '' ? $suggestions : null,
]);

jsonResponse(['success' => true, 'id' => (int) $pdo->lastInsertId()], 201);
