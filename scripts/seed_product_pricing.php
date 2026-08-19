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
    // Auto Metal Craft (AMC)
    ['Baja Blast',                      1.25, 0.66],
    ['Cheetos',                         1.25, 0.81],
    ['Cheez-It',                        1.25, 0.85],
    ['Cherry Pepsi',                    1.25, 0.66],
    ['Chesters Hot Fries',              1.25, 0.72],
    ['Cloverhill Cherry Bearclaw',      1.75, 0.61],
    ['Cloverhill Honey Bun',            1.75, 0.94],
    ['Coke',                            1.25, 0.66],
    ['Cream and Chives Cracker',        1.25, 0.98],
    ['Diet Coke',                       1.25, 0.66],
    ['Doritos Cool Ranch',              1.25, 0.81],
    ['Doritos Nacho Cheese',            1.25, 0.81],
    ['Dr Pepper',                       1.25, 0.66],
    ['Lays BBQ',                        1.25, 0.81],
    ['Lays Orignal',                    1.25, 0.81],
    ['M&Ms',                            2.00, 0.91],
    ['Milky Way',                       2.00, 0.91],
    ['Mtn Dew',                         1.25, 0.66],
    ['PB Cracker',                      1.25, 0.98],
    ['Peanut M&Ms',                     2.00, 0.91],
    ['Pepsi',                           1.25, 0.66],
    ['Reeses Cups',                     2.00, 0.73],
    ['Ruffles Sour Cream and Onion',    1.25, 0.81],
    ['Snickers',                        2.00, 0.91],
    ['Sprite',                          1.25, 0.66],
    ['Toast Chee Cracker',              1.25, 0.98],
    ['Toast Chee PB Cracker',           1.25, 0.98],
    ['Trail Mix',                       1.25, 0.64],
    ['Vernors',                         1.25, 0.66],

    // The Union
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

    // Alternate names / aliases that appear in sales data
    // AMC machine aliases
    ['Coca Cola',              1.25, 0.66],  // = Coke
    ['Doritos Ranch',          1.25, 0.81],  // = Doritos Cool Ranch
    ['Doritos Regular',        1.25, 0.81],  // = Doritos Nacho Cheese
    ['Toast Cheese Cracker',   1.25, 0.98],  // = Toast Chee Cracker
    ['Toast PB Cracker',       1.25, 0.98],  // = Toast Chee PB Cracker
    ['Cheez Itz',              1.25, 0.85],  // = Cheez-It
    ['Kars Trail Mix',         1.25, 0.64],  // = Trail Mix
    ['Bear Claw',              1.75, 0.61],  // = Cloverhill Cherry Bearclaw
    ['Ruffles S and C',        1.25, 0.81],  // = Ruffles Sour Cream and Onion
    ['MM',                     2.00, 0.91],  // = M&Ms
    ['Peanut MM',              2.00, 0.91],  // = Peanut M&Ms
    ['Honeybuns',              1.75, 0.94],  // = Cloverhill Honey Bun
    ['Hot Fries',              1.25, 0.72],  // = Chesters Hot Fries
    ['Oreos',                  2.00, 0.53],
    // Union machine aliases
    ['AA Batteries',           2.50, 1.29],  // = Batteries - AA
    ['AAA Batteries',          2.00, 1.20],  // = Batteries - AAA
    ['9V Batteries',           2.50, 1.11],  // = Batteries - 9V
    ['Sharpies',               2.50, 1.13],  // = Permament markers
    ['Band-Aids',              1.50, 0.53],  // = Bandaids
    ['Sticky Notes',           1.25, 0.88],  // = Yellow Sticky Notes
    ['Highlighters',           2.00, 1.29],  // = Yellow Highlighters
    ['Deodorant',              2.00, 0.88],  // = Deorderant
    ['Regular Flow Tampons',   0.75, 0.31],  // = Tampons
    ['Super Flow Tampons',     0.75, 0.31],  // = Tampons
    ['General Health Care Kit',2.00, 1.00],  // = Hygiene kits
    ['Razor',                  1.50, 1.19],  // = Razors
    ['Dry Erase Markers',      2.00, 1.44],  // = Dry erase marker
    ['Erasers',                2.00, 1.26],  // = Pink Eraser
    ['Notebooks',              1.50, 0.89],  // = Pocket Notebook
    ['Bar Soap',               1.50, 0.97],  // = Body Soap
    ['Toothbrush & Paste',     3.50, 1.15],
    ['Laundry Combo',          3.00, 1.11],
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
