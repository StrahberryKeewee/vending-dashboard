-- Vending Machine Dashboard - Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS vending_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vending_db;

CREATE TABLE IF NOT EXISTS machines (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    machine_id    VARCHAR(50)  NOT NULL UNIQUE,
    location      VARCHAR(255) NOT NULL,
    building      VARCHAR(100),
    floor         VARCHAR(50),
    status        ENUM('active', 'inactive', 'maintenance') NOT NULL DEFAULT 'active',
    installed_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    sku      VARCHAR(50)  NOT NULL UNIQUE,
    name     VARCHAR(100) NOT NULL,
    category ENUM('beverages', 'snacks', 'candy', 'healthy') NOT NULL,
    price    DECIMAL(10, 2) NOT NULL,
    INDEX idx_category (category)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    machine_id    VARCHAR(50)    NOT NULL,
    product_id    INT,
    quantity      SMALLINT       NOT NULL DEFAULT 1,
    amount        DECIMAL(10, 2) NOT NULL,
    sale_time     TIMESTAMP      NOT NULL,
    sqs_message_id VARCHAR(255),
    ingested_at   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id)  REFERENCES machines(machine_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_sale_time   (sale_time),
    INDEX idx_machine_id  (machine_id),
    INDEX idx_product_id  (product_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS feedback (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    machine_id       VARCHAR(50),
    location         VARCHAR(255)  NOT NULL,
    rating           TINYINT       NOT NULL,
    comments         TEXT,
    items_purchased  JSON,
    suggestions      TEXT,
    submitted_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),
    INDEX idx_submitted_at (submitted_at),
    INDEX idx_machine_id   (machine_id),
    INDEX idx_rating       (rating)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS machine_columns (
    id           INT          NOT NULL AUTO_INCREMENT,
    machine_id   VARCHAR(50)  NOT NULL,
    column_num   VARCHAR(10)  NOT NULL,
    product_sku  VARCHAR(50)  NOT NULL,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_machine_col (machine_id, column_num),
    FOREIGN KEY (machine_id)  REFERENCES machines(machine_id)  ON DELETE CASCADE,
    FOREIGN KEY (product_sku) REFERENCES products(sku)         ON DELETE CASCADE,
    INDEX idx_machine_id (machine_id)
) ENGINE=InnoDB;

-- Seed: machines
INSERT INTO machines (machine_id, location, building, floor) VALUES
  ('VK200078417', 'The Union at Dearborn', 'The Union', '1st Floor');

-- Seed: products
INSERT INTO products (sku, name, category, price) VALUES
  ('BEV-001', 'Coca Cola',        'beverages', 1.75),
  ('BEV-002', 'Pepsi',            'beverages', 1.75),
  ('BEV-003', 'Sprite',           'beverages', 1.75),
  ('BEV-004', 'Water',            'beverages', 1.25),
  ('BEV-005', 'Orange Juice',     'beverages', 2.25),
  ('SNK-001', 'Chips',            'snacks',    1.50),
  ('SNK-002', 'Pretzels',         'snacks',    1.50),
  ('SNK-003', 'Crackers',         'snacks',    1.75),
  ('SNK-004', 'Popcorn',          'snacks',    1.25),
  ('CND-001', 'Snickers Bar',     'candy',     1.50),
  ('CND-002', 'M&Ms',             'candy',     1.75),
  ('CND-003', 'Kit Kat',          'candy',     1.50),
  ('HLT-001', 'Granola Bar',      'healthy',   2.00),
  ('HLT-002', 'Trail Mix',        'healthy',   2.25),
  ('HLT-003', 'Fruit Cup',        'healthy',   2.50);

-- Seed: sales data (simulate ~4 weeks of data)
INSERT INTO sales (machine_id, product_id, quantity, amount, sale_time, sqs_message_id) VALUES
  ('VM001', 1,  2, 3.50,  '2026-03-25 09:15:00', 'msg-seed-001'),
  ('VM001', 6,  1, 1.50,  '2026-03-25 10:30:00', 'msg-seed-002'),
  ('VM002', 10, 3, 4.50,  '2026-03-25 11:00:00', 'msg-seed-003'),
  ('VM003', 3,  1, 1.75,  '2026-03-25 12:45:00', 'msg-seed-004'),
  ('VM001', 13, 2, 4.00,  '2026-03-26 08:20:00', 'msg-seed-005'),
  ('VM004', 2,  1, 1.75,  '2026-03-26 09:00:00', 'msg-seed-006'),
  ('VM002', 7,  2, 3.00,  '2026-03-27 14:00:00', 'msg-seed-007'),
  ('VM005', 11, 1, 1.75,  '2026-03-27 15:30:00', 'msg-seed-008'),
  ('VM001', 4,  3, 3.75,  '2026-03-28 11:15:00', 'msg-seed-009'),
  ('VM003', 14, 1, 2.25,  '2026-03-29 10:00:00', 'msg-seed-010'),
  ('VM002', 1,  2, 3.50,  '2026-04-01 09:30:00', 'msg-seed-011'),
  ('VM001', 6,  4, 6.00,  '2026-04-01 10:45:00', 'msg-seed-012'),
  ('VM004', 10, 2, 3.00,  '2026-04-02 13:00:00', 'msg-seed-013'),
  ('VM003', 3,  1, 1.75,  '2026-04-02 14:30:00', 'msg-seed-014'),
  ('VM005', 15, 2, 5.00,  '2026-04-03 09:00:00', 'msg-seed-015'),
  ('VM001', 5,  3, 6.75,  '2026-04-04 11:00:00', 'msg-seed-016'),
  ('VM002', 12, 2, 3.00,  '2026-04-05 12:00:00', 'msg-seed-017'),
  ('VM001', 1,  5, 8.75,  '2026-04-08 09:15:00', 'msg-seed-018'),
  ('VM003', 8,  3, 5.25,  '2026-04-08 10:30:00', 'msg-seed-019'),
  ('VM002', 13, 2, 4.00,  '2026-04-09 11:00:00', 'msg-seed-020'),
  ('VM004', 6,  4, 6.00,  '2026-04-10 13:30:00', 'msg-seed-021'),
  ('VM005', 2,  2, 3.50,  '2026-04-11 14:00:00', 'msg-seed-022'),
  ('VM001', 9,  3, 3.75,  '2026-04-12 10:00:00', 'msg-seed-023'),
  ('VM003', 11, 4, 7.00,  '2026-04-15 09:00:00', 'msg-seed-024'),
  ('VM002', 4,  5, 6.25,  '2026-04-15 10:15:00', 'msg-seed-025'),
  ('VM001', 14, 2, 4.50,  '2026-04-16 11:30:00', 'msg-seed-026'),
  ('VM004', 3,  3, 5.25,  '2026-04-16 12:00:00', 'msg-seed-027'),
  ('VM005', 10, 4, 6.00,  '2026-04-17 08:45:00', 'msg-seed-028');

-- Seed: feedback
INSERT INTO feedback (machine_id, location, rating, comments, items_purchased, suggestions, submitted_at) VALUES
  ('VM001', 'Building A - Lobby',     5, 'Great selection and fresh products!',          '["Coca Cola"]',           'More healthy snack options', '2026-04-16 10:00:00'),
  ('VM002', 'Building B - 2nd Floor', 4, 'Machine works well, could use more variety',   '["Chips"]',               'Add energy drinks',          '2026-04-16 11:30:00'),
  ('VM003', 'Building C - Cafeteria', 5, 'Convenient and fast service',                  '["Snickers Bar"]',        NULL,                         '2026-04-16 13:00:00'),
  ('VM004', 'Building A - 3rd Floor', 3, 'Sometimes out of stock on popular items',      '["Sprite"]',              'Stock more popular drinks',  '2026-04-16 14:45:00'),
  ('VM005', 'Building D - Break Room',4, 'Good variety but prices are a bit high',       '["Water","Granola Bar"]', 'Lower prices on water',      '2026-04-17 09:00:00');
