#!/usr/bin/env bash
# Backup PostgreSQL Suryamas ERP — jalankan DI VPS (bukan di Mac lokal).
#
# Kredensial: otomatis dari /var/www/suryamas/backend/.env (DATABASE_URL),
# atau fallback INFRASTRUCTURE.md (user suryamas, port 5432).
#
# Setup sekali:
#   mkdir -p /var/backups/suryamas
#   cp /var/www/suryamas/backend/database/scripts/backup-vps-database.sh /root/backup-suryamas-db.sh
#   chmod +x /root/backup-suryamas-db.sh
#
# Manual:
#   /root/backup-suryamas-db.sh
#
# Cron (setiap hari 02:00):
#   0 2 * * * /root/backup-suryamas-db.sh >> /var/log/suryamas-db-backup.log 2>&1
#
# Download ke Mac (terminal lokal, bukan SSH):
#   scp root@65.108.60.217:/var/backups/suryamas/suryamas_db_LATEST.sql.gz ~/Downloads/

set -euo pipefail

_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${_script_dir}/vps-db-credentials.sh" ]]; then
  # shellcheck source=./vps-db-credentials.sh
  source "${_script_dir}/vps-db-credentials.sh"
elif [[ -f /var/www/suryamas/backend/database/scripts/vps-db-credentials.sh ]]; then
  # shellcheck source=/var/www/suryamas/backend/database/scripts/vps-db-credentials.sh
  source /var/www/suryamas/backend/database/scripts/vps-db-credentials.sh
else
  echo "ERROR: vps-db-credentials.sh tidak ditemukan." >&2
  exit 1
fi

load_vps_db_credentials

BACKUP_DIR="${BACKUP_DIR:-/var/backups/suryamas}"
DB_NAME="${PGDATABASE:-suryamas_db}"
DB_USER="${PGUSER:-suryamas}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${BACKUP_DIR}/suryamas_db_${STAMP}.sql.gz"
LATEST_LINK="${BACKUP_DIR}/suryamas_db_LATEST.sql.gz"
MIN_BYTES="${MIN_BYTES:-100000}"

echo "[$(date -Iseconds)] Backup ${DB_NAME}@${DB_HOST}:${DB_PORT} (user ${DB_USER}) → ${OUT_FILE}"

pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  | gzip -9 > "$OUT_FILE"

if [[ ! -s "$OUT_FILE" ]] || [[ "$(stat -c%s "$OUT_FILE" 2>/dev/null || stat -f%z "$OUT_FILE")" -lt "$MIN_BYTES" ]]; then
  rm -f "$OUT_FILE"
  echo "ERROR: Backup terlalu kecil — cek password/port (harus ~MB, bukan puluhan byte)." >&2
  exit 1
fi

ln -sf "$(basename "$OUT_FILE")" "$LATEST_LINK"

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "[$(date -Iseconds)] Selesai (${SIZE}). Symlink: ${LATEST_LINK}"

find "$BACKUP_DIR" -maxdepth 1 -name 'suryamas_db_*.sql.gz' ! -name 'suryamas_db_LATEST.sql.gz' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

echo "[$(date -Iseconds)] Retensi: file > ${RETENTION_DAYS} hari dihapus."
