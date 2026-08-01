<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$machineId = trim($_GET['machine_id'] ?? '');
$mFilter   = $machineId !== '' ? ' AND machine_id = :machine_id' : '';
$mParam    = $machineId !== '' ? [':machine_id' => $machineId] : [];

$pdo = Database::connect();

$salesStmt = $pdo->prepare(
    'SELECT COUNT(*)        AS total_transactions,
            COALESCE(AVG(amount), 0) AS avg_sale
     FROM   sales
     WHERE  YEAR(sale_time) = YEAR(NOW())' . $mFilter
);
$salesStmt->execute($mParam);
$salesRow = $salesStmt->fetch();

$ratingStmt = $pdo->prepare(
    'SELECT COALESCE(AVG(rating), 0) AS avg_rating,
            COUNT(*)                  AS total_reviews
     FROM   feedback' . ($machineId !== '' ? ' WHERE machine_id = :machine_id' : '')
);
$ratingStmt->execute($mParam);
$ratingRow = $ratingStmt->fetch();

$topCatStmt = $pdo->prepare(
    'SELECT COALESCE(mc.category, p.category) AS category,
            SUM(s.amount * s.quantity)         AS revenue
     FROM   sales s
     LEFT   JOIN products p        ON p.id = s.product_id
     LEFT   JOIN machine_columns mc ON mc.machine_id = s.machine_id AND mc.column_num = s.vend_column
     WHERE  YEAR(s.sale_time) = YEAR(NOW())' . $mFilter . '
     GROUP BY category
     ORDER BY revenue DESC
     LIMIT 1'
);
$topCatStmt->execute($mParam);
$topCatRow = $topCatStmt->fetch();

jsonResponse([
    'total_transactions' => (int)   $salesRow['total_transactions'],
    'avg_sale'           => round((float) $salesRow['avg_sale'], 2),
    'avg_rating'         => round((float) $ratingRow['avg_rating'], 1),
    'total_reviews'      => (int)   $ratingRow['total_reviews'],
    'top_category'       => $topCatRow ? $topCatRow['category'] : null,
]);
