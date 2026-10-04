#!/usr/bin/env bash
# ByteForge Solutions — BF-001 Student Portal server setup (Ubuntu 24.04)
set -euo pipefail

# 1. Prepare the Linux environment
sudo apt update && sudo apt upgrade -y

# 2. Install Apache, PHP and MariaDB
sudo apt install -y apache2 php libapache2-mod-php php-mysql mariadb-server

# 3. Start and enable the services
sudo systemctl enable --now apache2
sudo systemctl enable --now mariadb

# 4. Load the database schema and seed data
sudo mysql < schema.sql

# 5. Deploy the PHP page through Apache
sudo cp index.php /var/www/html/index.php
sudo chown www-data:www-data /var/www/html/index.php
sudo systemctl reload apache2

# 6. Verify
curl -s http://localhost/index.php | grep -i student
