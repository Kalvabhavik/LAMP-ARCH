-- BF-001: student_portal database and students table
CREATE DATABASE IF NOT EXISTS student_portal
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'portal_user'@'localhost' IDENTIFIED BY 's3cureP@ss';
GRANT SELECT, INSERT, UPDATE ON student_portal.* TO 'portal_user'@'localhost';
FLUSH PRIVILEGES;

USE student_portal;

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  course VARCHAR(100) NOT NULL
);

INSERT INTO students (name, email, course) VALUES
  ('Ada Lovelace',  'ada@riverside.edu',  'Mathematics'),
  ('Alan Turing',   'alan@riverside.edu', 'Computer Science'),
  ('Grace Hopper',  'grace@riverside.edu','Programming');
