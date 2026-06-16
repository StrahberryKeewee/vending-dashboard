-- Add slot capacity and machine data-connectivity flag
-- Run on RDS: mysql -h <host> -u <user> -p vending_db < add_capacity.sql

ALTER TABLE machine_columns ADD COLUMN capacity INT DEFAULT NULL;

ALTER TABLE machines ADD COLUMN has_data TINYINT(1) NOT NULL DEFAULT 0;

-- Mark VK200078417 as SeedLive-connected (auto sale ingestion via SQS)
UPDATE machines SET has_data = 1 WHERE machine_id = 'VK200078417';
