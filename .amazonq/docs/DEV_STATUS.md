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
- [x] Neraca / Balance Sheet (`/accounting/balance-sheet`)
  - Retained earnings dari P&L (company-level, bukan per-branch)
  - Compare period support
  - SECTION_COLORS literal mapping (no dynamic Tailwind)
  - CSV escaping via shared `escapeCsv()` util
  - Generic error message untuk 500

### Cash Flow Module
- [x] Period balance CRUD (create, update, delete, list, suggestion)
- [x] Payment method groups (CRUD, reorder, mapping)
- [x] Cash flow daily (running balance + sales breakdown)
- [x] Fix: `closing_balance` summary — query seluruh periode via `getPeriodTotals()`, bukan dari paginated rawRows
- [x] Fix: `opening_balance` schema — hapus `min(0)`, support saldo negatif (overdraft)
- [x] Fix: `reorderGroups` — UNNEST batch query (1 query vs N sequential)

### Monitoring
- [x] Error persist ke DB dari semua path (error middleware + handleError utility + job worker)
- [x] Telegram webhook notification (semua severity)
- [x] Error trend chart (30 hari)
- [x] Recurring errors grouped list
- [x] User name lookup di error logs (bukan UUID)

### UI/UX
- [x] Sales Dashboard layout & cards
- [x] POS Staging dark mode
- [x] Chart of Accounts dropdown positioning
- [x] Login page redesign (dark maroon, SIS logo, kanji, remember me)
- [x] Layout branding (header logo, Gang of Three font)
- [x] Favicon (red bg, gold border, "SIS")
- [x] Toast notifications — 86 pages with `useToast` (was 72)
  - 13 pages with mutations added toast (accounting, auth, users, reconciliation)
  - ManualEntryPage converted from local toast to global `useToast`
- [x] Zero `alert()` — 3 files migrated to `toast.success/error/warning`
- [x] Zero `confirm()` — 12 locations in 10 files migrated to `ConfirmModal`
  - CashCounts, PosStaging, PosSyncAggregates, BankReconciliation, Monitoring,
    Permissions, FailedTransactions, ProductUoms, Users, FeeDiscrepancy, JournalHeadersDeleted

## 📋 Backlog
- [ ] PO Flow (Purchase Order → Receiving → AP → Payment → Auto Journal)
- [ ] COGS calculation (HPP dari inventory movement)
- [ ] Laporan Arus Kas formal PSAK 2 (3 aktivitas: operasi/investasi/pendanaan)
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
11. Tailwind JIT: JANGAN dynamic class — pakai object mapping literal (SECTION_COLORS pattern)
12. CSV export: pakai `escapeCsv()` dari `src/utils/csv.utils.ts`
13. Error 500 di frontend: tampilkan pesan generik, bukan detail teknis
14. Toast: pakai global `useToast` dari `@/contexts/ToastContext`, bukan local state/alert
15. Confirm: pakai `ConfirmModal` component, bukan native `confirm()`
16. Repository: jangan wrap try/catch kalau tidak ada transformasi error meaningful — biarkan bubble up
17. Summary/totals: query terpisah untuk seluruh periode, jangan hitung dari paginated rows
