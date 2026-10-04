#!/usr/bin/env bash
# Nightly nexacore database backup. Scheduled via /etc/cron.d/nexacore-backup.
set -euo pipefail
DEST=/var/backups/nexacore
mkdir -p "$DEST"
mysqldump --single-transaction nexacore | gzip > "$DEST/nexacore-$(date +%F).sql.gz"
find "$DEST" -name 'nexacore-*.sql.gz' -mtime +14 -delete
