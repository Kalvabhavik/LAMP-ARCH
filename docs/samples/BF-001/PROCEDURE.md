# BF-001 — Deploy a Student Portal: Procedure

## Objective

Deploy a working LAMP environment on a fresh Linux server and deliver a PHP
page served by Apache that lists students stored in a MariaDB database for
Riverside Community College.

## Environment

Ubuntu 24.04 LTS server with a sudo-capable user. Required packages:
apache2, php, libapache2-mod-php, php-mysql and mariadb-server. The web root is
`/var/www/html` and the database listens on localhost only.

## Installation

I prepared the system and installed the full LAMP stack:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y apache2 php libapache2-mod-php php-mysql mariadb-server
sudo systemctl enable --now apache2
sudo systemctl enable --now mariadb
```

## Configuration

Apache serves the portal from the default site with `DocumentRoot /var/www/html`.
I copied `index.php` into `/var/www/html` and reloaded Apache with
`sudo systemctl reload apache2`. No virtual host changes were needed because the
default site already points at the web root.

## Implementation

I created the database `student_portal` and a `students` table:

```sql
CREATE DATABASE student_portal;
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(150),
  course VARCHAR(100)
);
```

I also created a dedicated user instead of connecting as root:
`CREATE USER 'portal_user'@'localhost' IDENTIFIED BY '...';` and granted only
the privileges the app needs on `student_portal.*`.

The `index.php` page opens a mysqli connection
(`new mysqli('localhost', 'portal_user', '...', 'student_portal')`), runs
`SELECT id, name, email, course FROM students` and renders each row with
`fetch_assoc()` inside an HTML table.

## Testing

I verified the deployment with `curl http://localhost/index.php`, which returned
the HTML table containing all seeded students. I also opened the page in a
browser to confirm Apache serves PHP correctly.

## Problems encountered

The first `curl` returned a PHP fatal error because `php-mysql` was not
installed, so `mysqli` did not exist. MariaDB also refused the application login
until I flushed privileges.

## Solutions

I installed `php-mysql` and restarted Apache, then ran `FLUSH PRIVILEGES;`
after creating `portal_user`. Both issues disappeared after that.

## Final result

The portal is live through Apache at `http://localhost/index.php` and lists all
students from the `students` table using a least-privilege database account.
