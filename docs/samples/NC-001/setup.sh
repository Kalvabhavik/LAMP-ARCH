#!/usr/bin/env bash
# NexaCore — NC-001 production LAMP deployment (Ubuntu 24.04)
set -euo pipefail

sudo apt update && sudo apt upgrade -y
sudo apt install -y apache2 php libapache2-mod-php php-mysql mariadb-server certbot python3-certbot-apache

# Enable the Apache modules the app needs
sudo a2enmod rewrite headers ssl

# Deploy the application and the virtual host
sudo mkdir -p /var/www/nexacore/public /var/backups/nexacore
sudo cp login.php config.php /var/www/nexacore/public/
sudo cp nexacore.conf /etc/apache2/sites-available/nexacore.conf
sudo cp php-overrides.ini /etc/php/8.3/apache2/conf.d/99-nexacore.ini

# Web root ownership and permissions
sudo chown -R www-data:www-data /var/www/nexacore
sudo find /var/www/nexacore -type d -exec chmod 755 {} \;
sudo find /var/www/nexacore -type f -exec chmod 644 {} \;

# Enable the site and reload
sudo a2ensite nexacore.conf
sudo a2dissite 000-default.conf
sudo systemctl reload apache2

# Database schema (dedicated least-privilege user)
sudo mysql < schema.sql

# Firewall: only SSH, HTTP and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Apache Full'
sudo ufw --force enable

# Backup schedule: nightly mysqldump via cron
sudo cp backup.sh /usr/local/bin/backup-nexacore.sh
sudo chmod +x /usr/local/bin/backup-nexacore.sh
echo "0 2 * * * root /usr/local/bin/backup-nexacore.sh" | sudo tee /etc/cron.d/nexacore-backup
