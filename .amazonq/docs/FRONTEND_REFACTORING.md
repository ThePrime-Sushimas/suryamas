# Frontend Refactoring Tracker

## Pattern Target
Semua halaman harus mengikuti pattern yang sudah diterapkan di:
- `food-production/*` (React Query, inline table, info cards)
- `products/*` (refactored)
- `suppliers/*` (refactored)
- `product-uoms/*` (refactored)

### Checklist per halaman:
- [ ] Zustand store → React Query hooks
- [ ] `useEffect` fetch → `useQuery` (cached, deduplicated)
- [ ] Labels English → Indonesian
- [ ] Edit page: info cards di atas form
- [ ] Loading state: skeleton yang match layout
- [ ] Empty state: icon + text
- [ ] Double API call fixed (React Query staleTime)
- [ ] `parseApiError()` untuk semua error handling
- [ ] `ConfirmModal` (bukan native `confirm()`)

---

## ✅ Selesai

| Halaman | Tanggal | Notes |
|---------|---------|-------|
| `/products` | 2026-05-07 | Full rewrite, avg cost + base unit |
| `/products/:id/edit` | 2026-05-07 | Info cards, polished, Kelola UOM button |
| `/products/create` | 2026-05-07 | Polished header (icon + subtitle) |
| `/products/:id/uoms` | 2026-05-07 | React Query, product name in header, back to edit |
| `/suppliers` | 2026-05-07 | Full rewrite |
| `/suppliers/:id/edit` | 2026-05-07 | Info cards, bank accounts section |
| `/suppliers/create` | 2026-05-07 | Polished header, ConfirmModal cancel |
| `/metric-units` | 2026-05-07 | React Query, polished |
| `/metric-units/new` | 2026-05-07 | React Query, polished header |
| `/metric-units/:id/edit` | 2026-05-07 | React Query, FormSkeleton, info subtitle |
| `/categories` | 2026-05-07 | React Query, toggle status inline |
| `/categories/new` | 2026-05-07 | React Query, polished header |
| `/categories/:id/edit` | 2026-05-07 | React Query, FormSkeleton |
| `/sub-categories` | 2026-05-07 | React Query, category filter dropdown |
| `/sub-categories/new` | 2026-05-07 | React Query |
| `/sub-categories/:id/edit` | 2026-05-07 | React Query, FormSkeleton |
| `/branches` | 2026-05-07 | React Query, simplified |
| `/branches/new` | 2026-05-07 | React Query, polished header |
| `/branches/:id/edit` | 2026-05-07 | React Query, info cards, FormSkeleton |
| `/payment-terms` | 2026-05-07 | React Query, inline filter, polished |
| `/payment-terms/new` | 2026-05-07 | React Query, polished header |
| `/payment-terms/:id/edit` | 2026-05-07 | React Query, FormSkeleton, deleted guard |

---

## 🔲 Belum Dikerjakan

### Priority 1 — Simple CRUD (cepat selesai)

| Halaman | Store File | Est. Effort |
|---------|-----------|-------------|
| `/payment-methods` | `payment-methods/store/paymentMethods.store.ts` | Skipped — single page, store shared with POS |

### Priority 2 — Medium Complexity

| Halaman | Store File | Est. Effort |
|---------|-----------|-------------|
| `/supplier-products` | `supplier-products/store/supplierProducts.store.ts` | Medium |
| `/pricelists` | `pricelists/store/pricelists.store.ts` | Medium |
| `/bank-accounts` | `bank-accounts/store/useBankAccounts.ts` | Medium |
| `/employees` | `employees/store/employee.store.ts` | Medium |
| `/users` | `users/store/users.store.ts` | Medium |
| `/companies` | `companies/store/companies.store.ts` | Small |
| `/employee-branches` | `employee_branches/store/employeeBranches.store.ts` | Small |

### Priority 3 — Complex / Bisa Nanti

| Halaman | Store File | Notes |
|---------|-----------|-------|
| `/accounting/journals` | `journals/journal-headers/store` + `journal-lines/store` | Complex, 2 stores |
| `/accounting/chart-of-accounts` | `chart-of-accounts/store` | Tree structure |
| `/accounting/trial-balance` | `trial-balance/store` | Report, mungkin tetap Zustand |
| `/accounting/balance-sheet` | `balanceSheet.store.ts` | Report |
| `/accounting/income-statement` | `incomeStatement.store.ts` | Report |
| `/accounting/fiscal-periods` | `fiscalPeriods.store.ts` | Simple tapi jarang dipakai |
| `/accounting/purposes` | `accountingPurposes.store.ts` | Already decent |
| `/pos-aggregates` | `posAggregates.store.ts` | Complex filters |
| `/pos-imports` | `pos-imports.store.ts` | File upload flow |
| `/pos-sync-aggregates` | `posSyncAggregates.store.ts` | Complex |
| `/bank-statement-import` | `bank-statement-import.store.ts` | File upload flow |
| `/cash-counts` | `cashCounts.store.ts` | Medium |
| `/monitoring` | `monitoring.store.ts` | Dashboard |
| `/permissions` | `permissions.store.ts` | Role-based, complex |

### JANGAN Di-refactor (tetap Zustand)

| Store | Alasan |
|-------|--------|
| `auth/store/auth.store.ts` | Global auth state, persist |
| `branch_context/store/branchContext.store.ts` | Global context, persist |
| `branch_context/store/permission.store.ts` | Global permissions |
| `jobs/store/jobs.store.ts` | Background job polling |

---

## Notes

- Accounting reports (trial balance, balance sheet, income statement) mungkin lebih cocok tetap Zustand karena heavy computation + filter state yang complex
- POS-related pages (aggregates, imports, sync) punya flow yang complex — refactor nanti saat ada waktu
- Bank reconciliation sudah pakai custom hooks (`useSettlementGroups`) — pattern sudah oke, hanya perlu polish UI
