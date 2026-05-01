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
- [ ] PO Flow (Purchase Order → Receiving → AP → Payment → Auto Journal)
- [ ] COGS calculation (HPP dari inventory movement)
- [ ] Laporan Arus Kas formal PSAK 2 (3 aktivitas: operasi/investasi/pendanaan)
- [ ] User Management — create account dari UI (backend POST /auth/register sudah ada)
- [ ] Deploy ke production (Nginx config, PM2, SSL via Certbot)

### Responsive UI Audit (108 pages)

Legend: 🟢 = responsive (>10 breakpoints), 🟡 = partial (1-10 breakpoints), 🔴 = none (0 breakpoints)
`bp` = breakpoint classes, `grid` = grid-cols, `ovf` = overflow-x-auto, `tbl` = table elements

#### 🟢 Fully Responsive (10 pages)
| Page | bp | grid | ovf | tbl |
|------|----|------|-----|-----|
| branches/BranchDetailPage | 41 | 8 | 0 | 0 |
| employees/EmployeeDetailPage | 20 | 5 | 1 | 0 |
| employees/ProfilePage | 20 | 8 | 1 | 0 |
| permissions/PermissionsPage | 19 | 1 | 3 | 2 |
| pages/HomePage | 19 | 2 | 0 | 0 |
| employees/EmployeesPage | 18 | 1 | 0 | 0 |
| employee_branches/EmployeeBranchDetailPage | 15 | 0 | 0 | 0 |
| employee_branches/EmployeeBranchesPage | 15 | 0 | 1 | 2 |
| bank-reconciliation/settlement-groups/SettlementGroupDetailPage | 12 | 5 | 0 | 0 |
| accounting/journals/journal-headers/JournalHeaderDetailPage | 12 | 2 | 1 | 2 |

#### 🟡 Partially Responsive (52 pages)
| Page | bp | grid | ovf | tbl |
|------|----|------|-----|-----|
| auth/RegisterPage | 9 | 0 | 0 | 0 |
| employees/EditEmployeePage | 8 | 0 | 0 | 0 |
| users/UserEditPage | 8 | 1 | 0 | 0 |
| accounting/journals/journal-headers/JournalHeaderEditPage | 8 | 1 | 0 | 0 |
| cash-counts/CashCountsManagementPage | 7 | 4 | 3 | 8 |
| monitoring/MonitoringPage | 7 | 1 | 0 | 0 |
| accounting/fiscal-periods/FiscalPeriodsListPage | 7 | 1 | 0 | 0 |
| users/UserDetailPage | 7 | 0 | 0 | 0 |
| accounting/journals/journal-headers/JournalHeaderFormPage | 6 | 1 | 0 | 0 |
| pos-aggregates/PosAggregateDetailPage | 6 | 0 | 1 | 2 |
| accounting/journals/journal-headers/JournalHeadersListPage | 5 | 0 | 0 | 0 |
| companies/CompaniesDetailPage | 5 | 2 | 0 | 0 |
| dashboard/DashboardPage | 5 | 3 | 0 | 0 |
| users/UsersPage | 5 | 0 | 0 | 0 |
| banks/EditBankPage | 4 | 0 | 0 | 0 |
| dashboard/DashboardSalesPage | 4 | 3 | 0 | 0 |
| accounting/accounting-purposes/AccountingPurposeDetailPage | 3 | 2 | 0 | 0 |
| bank-statement-import/BankStatementImportDetailPage | 3 | 3 | 1 | 2 |
| bank-statement-import/BankStatementImportListPage | 3 | 2 | 1 | 3 |
| banks/BanksListPage | 3 | 0 | 0 | 0 |
| banks/CreateBankPage | 3 | 0 | 0 | 0 |
| dashboard/DashboardAccountingPage | 3 | 3 | 0 | 0 |
| pricelists/PricelistDetailPage | 3 | 3 | 0 | 0 |
| accounting/balance-sheet/BalanceSheetPage | 2 | 1 | 1 | 2 |
| accounting/income-statement/IncomeStatementPage | 2 | 1 | 1 | 2 |
| accounting/accounting-purpose-accounts/AccountingPurposeAccountsListPage | 2 | 0 | 0 | 0 |
| auth/LoginPage | 2 | 0 | 0 | 0 |
| bank-reconciliation/FeeDiscrepancyReviewPage | 2 | 1 | 1 | 2 |
| bank-reconciliation/BankReconciliationPage | 2 | 1 | 0 | 0 |
| cash-flow/CashFlowPage | 2 | 1 | 2 | 1 |
| dashboard/DashboardFinancePage | 2 | 2 | 0 | 0 |
| dashboard/DashboardHRDPage | 2 | 2 | 0 | 0 |
| employees/CreateEmployeePage | 2 | 0 | 0 | 0 |
| expense-categorization/ExpenseCategorizationPage | 2 | 2 | 1 | 4 |
| pos-transactions/PosTransactionsPage | 2 | 4 | 1 | 3 |
| products/ProductDetailPage | 2 | 2 | 0 | 0 |
| supplier-products/SupplierProductDetailPage | 2 | 3 | 0 | 0 |
| suppliers/SupplierDetailPage | 2 | 2 | 0 | 0 |
| accounting/accounting-purpose-accounts/AccountingPurposeAccountsDeletedPage | 1 | 0 | 1 | 2 |
| accounting/trial-balance/TrialBalancePage | 1 | 0 | 1 | 2 |
| bank-reconciliation/settlement-groups/SettlementGroupsPage | 1 | 0 | 0 | 0 |
| branches/CreateBranchPage | 1 | 0 | 0 | 0 |
| branches/EditBranchPage | 1 | 0 | 0 | 0 |
| categories/CreateCategoryPage | 1 | 0 | 0 | 0 |
| categories/CreateSubCategoryPage | 1 | 0 | 0 | 0 |
| categories/EditCategoryPage | 1 | 0 | 0 | 0 |
| categories/EditSubCategoryPage | 1 | 0 | 0 | 0 |
| companies/CreateCompanyPage | 1 | 0 | 0 | 0 |
| companies/EditCompanyPage | 1 | 0 | 0 | 0 |
| metric_units/CreateMetricUnitPage | 1 | 0 | 0 | 0 |
| metric_units/EditMetricUnitPage | 1 | 0 | 0 | 0 |
| payment-terms/CreatePaymentTermPage | 1 | 0 | 0 | 0 |
| payment-terms/EditPaymentTermPage | 1 | 0 | 0 | 0 |
| pos-aggregates/FailedTransactionsPage | 1 | 1 | 0 | 2 |
| pos-imports/PosImportDetailPage | 1 | 2 | 1 | 2 |
| pos-imports/PosImportsPage | 1 | 1 | 0 | 0 |
| pos-sync-aggregates/PosSyncAggregateDetailPage | 1 | 1 | 1 | 2 |
| pos-sync-aggregates/PosSyncAggregatesPage | 1 | 1 | 1 | 2 |
| pricelists/PricelistsPage | 1 | 1 | 0 | 0 |
| products/ProductsPage | 1 | 1 | 0 | 0 |

#### 🔴 Not Responsive (46 pages)
| Page | grid | ovf | tbl | Priority |
|------|------|-----|-----|----------|
| accounting/chart-of-accounts/ChartOfAccountsPage | 0 | 0 | 1 | ⚠️ table tanpa overflow |
| bank-statement-import/ManualEntryPage | 0 | 0 | 2 | ⚠️ 2 tables tanpa overflow |
| pos-staging/PosStagingPage | 0 | 1 | 2 | has overflow |
| suppliers/SuppliersPage | 0 | 1 | 2 | has overflow |
| accounting/chart-of-accounts/ChartOfAccountDetailPage | 1 | 0 | 0 | has grid |
| categories/CategoriesPage | 1 | 0 | 0 | has grid |
| categories/CategoryDetailPage | 1 | 0 | 0 | has grid |
| categories/SubCategoriesPage | 1 | 0 | 0 | has grid |
| categories/SubCategoryDetailPage | 1 | 0 | 0 | has grid |
| companies/CompaniesPage | 1 | 0 | 0 | has grid |
| metric_units/MetricUnitsPage | 1 | 0 | 0 | has grid |
| pricelists/CreatePricelistPage | 2 | 0 | 0 | has grid |
| supplier-products/EditSupplierProductPage | 1 | 0 | 0 | has grid |
| payment-terms/PaymentTermDetailPage | 3 | 0 | 0 | has grid |
| accounting/accounting-purpose-accounts/AccountingPurposeAccountFormPage | 0 | 0 | 0 | 🔴 zero |
| accounting/accounting-purpose-accounts/AccountingPurposeAccountsPage | 0 | 0 | 0 | 🔴 zero |
| accounting/accounting-purposes/AccountingPurposeFormPage | 0 | 0 | 0 | 🔴 zero |
| accounting/accounting-purposes/AccountingPurposesListPage | 0 | 0 | 0 | 🔴 zero |
| accounting/accounting-purposes/AccountingPurposesPage | 0 | 0 | 0 | 🔴 zero |
| accounting/chart-of-accounts/CreateChartOfAccountPage | 0 | 0 | 0 | 🔴 zero |
| accounting/chart-of-accounts/EditChartOfAccountPage | 0 | 0 | 0 | 🔴 zero |
| accounting/fiscal-periods/FiscalPeriodEditPage | 0 | 0 | 0 | 🔴 zero |
| accounting/fiscal-periods/FiscalPeriodFormPage | 0 | 0 | 0 | 🔴 zero |
| accounting/fiscal-periods/FiscalPeriodsDeletedPage | 0 | 0 | 0 | 🔴 zero |
| accounting/fiscal-periods/FiscalPeriodsPage | 0 | 0 | 0 | 🔴 zero |
| accounting/journals/journal-headers/JournalHeadersDeletedPage | 0 | 0 | 0 | 🔴 zero |
| accounting/journals/journal-headers/JournalHeadersPage | 0 | 0 | 0 | 🔴 zero |
| auth/ForgotPasswordPage | 0 | 0 | 0 | 🔴 zero |
| auth/ResetPasswordPage | 0 | 0 | 0 | 🔴 zero |
| branches/BranchesPage | 0 | 0 | 0 | 🔴 zero |
| cash-flow/CashFlowSettingsPage | 0 | 0 | 0 | 🔴 zero |
| payment-methods/PaymentMethodsPage | 0 | 0 | 0 | 🔴 zero |
| payment-terms/PaymentTermsPage | 0 | 0 | 0 | 🔴 zero |
| pos-aggregates/CreatePosAggregatePage | 0 | 0 | 0 | 🔴 zero |
| pos-aggregates/EditPosAggregatePage | 0 | 0 | 0 | 🔴 zero |
| pos-aggregates/PosAggregatesPage | 0 | 0 | 0 | 🔴 zero |
| pricelists/CreatePricelistFromSupplierProductPage | 0 | 0 | 0 | 🔴 zero |
| pricelists/EditPricelistPage | 0 | 0 | 0 | 🔴 zero |
| pricelists/SupplierProductPricelistsPage | 0 | 0 | 0 | 🔴 zero |
| product-uoms/ProductUomsPage | 0 | 0 | 0 | 🔴 zero |
| products/CreateProductPage | 0 | 0 | 0 | 🔴 zero |
| products/EditProductPage | 0 | 0 | 0 | 🔴 zero |
| supplier-products/CreateSupplierProductPage | 0 | 0 | 0 | 🔴 zero |
| supplier-products/SupplierProductsPage | 0 | 0 | 0 | 🔴 zero |
| suppliers/CreateSupplierPage | 0 | 0 | 0 | 🔴 zero |
| suppliers/EditSupplierPage | 0 | 0 | 0 | 🔴 zero |

Note: Beberapa 🔴 pages delegate ke components yang sudah responsive (e.g. ProductsPage → ProductTable punya `overflow-x-auto`). `Pagination.tsx` sudah responsive (✅ fixed).

#### Pagination Usage Audit
26 pages pakai global `Pagination` component. Pages tanpa pagination yang **tidak perlu** pagination:
- Laporan (TrialBalance, IncomeStatement, BalanceSheet) — render semua rows
- Detail pages (JournalHeaderDetail, BranchDetail, ProfilePage, dll) — embedded sub-lists
- Dashboard pages — summary cards/charts
- Settings (CashFlowSettings, Permissions) — load all

Pages yang **mungkin perlu** pagination tapi belum pakai:
| Page | Alasan |
|------|--------|
| `UsersPage` | Client-side pagination (slice), bukan server-side. Bisa jadi masalah kalau user banyak |
| `PosAggregatesPage` | Pakai store pagination tapi custom UI, bukan global Pagination |
| `BankReconciliationPage` | Custom pagination via store `setPage`/`setPageSize` |
| `MonitoringPage` | Custom `onPageChange`/`onLimitChange`, bukan global Pagination |

#### Execution Order
| # | Scope | Pages | Effort |
|---|-------|-------|--------|
| 1 | ~~Global: `Pagination.tsx` + 2 table pages tanpa overflow~~ | ~~3~~ | ✅ Done |
| 2 | ~~Master Data list+form: products, suppliers, categories, companies, branches, metric-units, payment-methods, payment-terms, product-uoms~~ | ~~18~~ | ✅ Done |
| 3 | ~~Accounting: chart-of-accounts, accounting-purposes, accounting-purpose-accounts, fiscal-periods, journal-headers~~ | ~~15~~ | ✅ Done |
| 4 | POS & Reconciliation: pos-aggregates, pos-staging, cash-flow settings, manual-entry | 7 | Medium |
| 5 | Supplier Products & Pricelists | 7 | Medium |
| 6 | Auth: ForgotPassword, ResetPassword | 2 | Kecil |

#### Approach per page:
1. Wrap table dengan `overflow-x-auto` jika belum
2. Form layout: `grid grid-cols-1 md:grid-cols-2` untuk 2-column forms
3. Filter bar: stack vertical di mobile (`flex-col sm:flex-row`)
4. Action buttons: icon-only di mobile, icon+text di desktop
5. Card layout: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
6. Hide non-essential columns di mobile (`hidden md:table-cell`)

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
12. Middleware order: `authenticate → resolveBranchContext → permission → validateSchema`
13. Static routes (`/search`, `/trash`, `/bulk/delete`, `/export`, `/options/active`) WAJIB sebelum `/:id` (Express evaluasi top-to-bottom)
14. Schema HARUS dipasang di routes (entry point validation)
15. Lazy Initialization: getter pattern (`getS3()`) untuk service eksternal
16. S3Client (Cloudflare R2) WAJIB `forcePathStyle: true`

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
