# NC-001 — Production LAMP Deployment: Procedure

## Objective

Deploy the NexaCore Employee Portal — a PHP application with user login — on a
fresh production Linux server with a hardened, security-reviewed LAMP stack.

## Environment

Ubuntu 24.04 LTS production server. The application lives in
`/var/www/nexacore/public`, Apache logs go to `${APACHE_LOG_DIR}`, certificates
are under `/etc/ssl`, and nightly database backups are written to
`/var/backups/nexacore`.

## Installation

I updated the system and installed the full stack plus certbot:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y apache2 php libapache2-mod-php php-mysql mariadb-server \
  certbot python3-certbot-apache
sudo systemctl enable --now apache2 mariadb
```

## Configuration

I created a dedicated virtual host `nexacore.conf` in
`/etc/apache2/sites-available/` with `<VirtualHost *:443>`, a ServerName,
DocumentRoot, `ErrorLog` and `CustomLog` directives, `SSLEngine on`, and a
`SetEnv` block that injects the database credentials into the PHP environment.
Directory listing is disabled with `Options -Indexes`, and PHP errors are
hidden via `php_admin_flag display_errors off`. I enabled the modules and site
with `sudo a2enmod rewrite headers ssl` and `sudo a2ensite nexacore.conf`, then
disabled the default site and reloaded Apache with `sudo systemctl reload apache2`.

## Implementation

The database schema creates `nexacore`, a dedicated user `nexa_app`, and a
least-privilege grant:

```sql
CREATE USER 'nexa_app'@'localhost' IDENTIFIED BY '...';
GRANT SELECT, INSERT, UPDATE ON nexacore.* TO 'nexa_app'@'localhost';
```

The `users` table holds `id`, `username`, `email` and `password_hash`. In PHP,
`config.php` reads credentials with `getenv('DB_USER')`/`getenv('DB_PASS')` —
nothing is hardcoded. `login.php` uses PDO prepared statements
(`$pdo->prepare('SELECT ... WHERE username = ?')`), verifies passwords with
`password_verify()`, stores them with `password_hash()`, and tracks the
authenticated user with `session_start()` and `$_SESSION`. The database
connection is wrapped in try/catch and errors go to `error_log()`.

## Testing

I verified HTTPS with `curl -k https://portal.nexacore.local/login.php`,
confirmed a valid login creates a session, confirmed wrong passwords are
rejected, and ran `mysqldump` manually once to validate the backup script
output before scheduling it.

## Problems encountered

The first login attempt failed silently because `display_errors` hid a missing
`users` table; the cron entry also initially ran before `/var/backups/nexacore`
existed.

## Solutions

I checked `/var/log/php/nexacore.log` to find the root cause (log errors
instead of displaying them), imported `schema.sql`, and made `backup.sh`
create the destination directory with `mkdir -p` before dumping.

## Final result

The portal is live over HTTPS on a hardened production stack: dedicated vhost
with logging, least-privilege database access, hashed passwords, prepared
statements, locked-down file permissions owned by `www-data`, a UFW firewall
allowing only SSH/HTTP/HTTPS, and a mysqldump backup running nightly via cron.
