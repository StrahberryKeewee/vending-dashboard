<?php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    jsonError('Invalid JSON', 400);
}

$machineId = trim($body['machine_id'] ?? '');
if ($machineId === '') {
    jsonError('machine_id required', 400);
}

$pdo = Database::connect();

$upsert = $pdo->prepare(
    'INSERT INTO machine_inventory (machine_id, column_num, current_qty)
     VALUES (:machine_id, :column_num, :qty)
     ON DUPLICATE KEY UPDATE current_qty = VALUES(current_qty)'
);

$log = $pdo->prepare(
    'INSERT INTO inventory_logs
         (machine_id, column_num, change_type, qty_before, qty_after, qty_change, note)
     VALUES
         (:machine_id, :column_num, :type, :before, :after, :change, :note)'
);

$getBefore = $pdo->prepare(
    'SELECT COALESCE(current_qty, 0) AS qty
     FROM   machine_inventory
     WHERE  machine_id = :machine_id AND column_num = :column_num'
);

// ── Bulk inventory count ──────────────────────────────────────────────────────
if (isset($body['counts']) && is_array($body['counts'])) {
    foreach ($body['counts'] as $row) {
        $col = trim($row['column_num'] ?? '');
        $qty = max(0, (int) ($row['qty'] ?? 0));
        if ($col === '') continue;

        $getBefore->execute([':machine_id' => $machineId, ':column_num' => $col]);
        $before = (int) ($getBefore->fetchColumn() ?: 0);

        $upsert->execute([':machine_id' => $machineId, ':column_num' => $col, ':qty' => $qty]);
        $log->execute([
            ':machine_id'  => $machineId,
            ':column_num'  => $col,
            ':type'        => 'inventory_count',
            ':before'      => $before,
            ':after'       => $qty,
            ':change'      => $qty - $before,
            ':note'        => $body['note'] ?? null,
        ]);
    }
    jsonResponse(['success' => true]);
}

// ── Single slot adjustment ────────────────────────────────────────────────────
$col  = trim($body['column_num'] ?? '');
$qty  = max(0, (int) ($body['qty'] ?? 0));
$note = $body['note'] ?? null;

if ($col === '') {
    jsonError('column_num required', 400);
}

$getBefore->execute([':machine_id' => $machineId, ':column_num' => $col]);
$before = (int) ($getBefore->fetchColumn() ?: 0);

$upsert->execute([':machine_id' => $machineId, ':column_num' => $col, ':qty' => $qty]);
$log->execute([
    ':machine_id'  => $machineId,
    ':column_num'  => $col,
    ':type'        => 'manual_adjust',
    ':before'      => $before,
    ':after'       => $qty,
    ':change'      => $qty - $before,
    ':note'        => $note,
]);

jsonResponse(['success' => true, 'qty' => $qty]);
