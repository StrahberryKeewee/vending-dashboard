<?php
/**
 * One-shot script: subtract all sales that occurred AFTER each slot's last
 * inventory count from the current_qty in machine_inventory.
 *
 * Safe to re-run: it checks sale_time > updated_at so already-applied
 * decrements won't be double-counted as long as updated_at isn't reset.
 *
 * Run on EC2: php scripts/backfill_inventory_decrement.php
 */

require_once __DIR__ . '/../api/config/Database.php';

$pdo = Database::connect();

// Find every slot's total sold qty for sales that happened AFTER the count
$sold = $pdo->query(
    'SELECT s.machine_id,
            s.vend_column        AS column_num,
            SUM(s.quantity)      AS total_sold
     FROM   sales s
     JOIN   machine_inventory mi
            ON  mi.machine_id = s.machine_id
            AND mi.column_num = s.vend_column
     WHERE  s.sale_time > mi.updated_at
     GROUP  BY s.machine_id, s.vend_column'
)->fetchAll();

if (!$sold) {
    echo "No unaccounted sales found — nothing to do.\n";
    exit(0);
}

$update = $pdo->prepare(
    'UPDATE machine_inventory
     SET    current_qty = GREATEST(current_qty - :sold, 0)
     WHERE  machine_id  = :machine_id
       AND  column_num  = :column_num'
);

foreach ($sold as $row) {
    $update->execute([
        ':sold'       => (int) $row['total_sold'],
        ':machine_id' => $row['machine_id'],
        ':column_num' => $row['column_num'],
    ]);
    echo "Updated {$row['machine_id']} col {$row['column_num']}: -{$row['total_sold']}\n";
}

echo "Done.\n";
