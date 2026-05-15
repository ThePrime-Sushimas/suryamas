# Suryamas ERP — Development Status

## ✅ Completed Features

### Infrastructure
- Migrasi Supabase → Hetzner (DB, functions, triggers, views, FK)
- SSH tunnel setup (DB + pgAdmin)
- Cloudflare R2 storage (forcePathStyle fix, env vars on VPS)
- Error monitoring (error_logs + Telegram alerts, no rate limit)
- Job system (5 atomic functions)
- Auto Deploy via GitHub Actions + Telegram notifications
- Job worker: auto-rollback import status to FAILED on job failure

### Laporan Keuangan
- Trial Balance, Laba Rugi (Income Statement), Neraca (Balance Sheet)
- Compare period support, CSV export, COA hierarchy grouping
- Opening Balance Entry (jurnal type OPENING, prefix JO)

### Fiscal Period Management
- CRUD fiscal periods with validation (overlap, year-end rules)
- **Fiscal Closing** — tutup buku dengan auto-generate closing journal
  - Preview (revenue/expense summary) sebelum close
  - Closing journal langsung POSTED (system-generated, source_module = FISCAL_CLOSING)
  - Transfer net income ke Retained Earnings (default 310202)
  - Permission guard: `canRelease('fiscal_periods')` untuk close
  - Closing journal protected dari manual delete/edit
- **Reopen Period** — buka kembali periode yang sudah closed
  - Reverse closing journal (both original + reversal excluded from ledger via is_reversed)
  - Chain guard: tidak bisa reopen jika periode berikutnya sudah closed (LIFO order)
  - Compensating rollback jika reversal gagal
  - Permission guard: `canApprove('fiscal_periods')` untuk reopen

### Branch Closure
- Closed branches are read-only (can view historical data, cannot create new transactions)
- DB migration, middleware, write-guard on 39 mutation routes
- Frontend: banner, switcher badges, CloseBranchModal

### Cash Flow Module (renamed to "In-Out")
- Period balance CRUD, payment method groups, cash flow daily

### Monitoring
- Error persist ke DB + Telegram webhook (all errors, no skip)
- Error trend chart, recurring errors, user name lookup

### UI/UX
- Sales Dashboard, POS Staging dark mode, Login gate animation
- Toast notifications (86 pages), zero `alert()`, zero `confirm()`
- Responsive UI audit: 108 pages, 46 fixed, zero bare `grid-cols-2`

### Code Quality
- 46 backend modules, 33 frontend stores — all compliant
- Zero `as any` in controllers, zero `ValidatedAuthRequest` in route casts
- Removed: JournalHeadersDeletedPage (hard delete only, no soft delete page)

---

## 📋 Backlog

### Feature Development
- [ ] Cash Count dashboard integration (pending count badge + counted display on accounting dashboard)
- [ ] **Purchase Invoice module** — NEXT PRIORITY. Lihat `.amazonq/docs/GOODS_PROCESSING_PURCHASE_INVOICE_HANDOFF.md`
- [ ] COGS calculation (HPP dari inventory movement)
- [ ] Laporan Arus Kas formal PSAK 2 (3 aktivitas: operasi/investasi/pendanaan)
- [ ] User Management — create account dari UI (backend POST /auth/register sudah ada)
- [ ] Branch name normalization (DB CAPS vs POS Title Case)
- [ ] Bank reconciliation rounding fix (0.01 selisih dari bank rec journal)

### Inventory — Status Terkini

| Module | BE | FE | DB | Notes |
|--------|----|----|----|---------|
| Warehouses | ✅ | ✅ | ✅ | |
| Stock Balances + Movements | ✅ | ✅ | ✅ | |
| Opening Balance | ✅ | ✅ | — | |
| Stock Adjustment | ✅ | ✅ | — | |
| Purchase Requests | ✅ | ✅ | ✅ | |
| PR Approval | ✅ | ✅ | — | Auto-fill payment terms dari supplier |
| Purchase Orders | ✅ | ✅ | ✅ | `payment_term_id` + `payment_due_date` sudah ada |
| Goods Receipts | ✅ | ✅ | ✅ | Hitung `payment_due_date` saat confirm (from_delivery) |
| Goods Processing | ✅ | ✅ | ✅ | Per-line status, stock masuk cost=0 |
| **Purchase Invoice** | ❌ | ❌ | ❌ | **NEXT — lihat handoff doc** |
| Transfer Orders | ❌ | ❌ | ❌ | |
| Branch Loans | ❌ | ❌ | ❌ | |

---

## 📝 Coding Conventions

### Backend — Controller & Routes
1. `handleError(res, error, req, context)` — SELALU `await`, pass `req` langsung (tanpa cast), `context` berisi `{ action, id, query }`
2. Controller method signature: `req: Request` dari express. Cast `ValidatedAuthRequest` di **dalam body**, bukan di signature
3. Routes: `(req, res) => controller.method(req, res)` — tanpa cast
4. `error: unknown` di semua catch blocks
5. Custom error class dari `*.errors.ts`, daftarkan di `ERROR_REGISTRY`. Jangan `throw new Error()`
6. `company_id` dari `req.context?.company_id`, BUKAN dari query param
7. `employee_id` dari `req.context?.employee_id` untuk FK ke `employees` table (misal `created_by` di `journal_headers`). BUKAN `req.user.id` (itu auth_users ID)
8. Express global augmentation (`backend/src/types/express.d.ts`): `user`, `validated`, `sort`, `filterParams`, `queryFilter`, `context`, `permissions`
9. `isPostgresError(error, code)` dari `src/utils/postgres-error.util.ts` untuk cek PG error code
10. DTO audit fields: `created_by`/`updated_by` WAJIB di DTO
11. Repository type safety: `toRecord<T>()` helper untuk bulk insert. Dilarang `as any`
12. Setelah ubah `.ts`, WAJIB rebuild: `cd backend && npx tsc`

### Backend — Routes Specific
13. Middleware order: `authenticate → resolveBranchContext → requireWriteAccess (mutations) → permission → validateSchema`
14. Static routes (`/search`, `/trash`, `/bulk/delete`, `/export`, `/options/active`) WAJIB sebelum `/:id`
15. Schema HARUS dipasang di routes (entry point validation)
16. Lazy Initialization: getter pattern (`getS3()`) untuk service eksternal
17. S3Client (Cloudflare R2) WAJIB `forcePathStyle: true`
18. `requireWriteAccess` WAJIB di semua mutation routes — termasuk `canApprove` dan `canRelease`

### Backend — Schema & Validation
19. Gunakan `import { z } from '@/lib/openapi'` (bukan raw zod)
20. `.coerce` untuk query param, `.refine` untuk business validation

### Backend — Fiscal Closing Specific
21. Closing journal: `source_module = 'FISCAL_CLOSING'`, `branch_id = NULL`, langsung POSTED
22. Reopen: reverse closing journal + mark reversal `is_reversed = true` (both excluded from ledger)
23. `clearReversalReferences()`: reset `is_reversed` saat delete reversal, cascade delete reversal saat delete original
24. Repository cache: panggil `clearCache()` setelah close/reopen untuk hindari stale data

### Frontend — Store & Error Handling
25. Semua store WAJIB pakai `parseApiError()` dari `@/lib/errorParser`
26. Toast: pakai global `useToast` dari `@/contexts/ToastContext`
27. Confirm: pakai `ConfirmModal` component, bukan native `confirm()`

### Frontend — Pagination & Fetch Pattern
28. Store WAJIB punya combined `fetchPage(page, limit?, ...params)`
29. Search/filter berubah → reset ke page 1
30. DILARANG: `setPage()` + `useEffect([pagination.page])` terpisah (double-fetch)

### Frontend — UI/UX
31. Label/message: Bahasa Indonesia untuk user-facing, English untuk technical
32. Loading: skeleton (animate-pulse), bukan text "Loading..."
33. Tailwind JIT: JANGAN dynamic class — pakai object mapping literal
34. Format tanggal display: `dd-MMM-yyyy`. Backend: `YYYY-MM-DD` / ISO
35. Permission guard di UI: pakai `usePermissionStore.hasPermission(module, action)` untuk conditional render tombol

### Database
36. Akses DB dari lokal: via SSH tunnel (`tunnel`), JANGAN buka port 5432
37. `DATABASE_URL` pakai `localhost:5433` (tunnel)
38. `general_ledger_view` filter: `status = 'POSTED'` AND `is_reversed = false` — reversed journals excluded

---

## 🔧 Key Infrastructure Files

| File | Purpose |
|------|---------|
| `backend/src/types/express.d.ts` | Express augmentation (`user`, `validated`, `sort`, `context`, etc.) |
| `backend/src/utils/error-handler.util.ts` | Global `handleError(res, error, req, context)` |
| `backend/src/utils/postgres-error.util.ts` | `isPostgresError(error, code)` helper |
| `backend/src/utils/employee.util.ts` | `getEmployeeId(req)`, `getEmployeeIdSafe(req)` — map auth user to employee |
| `backend/src/utils/due-date.util.ts` | `calculateDueDate(term, baseDate)` — hitung payment due date dari payment_terms |
| `backend/src/modules/food-production/wip/wip-access.util.ts` | `resolveUserWipAccess()`, `canUserAccessWip()`, `filterAccessibleWipIds()` — WIP position access guard |
| `backend/src/config/error-registry.ts` | Error class → status code mapping |
| `frontend/src/lib/errorParser.ts` | `parseApiError(err, fallbackMessage)` |
| `frontend/src/hooks/_shared/useUserBranches.ts` | `useUserBranches()` — return hanya cabang yang user punya akses (untuk form transaksi) |
| `frontend/src/features/branch_context/store/permission.store.ts` | `hasPermission(module, action)` for UI permission guard |

---

## 📚 Reference
- **Backend/Frontend Standards**: `.amazonq/rules/Basic.md`
- **Infrastructure & Deployment**: `.amazonq/docs/INFRASTRUCTURE.md`
- **Fiscal Closing Design**: `.amazonq/docs/FISCAL_CLOSING_DESIGN.md`
- **Coding Patterns & Contracts**: `.amazonq/docs/CODING_PATTERNS.md`
- **Integration & Sync Patterns**: `.amazonq/docs/INTEGRATION_PATTERNS.md`
- **Module Checklist**: `.amazonq/docs/MODULE_CHECKLIST.md`
- **Food Production & COGS Design**: `.amazonq/docs/FOOD_PRODUCTION_DESIGN.md`
- **Auto Credit Bank (Opsi B)**: `.amazonq/docs/OPSI_B_AUTO_CREDIT_BANK.md`
- **Goods Processing + Purchase Invoice Handoff**: `.amazonq/docs/GOODS_PROCESSING_PURCHASE_INVOICE_HANDOFF.md` ⭐
- **Reference Controller**: `backend/src/modules/branches/branches.controller.ts`
- **Reference Page**: `frontend/src/features/products/pages/ProductsPage.tsx` (pagination pattern)


---

## 🔧 Branch Dropdown Status Filter Audit — COMPLETED ✅

| # | File | Status |
|---|------|--------|
| 1 | `JournalHeaderFilters.tsx` | ✅ Fixed — `{ status: 'active' }` |
| 2 | `PosSyncAggregatesFilters.tsx` | ✅ Fixed |
| 3 | `PosAggregatesFilters.tsx` | ✅ Fixed |
| 4 | `GenerateJournalModal.tsx` | ✅ Fixed |
| 5 | `PosTransactionsPage.tsx` | ✅ Fixed |
| 6 | `ChartOfAccountForm.tsx` | ✅ Fixed |
| 7 | `AccountingPurposeForm.tsx` | ✅ Fixed |
| 8 | `BranchAssignmentModal (employeeBranches.api)` | ✅ Fixed |
| 9 | `CashFlowPage` | ✅ OK — backend already filters `active + closed` |
| 10 | `TrialBalancePage` | ✅ OK — uses branchContext (includes closed for historical reports) |
| 11 | `IncomeStatementPage` | ✅ OK — same as TrialBalance |
| 12 | `BalanceSheetPage` | ✅ OK — same as TrialBalance |
| 13 | `PosAggregatesForm.tsx` | ✅ Already had `{ status: 'active' }` |
