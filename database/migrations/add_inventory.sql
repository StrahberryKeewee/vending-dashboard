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

-- Auto-decrement inventory when a sale is inserted (data machines only)
DROP TRIGGER IF EXISTS trg_sale_decrement_inventory;

DELIMITER //

CREATE TRIGGER trg_sale_decrement_inventory
AFTER INSERT ON sales
FOR EACH ROW
BEGIN
    DECLARE v_before INT DEFAULT 0;
    DECLARE v_after  INT DEFAULT 0;

    IF NEW.vend_column IS NOT NULL THEN
        SELECT current_qty INTO v_before
        FROM   machine_inventory
        WHERE  machine_id = NEW.machine_id
          AND  column_num = NEW.vend_column
        LIMIT 1;

        IF v_before IS NOT NULL THEN
            SET v_after = GREATEST(v_before - NEW.quantity, 0);

            UPDATE machine_inventory
            SET    current_qty = v_after
            WHERE  machine_id  = NEW.machine_id
              AND  column_num  = NEW.vend_column;

            INSERT INTO inventory_logs
                (machine_id, column_num, change_type, qty_before, qty_after, qty_change, note)
            VALUES
                (NEW.machine_id, NEW.vend_column, 'sale', v_before, v_after, -(v_before - v_after), 'Auto from sale');
        END IF;
    END IF;
END //

DELIMITER ;
