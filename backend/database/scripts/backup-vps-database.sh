#!/usr/bin/env bash
# Backup PostgreSQL Suryamas ERP — jalankan DI VPS (bukan di Mac lokal).
#
# Setup sekali:
#   sudo mkdir -p /var/backups/suryamas
#   sudo cp backup-vps-database.sh /root/backup-suryamas-db.sh
#   sudo chmod +x /root/backup-suryamas-db.sh
#
# Manual:
#   PGPASSWORD='...' /root/backup-suryamas-db.sh
#   # atau export PGPASSWORD dari /var/www/suryamas/backend/.env
#
# Cron (setiap hari 02:00):
#   0 2 * * * PGPASSWORD='...' /root/backup-suryamas-db.sh >> /var/log/suryamas-db-backup.log 2>&1
#
# Download ke laptop:
#   scp root@65.108.60.217:/var/backups/suryamas/suryamas_db_LATEST.sql.gz ~/Downloads/

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/suryamas}"
DB_NAME="${PGDATABASE:-suryamas_db}"
DB_USER="${PGUSER:-suryamas}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "ERROR: Set PGPASSWORD (password user PostgreSQL 'suryamas')." >&2
  echo "  Contoh: PGPASSWORD='...' $0" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${BACKUP_DIR}/suryamas_db_${STAMP}.sql.gz"
LATEST_LINK="${BACKUP_DIR}/suryamas_db_LATEST.sql.gz"

echo "[$(date -Iseconds)] Backup ${DB_NAME} → ${OUT_FILE}"

pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  | gzip -9 > "$OUT_FILE"

ln -sf "$(basename "$OUT_FILE")" "$LATEST_LINK"

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "[$(date -Iseconds)] Selesai (${SIZE}). Symlink: ${LATEST_LINK}"

# Hapus backup lebih lama dari RETENTION_DAYS
find "$BACKUP_DIR" -maxdepth 1 -name 'suryamas_db_*.sql.gz' ! -name 'suryamas_db_LATEST.sql.gz' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

echo "[$(date -Iseconds)] Retensi: file > ${RETENTION_DAYS} hari dihapus."
