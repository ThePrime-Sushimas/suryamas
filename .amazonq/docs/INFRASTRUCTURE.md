# Suryamas ERP — Infrastructure & Deployment Guide

## Server
- **Provider**: Hetzner Cloud
- **IP**: 65.108.60.217
- **OS**: Ubuntu 24.04 LTS
- **SSH**: `ssh root@65.108.60.217`
- **Hetzner Console**: https://console.hetzner.com/projects/14361746

## Stack (sudah terinstall)
| Component | Version |
|-----------|---------|
| Node.js | v22.22.2 |
| PostgreSQL | 17.9 |
| Nginx | 1.24.0 |
| PM2 | 6.0.14 |
| Certbot | 2.9.0 |
| Git | 2.43.0 |

## Database
- **Host**: 65.108.60.217 (port 5432)
- **Database**: suryamas_db
- **User**: suryamas
- **Password**: Paulus20june
- **Akses dari lokal**: Via SSH tunnel (JANGAN buka port 5432 di firewall)

### SSH Tunnel
```bash
# Jalankan setelah restart komputer (atau ketik: tunnel)
ssh -f -N -L 5433:localhost:5432 -L 5050:localhost:5050 root@65.108.60.217
```
- Port 5433 → PostgreSQL
- Port 5050 → pgAdmin

### Shortcut (sudah di ~/.zshrc)
```bash
tunnel  # otomatis buat SSH tunnel DB + pgAdmin
```

### DATABASE_URL di .env
```
DATABASE_URL=postgresql://suryamas:Paulus20june@localhost:5433/suryamas_db
```

## Firewall (Hetzner)
| Port | Protocol | Source | Keterangan |
|------|----------|-------|------------|
| 22 | TCP | Any | SSH |
| 80 | TCP | Any | HTTP |
| 443 | TCP | Any | HTTPS |
| 5432 | ❌ | CLOSED | DB via tunnel saja |
| 5050 | ❌ | CLOSED | pgAdmin via tunnel saja |

## Domain
- **DuckDNS**: sushimas.duckdns.org → 65.108.60.217

## Storage
- **Cloudflare R2** (S3-compatible)
- Account ID: 0247835e12ab230d40216cf40c965c98
- Buckets: buktisetoran, posimportstemp, jobresults, profilepictures, bankstatementimportstemp
- **PENTING**: S3Client harus pakai `forcePathStyle: true`

## Monitoring & Alerts
- **Error Logs**: Tabel `error_logs` di PostgreSQL
- **Dashboard**: http://localhost:5173/monitoring
- **Telegram Bot**: SIS Alert (@SIS_Emergency_Bot)
  - Token: 8598592104:AAE4biuIr9QdiqKgQpf5v8L3xDRQ9lO9RT4
  - Chat ID: -5202987932 (Group: Sushimas Monitoring)
  - Semua error otomatis dikirim ke Telegram (rate limit 10 detik)

## Migrasi dari Supabase
- **Status**: ✅ Selesai (29 Apr 2026)
- **Supabase lama**: kxymzveitlrsyzjakzjl.supabase.co (masih aktif sebagai backup)
- Database sudah 100% identical: tables, views, functions, enums, triggers, sequences, indexes, foreign keys
- `auth.users` (Supabase) → `public.auth_users` (Hetzner) — semua FK sudah di-remap

## Permission Modules (perm_modules)
Laporan keuangan punya permission terpisah:
| Module | Keterangan |
|--------|-----------|
| journals | Jurnal |
| trial_balance | Neraca Saldo |
| income_statement | Laba Rugi |
| balance_sheet | Neraca |

## Catatan Penting
1. Sebelum dev, pastikan SSH tunnel aktif (`tunnel`)
2. Setelah ubah backend, rebuild: `cd backend && npx tsc`
3. Error dari controller pakai `handleError(res, error, req)` — SELALU pass `req`
4. Semua error otomatis persist ke `error_logs` + kirim Telegram
5. Job failures juga persist ke `error_logs` (via jobs.worker.ts)

## Auto Deploy (GitHub Actions)
- **Flow**: Push ke `main` → GitHub Actions SSH ke VPS → `/root/deploy.sh`
- **Workflow**: `.github/workflows/deploy.yml`
- **Deploy script**: `/root/deploy.sh` (git pull, npm install, build, pm2 restart)
- **Secrets** (di GitHub repo settings): `SSH_HOST`, `SSH_USERNAME`, `SSH_PRIVATE_KEY`

### Manual Deploy (jika Actions gagal)
```bash
ssh root@65.108.60.217
/root/deploy.sh
```
