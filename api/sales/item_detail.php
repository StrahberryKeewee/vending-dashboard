<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$name = trim($_GET['name'] ?? '');
if ($name === '') {
    jsonError('name required', 400);
}

$pdo = Database::connect();

// Monthly sales for chart
$monthStmt = $pdo->prepare(
    'SELECT   DATE_FORMAT(s.sale_time, "%Y-%m") AS month,
              SUM(s.quantity)                    AS qty,
              SUM(s.amount)         AS revenue
     FROM     sales s
     LEFT JOIN products p        ON p.id = s.product_id
     LEFT JOIN machine_columns mc ON mc.machine_id = s.machine_id
                                  AND mc.column_num = s.vend_column
     WHERE    COALESCE(mc.product_name, p.name) = :name
     GROUP BY month
     ORDER BY month'
);
$monthStmt->execute([':name' => $name]);
$monthly = $monthStmt->fetchAll();

jsonResponse(['monthly' => $monthly]);
