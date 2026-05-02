# Suryamas ERP — Development Status

## ✅ Completed Features

### Infrastructure
- Migrasi Supabase → Hetzner (DB, functions, triggers, views, FK)
- SSH tunnel setup (DB + pgAdmin)
- Cloudflare R2 storage (forcePathStyle fix)
- Error monitoring (error_logs + Telegram alerts)
- Job system (5 atomic functions)

### Laporan Keuangan
- Trial Balance, Laba Rugi (Income Statement), Neraca (Balance Sheet)
- Compare period support, CSV export, COA hierarchy grouping

### Cash Flow Module
- Period balance CRUD, payment method groups, cash flow daily

### Monitoring
- Error persist ke DB + Telegram webhook
- Error trend chart, recurring errors, user name lookup

### UI/UX
- Sales Dashboard, POS Staging dark mode, Login redesign
- Toast notifications (86 pages), zero `alert()`, zero `confirm()`

### Code Quality (Phase 1-3 Compliance Review)
- **46 backend modules** — all controllers + routes compliant
- **33 frontend stores** — all using `parseApiError`
- Zero `as any` in controllers, zero `ValidatedAuthRequest` in route casts
- Zero correlationId boilerplate, zero dead code

---

## 📋 Backlog

### Feature Development
- [ ] **Branch Closure** — tutup cabang permanen dengan akses read-only historis (design doc: `.amazonq/docs/BRANCH_CLOSURE_DESIGN.md`)
  - [x] Phase 1: Database + Backend Core (migration, types, middleware, branch module, employee_branches)
  - [x] Phase 2: Write Guard middleware + apply ke mutation routes (8 files, 61 routes)
  - [ ] Phase 3: Branch Dropdowns (include closed)
  - [ ] Phase 4: Frontend (types, hook, banner, switcher, modal, pages)
  - [ ] Phase 5: End-to-End Test
- [ ] PO Flow (Purchase Order → Receiving → AP → Payment → Auto Journal)
- [ ] COGS calculation (HPP dari inventory movement)
- [ ] Laporan Arus Kas formal PSAK 2 (3 aktivitas: operasi/investasi/pendanaan)
- [ ] User Management — create account dari UI (backend POST /auth/register sudah ada)
- [ ] Deploy ke production (Nginx config, PM2, SSL via Certbot)

### Responsive UI Audit — COMPLETED ✅

108 pages audited. Semua 46 🔴 pages sudah di-fix + bonus sweep 37 files (`grid-cols-2` → `grid-cols-1 md:grid-cols-2`).

Fixes applied:
- `Pagination.tsx` global component — responsive (stack mobile, icon-only buttons)
- `overflow-hidden` → `overflow-x-auto` pada table wrappers
- `p-6` → `px-4 py-6 sm:p-6` pada form/page wrappers
- `flex justify-between` → `flex flex-col sm:flex-row gap-3` pada headers
- `grid grid-cols-2` → `grid grid-cols-1 md:grid-cols-2` pada semua forms/details/components (55+ occurrences)
- Auth pages: dark mode support + responsive text size
- Zero bare `grid-cols-2` tersisa di seluruh codebase

Top 10 most responsive pages:
| Page | Breakpoints |
|------|-------------|
| branches/BranchDetailPage | 41 |
| employees/EmployeeDetailPage | 20 |
| employees/ProfilePage | 20 |
| permissions/PermissionsPage | 19 |
| pages/HomePage | 19 |
| employees/EmployeesPage | 18 |
| employee_branches/EmployeeBranchDetailPage | 15 |
| employee_branches/EmployeeBranchesPage | 15 |
| bank-reconciliation/SettlementGroupDetailPage | 12 |
| accounting/journals/JournalHeaderDetailPage | 12 |

Pagination: 26 pages pakai global `Pagination`, 4 pages pakai custom pagination (UsersPage, PosAggregatesPage, BankReconciliationPage, MonitoringPage) — acceptable.

---

## 📝 Coding Conventions

### Backend — Controller & Routes
1. `handleError(res, error, req, context)` — SELALU `await`, pass `req` langsung (tanpa cast), `context` berisi `{ action, id, query }`
2. Controller method signature: `req: Request` dari express. Cast `ValidatedAuthRequest` di **dalam body**, bukan di signature
3. Routes: `(req, res) => controller.method(req, res)` — tanpa cast. Tidak boleh `req as any` atau `req as ValidatedAuthRequest<>`
4. `error: unknown` di semua catch blocks
5. Custom error class dari `*.errors.ts`, daftarkan di `ERROR_REGISTRY`. Jangan `throw new Error()`
6. `company_id` dari `req.context?.company_id`, BUKAN dari query param
7. Express global augmentation (`backend/src/types/express.d.ts`): `user`, `validated`, `sort`, `filterParams`, `queryFilter`, `context`, `permissions`
8. `isPostgresError(error, code)` dari `src/utils/postgres-error.util.ts` untuk cek PG error code
9. DTO audit fields: `created_by`/`updated_by` WAJIB di DTO
10. Repository type safety: `toRecord<T>()` helper untuk bulk insert. Dilarang `as any`
11. Setelah ubah `.ts`, WAJIB rebuild: `cd backend && npx tsc`

### Backend — Routes Specific
12. Middleware order: `authenticate → resolveBranchContext → requireWriteAccess (mutations) → permission → validateSchema`
13. Static routes (`/search`, `/trash`, `/bulk/delete`, `/export`, `/options/active`) WAJIB sebelum `/:id` (Express evaluasi top-to-bottom)
14. Schema HARUS dipasang di routes (entry point validation)
15. Lazy Initialization: getter pattern (`getS3()`) untuk service eksternal
16. S3Client (Cloudflare R2) WAJIB `forcePathStyle: true`
17. `requireWriteAccess` WAJIB di semua mutation routes (POST/PUT/DELETE/PATCH) — termasuk `canApprove` dan `canRelease`, bukan hanya `canInsert/canUpdate/canDelete`

### Backend — Schema & Validation
17. Gunakan `import { z } from '@/lib/openapi'` (bukan raw zod)
18. `.coerce` untuk query param, `.refine` untuk business validation
19. Cross-validate compare periods, UUID regex untuk `branch_ids`

### Frontend — Store & Error Handling
20. Semua store WAJIB pakai `parseApiError()` dari `@/lib/errorParser`. Dilarang `error instanceof Error ? error.message : '...'`
21. Toast: pakai global `useToast` dari `@/contexts/ToastContext`
22. Confirm: pakai `ConfirmModal` component, bukan native `confirm()`

### Frontend — Pagination & Fetch Pattern
23. Store WAJIB punya combined `fetchPage(page, limit?, ...params)` — gabung state update + fetch
24. Search/filter berubah → reset ke page 1. Deps: hanya trigger values, BUKAN store functions
25. DILARANG: `setPage()` + `useEffect([pagination.page])` terpisah (double-fetch)
26. DILARANG: `skipNextPageEffect` ref atau `isFirstRender` ref

### Frontend — UI/UX
27. Label/message: Bahasa Indonesia untuk user-facing, English untuk technical
28. Action buttons: icon (Eye, Pencil, Trash2), bukan text
29. Loading: skeleton (animate-pulse), bukan text "Loading..."
30. Empty state: icon + pesan informatif
31. Error state: error card + tombol "Coba Lagi"
32. Styling: `rounded-lg`, `border border-gray-200 dark:border-gray-700`
33. Tailwind JIT: JANGAN dynamic class — pakai object mapping literal
34. Format tanggal display: `dd-MMM-yyyy`. Backend: `YYYY-MM-DD` / ISO
35. CSV export: pakai `escapeCsv()` dari `src/utils/csv.utils.ts`
36. Error 500: tampilkan pesan generik, bukan detail teknis

### Frontend — Code Quality
37. TypeScript strict, no `any`
38. Form: React Hook Form + Zod
39. State filter: Zustand (small, specific stores)
40. Data fetching: TanStack Query dengan `queryKeys` object
41. Repository: jangan wrap try/catch tanpa transformasi error — biarkan bubble up
42. Summary/totals: query terpisah untuk seluruh periode, jangan hitung dari paginated rows

### Database
43. Akses DB dari lokal: via SSH tunnel (`tunnel`), JANGAN buka port 5432
44. `DATABASE_URL` pakai `localhost:5433` (tunnel)
45. Setelah migrasi, WAJIB compare: tables, views, functions, enums, triggers, sequences, indexes, FK

---

## 🔍 Module Compliance — All ✅

**46 backend modules**, **33 frontend stores** — semua compliant.

### Backend Controllers (all pass)
| Check | Status |
|-------|--------|
| `await handleError(res, error, req, { action })` | ✅ All 46 modules |
| No `as any` / `as unknown` | ✅ Zero occurrences |
| `error: unknown` in catch | ✅ All modules |
| `context` param in handleError | ✅ All modules |
| Express augmentation (no cast in routes) | ✅ All modules |
| No correlationId boilerplate | ✅ Removed from 3 accounting modules |
| No `AuthenticatedRequest` / `AuthenticatedQueryRequest` | ✅ Zero occurrences |

### Frontend Stores (all pass)
| Check | Status |
|-------|--------|
| `parseApiError` from `@/lib/errorParser` | ✅ All 33 stores |
| No inline `error instanceof Error` | ✅ Only CanceledError checks remain (acceptable) |

### Complete Module List
bank-accounts, payment-methods, payment-terms, cash-counts, cash-flow, permissions, pricelists, product-uoms, users, auth, expense-categorization, jobs, monitoring, pos-sync, sub-categories, supplier-products, products, branches, categories, employees, companies, employee_branches, suppliers, banks, metric-units, accounting/chart-of-accounts, accounting/accounting-purposes, accounting/accounting-purpose-accounts, accounting/fiscal-periods, accounting/journals/journal-headers, accounting/journals/journal-lines, accounting/trial-balance, accounting/income-statement, accounting/balance-sheet, reconciliation/bank-statement-import, reconciliation/bank-reconciliation, reconciliation/bank-settlement-group, reconciliation/fee-reconciliation, reconciliation/fee-discrepancy-review, reconciliation/bank-mutation-entries, reconciliation/reports (stub), reconciliation/review-approval (stub), pos-imports/pos-imports, pos-imports/pos-aggregates, pos-imports/pos-transactions, pos-sync-aggregates

---

## 🔧 Key Infrastructure Files

| File | Purpose |
|------|---------|
| `backend/src/types/express.d.ts` | Express augmentation (`user`, `validated`, `sort`, `context`, etc.) |
| `backend/src/utils/error-handler.util.ts` | Global `handleError(res, error, req, context)` |
| `backend/src/utils/postgres-error.util.ts` | `isPostgresError(error, code)` helper |
| `backend/src/config/error-registry.ts` | Error class → status code mapping |
| `frontend/src/lib/errorParser.ts` | `parseApiError(err, fallbackMessage)` |
| `frontend/src/contexts/ToastContext.tsx` | Global `useToast()` |

---

## 📚 Reference
- **Backend/Frontend Standards**: `.amazonq/rules/Basic.md`
- **Infrastructure & Deployment**: `.amazonq/docs/INFRASTRUCTURE.md`
- **Reference Controller**: `backend/src/modules/branches/branches.controller.ts`
- **Reference Page**: `frontend/src/features/products/pages/ProductsPage.tsx` (pagination pattern)
