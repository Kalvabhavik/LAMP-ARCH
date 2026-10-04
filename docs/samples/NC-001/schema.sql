-- NC-001: nexacore database, dedicated user (least privilege), users table.
CREATE DATABASE IF NOT EXISTS nexacore
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'nexa_app'@'localhost' IDENTIFIED BY 'change-me-in-vault';
GRANT SELECT, INSERT, UPDATE ON nexacore.* TO 'nexa_app'@'localhost';
FLUSH PRIVILEGES;

USE nexacore;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
