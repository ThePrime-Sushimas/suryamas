# Shared DB credentials for VPS backup/restore scripts.
# shellcheck shell=bash

# Loads PGPASSWORD, PGUSER, PGHOST, PGPORT, PGDATABASE when PGPASSWORD is unset.
# Order: existing env → backend/.env DATABASE_URL → INFRASTRUCTURE defaults (VPS).
load_vps_db_credentials() {
  if [[ -n "${PGPASSWORD:-}" ]]; then
    return 0
  fi

  local env_file="${ENV_FILE:-/var/www/suryamas/backend/.env}"

  if [[ -f "$env_file" ]]; then
    local url
    url="$(grep -E '^DATABASE_URL=' "$env_file" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")"
    if [[ -n "$url" ]] && _parse_database_url "$url"; then
      _normalize_vps_db_port
      export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
      return 0
    fi
  fi

  PGUSER="${PGUSER:-suryamas}"
  PGPASSWORD="${PGPASSWORD:-Paulus20june}"
  PGHOST="${PGHOST:-localhost}"
  PGPORT="${PGPORT:-5432}"
  PGDATABASE="${PGDATABASE:-suryamas_db}"
  export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
}

_parse_database_url() {
  local url="$1"
  url="${url%%\?*}"

  if [[ "$url" =~ ^postgresql://([^:@/]+):([^@]+)@([^:/]+)(:([0-9]+))?/(.+)$ ]]; then
    PGUSER="${BASH_REMATCH[1]}"
    PGPASSWORD="${BASH_REMATCH[2]}"
    PGHOST="${BASH_REMATCH[3]}"
    PGPORT="${BASH_REMATCH[5]:-5432}"
    PGDATABASE="${BASH_REMATCH[6]}"
    return 0
  fi

  echo "ERROR: DATABASE_URL tidak valid di ${ENV_FILE:-/var/www/suryamas/backend/.env}" >&2
  return 1
}

# .env lokal pakai port 5433 (SSH tunnel); di VPS PostgreSQL listen 5432.
_normalize_vps_db_port() {
  if [[ "${PGHOST}" == "localhost" || "${PGHOST}" == "127.0.0.1" ]] && [[ "${PGPORT}" == "5433" ]]; then
    PGPORT="5432"
  fi
}
