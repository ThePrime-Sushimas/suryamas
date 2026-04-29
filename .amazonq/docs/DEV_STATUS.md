# Suryamas ERP — Development Status

## ✅ Selesai
### Infrastruktur
- [x] Migrasi Supabase → Hetzner (DB, functions, triggers, views, FK)
- [x] SSH tunnel setup (DB + pgAdmin)
- [x] Cloudflare R2 storage (forcePathStyle fix)
- [x] Error monitoring (error_logs + Telegram alerts)
- [x] Job system (5 atomic functions created)

### Laporan Keuangan
- [x] Trial Balance (`/accounting/trial-balance`)
- [x] Laba Rugi / Income Statement (`/accounting/income-statement`)
  - Grouping by parent COA hierarchy (bukan hardcoded subtype)
  - Compare period support
  - Export CSV
- [x] Neraca / Balance Sheet (`/accounting/balance-sheet`) — backend done, frontend page created
  - Retained earnings dari P&L (company-level, bukan per-branch)
  - Compare period support

### Monitoring
- [x] Error persist ke DB dari semua path (error middleware + handleError utility + job worker)
- [x] Telegram webhook notification (semua severity)
- [x] Error trend chart (30 hari)
- [x] Recurring errors grouped list
- [x] User name lookup di error logs (bukan UUID)

### UI/UX Fixes
- [x] Sales Dashboard layout & cards
- [x] POS Staging dark mode
- [x] Chart of Accounts dropdown positioning
- [x] Balance Sheet page (SECTION_COLORS fix pending)

## 🔧 Pending Fixes (Balance Sheet)
- [ ] Dynamic Tailwind classes → SECTION_COLORS literal mapping
- [ ] CSV escaping (shared util sudah dibuat di `src/utils/csv.utils.ts`)
- [ ] Generic error message untuk 500 di frontend

## 📋 Backlog
- [ ] PO Flow (Purchase Order → Receiving → AP → Payment → Auto Journal)
- [ ] COGS calculation
- [ ] Laporan Arus Kas (Cash Flow Statement) — module sudah ada, perlu review
- [ ] User Management — create account dari UI (backend POST /auth/register sudah ada)
- [ ] Deploy ke production (Nginx config, PM2, SSL via Certbot)

## 📝 Coding Conventions (Learned)
1. Jangan hardcode labels — pakai data dari DB/COA hierarchy
2. Jangan Math.abs untuk kalkulasi — pakai helper per account type (debit-credit vs credit-debit)
3. Jangan mutable variable di render (let rowNum) — hitung di function sebelum render
4. colSpan pakai konstanta, bukan angka hardcode
5. company_id dari context, bukan query param
6. Schema validation: cross-validate compare periods, UUID regex untuk branch_ids
7. Custom error class harus dipakai, bukan generic Error
8. fmt(0) di total row pakai showZero=true
9. handleError(res, error, req) — SELALU pass req untuk monitoring
10. Setelah ubah .ts, rebuild dist: npx tsc
