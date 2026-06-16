-- Inventory tracking tables
-- Run once on RDS: mysql -h <host> -u <user> -p vending_db < add_inventory.sql

CREATE TABLE IF NOT EXISTS machine_inventory (
    id          INT          NOT NULL AUTO_INCREMENT,
    machine_id  VARCHAR(50)  NOT NULL,
    column_num  VARCHAR(10)  NOT NULL,
    current_qty INT          NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_inv_machine_col (machine_id, column_num),
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_logs (
    id          INT          NOT NULL AUTO_INCREMENT,
    machine_id  VARCHAR(50)  NOT NULL,
    column_num  VARCHAR(10)  NOT NULL,
    change_type ENUM('sale','manual_adjust','inventory_count') NOT NULL,
    qty_before  INT          NOT NULL,
    qty_after   INT          NOT NULL,
    qty_change  INT          NOT NULL,
    note        VARCHAR(255),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_machine_id (machine_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Note: inventory auto-decrement is handled in sqs_consumer.php (avoids RDS SUPER privilege requirement)
