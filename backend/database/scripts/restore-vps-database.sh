#!/usr/bin/env bash
# Restore PostgreSQL dari file .sql.gz (pg_dump plain SQL).
# PERINGATAN: Menimpa data di database target. Hentikan backend dulu (pm2 stop suryamas-backend).
#
# Usage:
#   PGPASSWORD='...' ./restore-vps-database.sh /var/backups/suryamas/suryamas_db_20260525_020000.sql.gz

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: PGPASSWORD='...' $0 <backup.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
DB_NAME="${PGDATABASE:-suryamas_db}"
DB_USER="${PGUSER:-suryamas}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "File tidak ditemukan: $BACKUP_FILE" >&2
  exit 1
fi

if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "ERROR: Set PGPASSWORD." >&2
  exit 1
fi

echo "Restore ${BACKUP_FILE} → ${DB_NAME} (user ${DB_USER})"
read -r -p "Ketik YES untuk lanjut: " CONFIRM
if [[ "$CONFIRM" != "YES" ]]; then
  echo "Dibatalkan."
  exit 0
fi

gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1

echo "Restore selesai."
