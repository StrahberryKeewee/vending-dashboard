<?php
// Run once on the server: php scripts/seed_product_pricing.php
require_once __DIR__ . '/../api/config/Database.php';

$pdo = Database::connect();

$pdo->exec("
CREATE TABLE IF NOT EXISTS product_pricing (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  product_name  VARCHAR(255) NOT NULL,
  vending_price DECIMAL(8,2) NOT NULL DEFAULT 0,
  net_profit    DECIMAL(8,2) NOT NULL DEFAULT 0,
  UNIQUE KEY idx_product_name (product_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$items = [
    ['Pens',                 2.00, 1.38],
    ['Pencils',              2.00, 1.11],
    ['Yellow Highlighters',  2.00, 1.29],
    ['Yellow Sticky Notes',  1.25, 0.88],
    ['Pocket Notebook',      1.50, 0.89],
    ['Calculator TI-30',    20.00, 1.80],
    ['Pink Eraser',          2.00, 1.26],
    ['Scantrons',            1.50, 0.81],
    ['Index cards',          2.00, 1.08],
    ['Permament markers',    2.50, 1.13],
    ['Dry erase marker',     2.00, 1.44],
    ['Batteries - AA',       2.50, 1.29],
    ['Batteries - AAA',      2.00, 1.20],
    ['Batteries - 9V',       2.50, 1.11],
    ['Toothpaste',           2.25, 1.15],
    ['Deorderant',           2.00, 0.88],
    ['Chapstick',            2.00, 1.26],
    ['Tissues',              1.50, 1.08],
    ['Bandaids',             1.50, 0.53],
    ['Razors',               1.50, 1.19],
    ['Tylenol',              1.50, 1.01],
    ['Shampoo',              1.50, 0.97],
    ['Condtioner',           1.50, 0.97],
    ['Body Wash',            1.50, 0.97],
    ['Body Soap',            1.50, 0.97],
    ['Lotion',               1.50, 0.97],
    ['Advil',                1.50, 1.29],
    ['Condoms',              7.50, 5.39],
    ['Tampons',              0.75, 0.31],
    ['Pads',                 0.50, 0.30],
    ['Overnight Pads',       0.50, 0.26],
    ['Liners',               0.75, 0.34],
    ['Hygiene kits',         2.00, 1.00],
    ['Tide Pods',            1.50, 1.14],
];

$stmt = $pdo->prepare(
    'INSERT INTO product_pricing (product_name, vending_price, net_profit)
     VALUES (:name, :price, :profit)
     ON DUPLICATE KEY UPDATE vending_price = VALUES(vending_price), net_profit = VALUES(net_profit)'
);

foreach ($items as [$name, $price, $profit]) {
    $stmt->execute([':name' => $name, ':price' => $price, ':profit' => $profit]);
    echo "  $name → \${$price} → \${$profit} profit\n";
}

echo "\nDone: " . count($items) . " products seeded.\n";
