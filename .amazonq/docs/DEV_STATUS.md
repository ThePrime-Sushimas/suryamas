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
18. **Pagination + Search/Filter fetch pattern (STANDAR RESMI)**:
    - Store WAJIB punya combined action `fetchPage(page, limit?, ...params)` yang **gabung state update + fetch** dalam satu call. JANGAN pisah `setPage()` + `fetchData()` karena menyebabkan double-fetch.
    - Page component buat satu `doFetch(page, limit?)` callback via `useCallback` yang build filter dari local state lalu panggil store `fetchPage`/`searchPage`.
    - Search/filter berubah → `useEffect` panggil `doFetch(1)` (reset ke page 1). Deps: hanya trigger values (`debouncedSearch`, `statusFilter`, dll), BUKAN store functions.
    - User klik pagination → `handlePageChange` langsung panggil `doFetch(newPage)`. TANPA useEffect, TANPA `setPage` terpisah.
    - User ubah page size → `handleLimitChange` langsung panggil `doFetch(1, newLimit)`.
    - ❌ DILARANG: `setPage()` di satu tempat + `useEffect([pagination.page])` fetch di tempat lain — ini sumber double-fetch.
    - ❌ DILARANG: `skipNextPageEffect` ref atau `isFirstRender` ref sebagai workaround — tanda pattern-nya salah.
    - Contoh reference: `frontend/src/features/products/pages/ProductsPage.tsx`
19. Form error: biarkan parent handle via toast, jangan double display error di form + toast
20. Styling konsisten: `rounded-lg` (bukan `rounded-md`), `border border-gray-200 dark:border-gray-700` untuk card/table
21. Label/message: pakai Bahasa Indonesia untuk UI user-facing, English untuk technical/developer
22. Action buttons di tabel: pakai icon (Eye, Pencil, Trash2), bukan text "Edit" / "Delete"
23. Loading state: pakai skeleton (animate-pulse), bukan text "Loading..."
24. Empty state: pakai icon + pesan informatif, bukan hanya text kosong
25. Error state di list page: tampilkan error card dengan tombol "Coba Lagi", bukan halaman kosong
26. Header page: pakai `ArrowLeft` untuk back navigation, bukan "✕" atau "Back to List" button terpisah
27. (Digabung ke #18 — lihat convention #18 untuk standar resmi pagination + search/filter fetch pattern)
28. Filter di useEffect deps: JANGAN masukkan `filter` object ke useEffect deps kalau body useEffect juga call `setFilter` — infinite loop. Deps hanya untuk trigger value (search, page), bukan untuk state yang di-mutate di body
29. **Express global augmentation** (`backend/src/types/express.d.ts`): Extend `Express.Request` dengan `user`, `validated`, `sort`, `filterParams`, `queryFilter`, `context`, `permissions`. Controller TIDAK PERLU cast `req as any` atau `req as unknown as Request` — langsung pass `req`.
30. **DTO audit fields**: `CreateXxxDto` dan `UpdateXxxDto` WAJIB include `created_by`/`updated_by` agar service layer tidak perlu `as unknown as XxxDto` cast.
31. **FE error extraction**: Semua store WAJIB pakai `parseApiError()` dari `@/lib/errorParser`. DILARANG inline `error instanceof Error ? error.message : '...'` atau `'response' in error`.
32. **handleError signature**: `await handleError(res, error, req, context)` — `req` langsung (tanpa cast berkat express.d.ts), `context` berisi metadata debugging (`{ action, id, query }`).
33. **Repository type safety**: Gunakan `toRecord<T extends object>(obj: T): Record<string, unknown>` helper untuk bulk insert. DILARANG `as any` untuk row mapping.
34. **Postgres error check**: Gunakan `isPostgresError(error, code)` dari `src/utils/postgres-error.util.ts` untuk cek error code PostgreSQL (misal `'23505'` untuk unique violation). DILARANG `(error as { code?: string }).code` — tidak aman jika error bukan object.

## 🔍 Module Compliance Status

Legend: ✅ = comply, ❌ = belum comply, ➖ = N/A

### Backend Controller Compliance

| Module | `await` handleError | No `as any`/`as unknown` | `error: unknown` | `context` param | Express augmentation |
|--------|:---:|:---:|:---:|:---:|:---:|
| branches | ✅ | ✅ | ✅ | ✅ | ✅ |
| categories | ✅ | ✅ | ✅ | ✅ | ✅ |
| suppliers | ✅ | ✅ | ✅ | ✅ | ✅ |
| banks | ✅ | ✅ | ✅ | ✅ | ✅ |
| metric-units | ✅ | ❌ `as unknown` | ✅ | ✅ | ❌ |
| employees | ✅ | ✅ | ✅ | ✅ | ✅ |
| employee_branches | ✅ | ✅ | ✅ | ✅ | ✅ |
| auth | ✅ | ✅ | ✅ | ✅ | ✅ |
| bank-accounts | ✅ | ✅ | ✅ | ✅ | ✅ |
| cash-counts | ✅ | ✅ | ✅ | ✅ | ✅ |
| cash-flow | ✅ | ✅ | ✅ | ✅ | ✅ |
| companies | ✅ | ✅ | ✅ | ✅ | ✅ |
| expense-categorization | ✅ | ✅ | ✅ | ✅ | ✅ |
| payment-methods | ✅ | ✅ | ✅ | ✅ | ✅ |
| payment-terms | ✅ | ✅ | ✅ | ✅ | ✅ |
| permissions | ✅ | ✅ | ✅ | ✅ | ✅ |
| pos-sync | ✅ | ✅ | ✅ | ✅ | ✅ |
| pricelists | ✅ | ✅ | ✅ | ✅ | ✅ |
| product-uoms | ✅ | ✅ | ✅ | ✅ | ✅ |
| products | ✅ | ✅ | ✅ | ✅ | ✅ |
| sub-categories | ✅ | ✅ | ✅ | ✅ | ✅ |
| supplier-products | ✅ | ✅ | ✅ | ✅ | ✅ |
| users | ✅ | ✅ | ✅ | ✅ | ✅ |
| jobs | ✅ | ✅ | ✅ | ✅ | ✅ |
| monitoring | ✅ | ✅ | ✅ | ✅ | ✅ |
| accounting-purposes | ✅ | ❌ 5x `req as any` | ✅ | ✅ | ❌ |
| accounting-purpose-accounts | ✅ | ❌ 5x `req as any` | ✅ | ✅ | ❌ |
| fiscal-periods | ✅ | ❌ 6x `req as any` | ✅ | ✅ | ❌ |
| bank-reconciliation | ✅ | ❌ 3x `validated as any` | ✅ | ✅ | ❌ |
| bank-statement-import | ✅ | ❌ 2x `req as any` | ✅ | ✅ | ❌ |
| fee-discrepancy-review | ✅ | ✅ | ✅ | ✅ | ✅ |
| bank-mutation-entries | ✅ | ✅ | ✅ | ✅ | ✅ |
| reports | ✅ | ✅ | ✅ | ✅ | ✅ (stub) |
| review-approval | ✅ | ✅ | ✅ | ✅ | ✅ (stub) |

### Frontend Store Compliance (`parseApiError`)

| Store | `parseApiError` | Inline error extraction |
|-------|:---:|:---:|
| branches | ✅ | ✅ removed |
| categories | ✅ | ✅ removed |
| banks | ✅ | ✅ removed |
| metric_units | ✅ | ✅ removed |
| suppliers | ✅ | ✅ removed |
| employees | ✅ | ✅ removed |
| bank-accounts | ✅ | ✅ removed |
| bank-statement-import | ✅ | ✅ (custom getErrorMessage + parseApiError fallback) |
| branch_context | ✅ | ✅ removed |
| companies | ✅ | ✅ removed |
| employee_branches | ✅ | ✅ removed |
| payment-methods | ✅ | ✅ removed |
| payment-terms | ✅ | ✅ removed |
| permissions | ✅ | ✅ removed |
| pricelists | ✅ | ✅ removed |
| product-uoms | ✅ | ✅ removed |
| products | ✅ | ✅ removed |
| supplier-products | ✅ | ✅ removed |
| users | ✅ | ✅ removed |
| pos-aggregates | ✅ | ✅ removed |
| pos-imports | ✅ | ✅ removed (CanceledError check only) |
| pos-sync-aggregates | ✅ | ✅ removed |
| chartOfAccounts | ✅ | ✅ removed |
| accountingPurposes | ✅ | ✅ removed |
| accountingPurposeAccounts | ✅ | ✅ removed |
| journalLines | ✅ | ✅ removed |
| journalHeaders | ✅ | ✅ removed |
| fiscalPeriods | ✅ | ✅ removed |
| failedTransactions | ✅ | ✅ removed (CanceledError check only) |
| employee (fetchList) | ✅ | ✅ (CanceledError check only) |
| auth | ✅ | ✅ removed |
| monitoring | ✅ | ✅ removed |
| jobs | ✅ | ✅ removed |

### Modules Fully Compliant (all conventions — rewritten in current session)
- ✅ `bank-accounts` (backend + frontend)
- ✅ `payment-methods` (backend + frontend)
- ✅ `payment-terms` (backend + frontend)
- ✅ `cash-counts` (backend + frontend)
- ✅ `cash-flow` (backend + frontend)
- ✅ `permissions` (backend + frontend)
- ✅ `pricelists` (backend + frontend)
- ✅ `product-uoms` (backend + frontend)
- ✅ `users` (backend + frontend)
- ✅ `auth` (backend + frontend)
- ✅ `expense-categorization` (backend + frontend)
- ✅ `jobs` (backend + frontend)
- ✅ `monitoring` (backend + frontend)
- ✅ `pos-sync` (backend + frontend)
- ✅ `sub-categories` (backend + frontend)
- ✅ `supplier-products` (backend + frontend)
- ✅ `products` (backend + frontend)

### Modules Partially Compliant (prior session — BE handleError/error:unknown OK, but legacy imports remain)
BE controller sudah `await handleError` + `error: unknown` + `context`, tapi masih pakai `withValidated`/`getParamString`/`AuthRequest`/`AuthenticatedRequest`. FE store sudah `parseApiError`.
- ✅ `branches` (backend + frontend)
- ✅ `categories` (backend + frontend)
- ✅ `employees` (backend + frontend)
- ✅ `companies` (backend + frontend)
- ✅ `employee_branches` (backend + frontend)
- ✅ `suppliers` (backend + frontend)
- ✅ `banks` (backend + frontend)
- ✅ `metric-units` (backend + frontend)

### Accounting & Reconciliation Modules (Phase 2 — BE controller fixed, some legacy remains)
- ✅ `accounting/chart-of-accounts` (backend + frontend)
- ✅ `accounting/accounting-purposes` (backend + frontend)
- ✅ `accounting/accounting-purpose-accounts` (backend + frontend)
- ✅ `accounting/fiscal-periods` (backend + frontend)
- ✅ `accounting/journals/journal-headers` (backend + frontend)
- ✅ `accounting/journals/journal-lines` (backend)
- ✅ `accounting/trial-balance` (backend)
- ✅ `accounting/income-statement` (backend)
- ✅ `accounting/balance-sheet` (backend)
- ✅ `reconciliation/bank-statement-import` (backend + frontend)
- ✅ `reconciliation/bank-reconciliation` (backend)
- ✅ `reconciliation/bank-settlement-group` (backend)
- ✅ `reconciliation/fee-reconciliation` (backend)
- ✅ `pos-imports/pos-imports` (backend + frontend)
- ✅ `pos-imports/pos-aggregates` (backend + frontend)
- ✅ `pos-imports/pos-transactions` (backend)
- ✅ `pos-sync-aggregates` (backend)

### Modules Missed from Phase 1-2 (FIXED)
- ✅ `reconciliation/fee-discrepancy-review` — controller + routes rewritten
- ✅ `reconciliation/bank-mutation-entries` — controller + routes rewritten
- ✅ `reconciliation/reports` — controller fixed (stub)
- ✅ `reconciliation/review-approval` — controller fixed (stub)

---

## 🧹 Phase 3: Legacy & Dead Code Cleanup

Hasil scan setelah Phase 1-2 selesai. Semua item di bawah WAJIB di-fix.

### 3A. Dead Code (HAPUS)
| File | Status | Alasan |
|------|--------|--------|
| `frontend/src/features/employee_branches/api/errors.ts` | ❌ Dead | Tidak di-import di manapun |
| `frontend/src/features/pos-aggregates/utils/error.ts` | ❌ Dead | Re-export di `index.ts` tapi tidak dipakai oleh store manapun |

### 3B. Backend — `as any` / `as unknown as` di Controllers (21x)
| File | Count | Pattern |
|------|-------|---------|
| `accounting-purposes.controller.ts` | 5x | `this.getCompanyId(req as any)` |
| `accounting-purpose-accounts.controller.ts` | 5x | `this.getCompanyId(req as any)` |
| `fiscal-periods.controller.ts` | 6x | `this.getCompanyId(req as any)` + `req.sort as any` |
| `bank-reconciliation.controller.ts` | 3x | `(req.validated as any)?.query` |
| `bank-statement-import.controller.ts` | 2x | `(req as any).validated?.query` |

### 3C. Backend — `req as any` / `req as ValidatedAuthRequest` di Routes (95x)
| File | Count | Pattern |
|------|-------|---------|
| `companies.routes.ts` | 4x | `req as ValidatedAuthRequest<>` |
| `employee_branches.routes.ts` | 3x | `req as ValidatedAuthRequest<>` |
| `employees.routes.ts` | 7x | `req as ValidatedAuthRequest<>` |
| `products.routes.ts` | 2x | `req as ValidatedAuthRequest<>` |
| `sub-categories.routes.ts` | ?x | `req as ValidatedAuthRequest<>` |
| `supplier-products.routes.ts` | ?x | `req as ValidatedAuthRequest<>` |
| `accounting-purposes.routes.ts` | ?x | `req as ValidatedAuthRequest<>` |
| `accounting-purpose-accounts.routes.ts` | ?x | `req as ValidatedAuthRequest<>` |
| `fiscal-periods.routes.ts` | ?x | `req as ValidatedAuthRequest<>` |
| `bank-reconciliation.routes.ts` | 2x | `req as any` |
| `bank-settlement-group.routes.ts` | ?x | `req as ValidatedAuthRequest<>` |
| `bank-statement-import.routes.ts` | ?x | `req as ValidatedAuthRequest<>` |
| `fee-discrepancy-review.routes.ts` | ?x | `req as ValidatedAuthRequest<>` |
| `bank-mutation-entries.routes.ts` | ?x | `req as ValidatedAuthRequest<>` |
| `pos-imports.routes.ts` | ?x | `req as ValidatedAuthRequest<>` |
| `balance-sheet.routes.ts` | 1x | `req as any` |
| `income-statement.routes.ts` | 1x | `req as any` |
| `trial-balance.routes.ts` | 1x | `req as any` |
| `fee-reconciliation.routes.ts` | 3x | `req as any` |
| `journal-lines.routes.ts` | 4x | `req as any` |

Fix: Routes harus pakai `(req, res) => controller.method(req, res)` — cast pindah ke dalam controller body.

### 3D. Backend — correlationId / logRequest / logResponse Boilerplate (5 files)
| File | Issue |
|------|-------|
| `accounting-purposes.controller.ts` | `generateCorrelationId`, `logRequest`, `logResponse` methods |
| `accounting-purposes.service.ts` | `correlationId` parameter |
| `accounting-purpose-accounts.controller.ts` | Same boilerplate |
| `fiscal-periods.controller.ts` | Same boilerplate |
| `fiscal-periods.service.ts` | `correlationId` parameter |

Fix: Hapus boilerplate — centralized logger sudah handle correlation via request context.

### 3E. Frontend — Stores Tanpa `parseApiError` (13 stores)
| Store | Current Pattern |
|-------|-----------------|
| `chartOfAccounts.store.ts` | 12x `error instanceof Error` |
| `accountingPurposes.store.ts` | 8x `error instanceof Error` |
| `accountingPurposeAccounts.store.ts` | 13x `error instanceof Error` |
| `journalLines.store.ts` | 3x `error instanceof Error` |
| `journalHeaders.store.ts` | 12x `error instanceof Error` |
| `fiscalPeriods.store.ts` | 10x `error instanceof Error` |
| `bank-statement-import.store.ts` | 1x `error instanceof Error` |
| `branchContext.store.ts` | 2x `error instanceof Error` |
| `employee.store.ts` | 2x `error instanceof Error` (CanceledError check) |
| `failedTransactions.store.ts` | 1x `error instanceof Error` |
| `posAggregates.store.ts` | 1x `error instanceof Error` (CanceledError check) |
| `pos-imports.store.ts` | 6x `error instanceof Error` |
| `pos-sync-aggregates` | console.error only (minor) |

Fix: Replace semua `error instanceof Error ? error.message : '...'` dengan `parseApiError(error, 'fallback message')`.

### 3F. Backend — bank-mutation-entries Custom handleError
| Issue | Detail |
|-------|--------|
| Custom `handleError` method | Private method di controller, bukan global `handleError` dari `error-handler.util` |
| Custom `ReqWithContext` type | `{ context?: { company_id?: string }; user?: { id?: string } }` — harusnya pakai express.d.ts augmentation |
| `as unknown as ReqWithContext` | 5x cast — harusnya `req.context` / `req.user` langsung |

### Execution Order
1. ✅ Delete dead code (3A — 2 files)
2. ✅ Fix 4 missed BE modules (fee-discrepancy-review, bank-mutation-entries, reports, review-approval)
3. ✅ Fix 13 FE stores → replace `error instanceof Error` dengan `parseApiError` (3E)
4. ⬜ Clean routes → remove `req as ValidatedAuthRequest` / `req as any` casts (3C)
5. ⬜ Fix `as any` di controllers (3B)
6. ⬜ Remove correlationId boilerplate (3D)

---
trigger: always_on
---
📜 Backend Engineering Standards — Suryamas ERP (Unified)
🎯 Tujuan

Dokumen ini menjadi single source of truth untuk:

Arsitektur backend
Coding standards
Performance & security rules
Enforcement rules untuk AI & developer

Semua code baru WAJIB mengikuti dokumen ini.

🏗️ 1. Module Structure (MANDATORY)

Setiap module di src/modules/*:

- *.routes.ts
- *.controller.ts
- *.service.ts
- *.repository.ts
- *.schema.ts
- *.errors.ts
- *.types.ts
Rules:
Semua layer wajib ada (tidak boleh skip)
Tidak boleh cross-layer access (controller → repository ❌)
🚦 2. Routing Layer
Responsibilities:
Define endpoint
Attach middleware
Call controller
Middleware Order (WAJIB — tidak boleh diubah):
authenticate → resolveBranchContext → permission → validateSchema
Rules:
Gunakan:
auth.middleware
branch-context.middleware
permission.middleware
validation.middleware
Permission:
canView, canInsert, canUpdate, canDelete
Schema HARUS dipasang di routes (entry point validation)
Pattern:
router.get(
  '/',
  canView(MODULE),
  validateSchema(schema),
  (req, res) => controller.method(req as any, res)
)
🎮 3. Controller Layer
Responsibilities:
Handle request & response
Extract req.validated
Call service
Rules:
❌ Tidak boleh ada business logic
✅ Wajib:
withValidated
sendSuccess
handleError
Singleton:
export const controller = new Controller()
🛠️ 4. Service Layer (CORE LOGIC)
Responsibilities:
Business logic
Orchestration
Transaction handling
Rules:
✅ Audit Log WAJIB untuk:
CREATE
UPDATE
DELETE
LOGIN / LOGOUT
PERMISSION CHANGE
❌ Tidak boleh query langsung ke DB
Gunakan repository
Audit Log Minimal:
user_id
action
entity
entity_id
before
after
timestamp
🗄️ 5. Repository Layer
Responsibilities:
Single source of truth untuk DB access
Rules:
❌ Tidak boleh business logic
❌ Tidak boleh N+1 query
✅ Wajib:
Filter company_id
deleted_at IS NULL
Gunakan:
CTE / JOIN
batching / parallel query
🧪 6. Schema Layer (Validation)
Rules:
Gunakan:
import { z } from '@/lib/openapi'
Semua request WAJIB tervalidasi
Gunakan:
.coerce (query param)
.refine (business validation)
❌ 7. Error Handling
Rules:
Gunakan custom error:
- NotFoundError, BusinessRuleError, ConflictError, dll.
- ❌ Tidak boleh throw Error biasa
- ✅ WAJIB: Daftarkan error class baru di `src/config/error-registry.ts` untuk pemetaan status code & module tracking.
- ✅ WAJIB: Gunakan `await handleError(res, error, req, context)` di controller.
- ✅ WAJIB: Pass `context` (objek metadata) untuk mempermudah debugging di monitoring dashboard.
📋 8. Global Standards
Code Quality
TypeScript strict
❌ Dilarang any
Naming harus jelas & konsisten
Data Format
Backend: ISO / YYYY-MM-DD
Frontend: dd-MMM-yyyy
Pagination
WAJIB untuk list API
Logging
Gunakan centralized logger
Log minimal:
request masuk
error
query penting
⚡ 9. Performance Rules
WAJIB:
❌ No N+1 Query
✅ JOIN / batching
✅ Indexing kolom penting
✅ Pagination
🔐 10. Security Rules

Semua endpoint harus:

✅ Authenticated
✅ Authorized
✅ Validated
✅ Sanitized
🧩 11. Middleware Standard
List:
auth.middleware
branch-context.middleware
validation.middleware
permission.middleware

Tidak boleh membuat middleware custom tanpa justifikasi jelas.

📊 12. Monitoring & Observability
Gunakan centralized logger
Integrasi monitoring service
Semua error harus tercatat
🧠 13. AI Enforcement Rules

AI WAJIB:

Mengikuti struktur module
Tidak menggunakan any
Tidak membuat N+1 query
Selalu pakai schema validation
Selalu pakai permission middleware
Selalu tambahkan audit log untuk mutasi data

Jika melanggar → dianggap INVALID CODE

🖥️ 14. Frontend Coupling Rules (Important)
Format tanggal display: dd-MMM-yyyy
State filter: Zustand
Hindari over-fetching
Gunakan global pagination
🔥 Perbedaan penting dari versi lama (ini yang krusial)

Ini bukan sekadar merge — ada beberapa upgrade penting:

1. Tidak ada duplikasi rules
Middleware → disatukan
Audit log → disatukan
Validation → dipaksa di routes
2. Konsistensi Zod
Dipastikan pakai @/lib/openapi (bukan raw zod)
3. Enforcement lebih keras
Ada section AI Enforcement Rules
Jelas mana yang WAJIB vs optional
4. Clean separation
Controller = thin
Service = brain
Repository = data only


🎨 Frontend Development Guidelines (frontend/FRONTEND_STANDARDS.md)
markdown
# Frontend Development Guidelines - Suryamas ERP
Dokumen ini mendefinisikan standar pengembangan UI/UX dan arsitektur frontend untuk memastikan aplikasi tetap premium, responsif, dan mudah dipelihara.
## 🏗️ Feature-Based Structure
Kita menggunakan struktur berbasis **Features** di `src/features/*`. Setiap fitur harus mandiri:
- `api/`: Custom hooks (React Query) untuk fetching data.
- `components/`: Komponen UI khusus untuk fitur tersebut.
- `store/`: State management menggunakan Zustand.
- `pages/`: Halaman utama fitur.
- `types/`: Definisi interface TypeScript.
- `index.ts`: Public API untuk fitur (export yang dibutuhkan fitur lain).
---
## 📡 1. Data Fetching (`api/*.ts`)
Kita menggunakan **TanStack Query (React Query)** untuk manajemen server-state.
### Aturan:
- **Query Keys**: Selalu definisikan objek `queryKeys` untuk konsistensi invalidasi data.
- **Hook Pattern**: Bungkus `useQuery` atau `useMutation` dalam custom hooks.
- **Error Handling**: Gunakan `toast` untuk memberitahukan error ke user.
- **Invalidation**: Lakukan `qc.invalidateQueries` pada `onSuccess` saat melakukan mutasi (POST/PUT/DELETE).
### Contoh:
```typescript
export const useCashFlowDaily = (params: QueryParams) =>
  useQuery({
    queryKey: ['cash-flow', 'daily', params],
    queryFn: () => api.get('/cash-flow/daily', { params }).then(res => res.data.data),
    enabled: !!params.bank_account_id
  });
🧠 2. State Management (store/*.ts)
Gunakan Zustand untuk global state atau state yang perlu bertahan saat navigasi (seperti Filter).

Aturan:
Pemisahan Store: Buat store kecil yang spesifik (misal: useAuthStore, useFilterStore).
Persistensi: Gunakan middleware persist jika data harus bertahan setelah refresh (seperti Token/Branch ID).
🎨 3. UI & Styling
Aplikasi ini harus terasa Premium dan Modern.

Aturan:
Design System: Gunakan komponen dari Shadcn UI sebagai basis.
Consistency: Jangan membuat warna atau spacing ad-hoc. Gunakan utility classes dari Tailwind.
Dark Mode: Pastikan semua komponen support dark mode menggunakan class dark:.
Micro-animations: Gunakan Framer Motion untuk transisi halaman atau hover effect yang halus.
No Placeholders: Gunakan data asli atau generated images yang terlihat profesional.
🛠️ 4. Global Standards & Utilities
Format Tanggal:
Backend mengirim: YYYY-MM-DD atau ISO.
Frontend menampilkan: dd-MMM-yyyy (Contoh: 20-Apr-2026). Gunakan formatDate utility.
Pagination: Wajib menggunakan komponen pagination global untuk semua list API yang besar.
Modal Konfirmasi: Gunakan pola global ConfirmModal sebelum aksi destruktif (Delete).
Form Validation: Gunakan React Hook Form + Zod untuk semua input form.
📋 5. AI Enforcement Rules
AI WAJIB:

Menggunakan TypeScript secara ketat (No any).
Mengikuti struktur folder src/features.
Selalu menambahkan state loading (skeleton/spinner) saat fetching data.
Menambahkan dokumentasi JSDoc pada hooks atau utilitas yang kompleks.
Memastikan responsivitas (Mobile-first approach).


📚 15. Project Context (WAJIB BACA)

Sebelum mengerjakan task apapun, AI WAJIB membaca:
- `.amazonq/docs/INFRASTRUCTURE.md` — server, DB, tunnel, firewall, storage, monitoring, Telegram
- `.amazonq/docs/DEV_STATUS.md` — progress, pending fixes, backlog, coding conventions

🔑 16. Lessons Learned (WAJIB IKUTI)

Dari pengalaman development sebelumnya, berikut aturan tambahan:

### Backend
1. `handleError(res, error, req, context)` — SELALU `await` karena bersifat async. Pass `req` untuk info user/route, dan `context` untuk metadata spesifik (ID, query, dll).
2. ~~Jika TypeScript error saat pass `req` ke `handleError` karena custom type (Query/Body), gunakan `req as any`.~~ **DEPRECATED** — Gunakan Express global augmentation (`src/types/express.d.ts`). Controller langsung pass `req` tanpa cast. Lihat convention #29.
3. Jangan throw generic `new Error()` — pakai custom error class dari `*.errors.ts` dan daftarkan di `ERROR_REGISTRY`.
4. Schema validation: cross-validate compare periods, UUID regex untuk `branch_ids`
5. Setelah ubah `.ts`, WAJIB rebuild: `cd backend && npx tsc`
6. `company_id` dari branch context (`req.context.company_id`), BUKAN dari query param
7. Lazy Initialization: Gunakan pattern getter (misal `getS3()`) untuk service eksternal agar env vars ter-load dengan benar (menghindari error saat cold start).
8. S3Client (Cloudflare R2) WAJIB pakai `forcePathStyle: true`

### Frontend
1. Jangan hardcode labels — pakai data dari DB/COA hierarchy
2. Jangan `Math.abs` untuk kalkulasi — pakai helper per account type (`debit - credit` vs `credit - debit`)
3. Jangan mutable variable di render (`let rowNum`) — hitung `rowIndex` di function sebelum render
4. `colSpan` pakai konstanta (`totalCols`), bukan angka hardcode
5. `fmt(0)` di total row pakai `showZero = true` supaya tampil `0,00` bukan `-`
6. Tailwind JIT: JANGAN dynamic class (`bg-${color}-500`), pakai object mapping literal
7. CSV export: pakai `escapeCsv()` dari `src/utils/csv.utils.ts`
8. Error message 500 di frontend: tampilkan pesan generik, bukan detail teknis
9. Akun tanpa parent di-group ke bucket `__ungrouped__` dengan label "Lainnya"
10. Permission module harus terpisah per fitur (jangan gabung ke `journals`)

### Database & Migrasi
1. Akses DB dari lokal: via SSH tunnel (`tunnel` command), JANGAN buka port 5432 di firewall
2. `DATABASE_URL` pakai `localhost:5433` (tunnel), bukan IP langsung
3. Setelah migrasi, WAJIB compare: tables, views, functions, enums, triggers, sequences, indexes, FK
4. `auth.users` (Supabase) → `public.auth_users` (Hetzner) — semua FK sudah di-remap
