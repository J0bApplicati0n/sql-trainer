DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS clients;

CREATE TABLE clients (
    client_id INTEGER PRIMARY KEY,
    client_name TEXT,
    country TEXT,
    risk_level TEXT
);

CREATE TABLE transactions (
    transaction_id INTEGER PRIMARY KEY,
    client_id INTEGER,
    amount REAL,
    status TEXT,
    device_id TEXT,
    transaction_date TEXT
);

INSERT INTO clients (client_id, client_name, country, risk_level) VALUES
(1, 'Alex', 'Russia', 'low'),
(2, 'Maria', 'Russia', 'medium'),
(3, 'John', 'USA', 'high'),
(4, 'Anna', 'Germany', 'low'),
(5, 'David', 'UK', NULL),
(6, 'Sofia', 'Spain', 'medium');

INSERT INTO transactions
(transaction_id, client_id, amount, status, device_id, transaction_date)
VALUES
(101, 1, 1500.00, 'approved', 'dev_1', '2026-10-01'),
(102, 1, 70000.00, 'declined', 'dev_2', '2026-10-02'),
(103, 2, 3500.00, 'approved', 'dev_3', '2026-10-02'),
(104, 2, 120000.00, 'declined', NULL, '2026-10-03'),
(105, 3, 90000.00, 'declined', 'dev_4', '2026-10-04'),
(106, 3, 500.00, 'approved', 'dev_4', '2026-10-04'),
(107, 4, 8500.00, 'approved', NULL, '2026-10-05'),
(108, 4, 15000.00, 'approved', 'dev_5', '2026-10-06'),
(109, 2, 45000.00, 'declined', 'dev_6', '2026-10-07'),
(110, 1, 2000.00, 'approved', 'dev_1', '2026-10-07'),
(111, 99, 30000.00, 'declined', 'dev_unknown', '2026-10-08'),
(112, 3, 250000.00, 'declined', NULL, '2026-10-09');