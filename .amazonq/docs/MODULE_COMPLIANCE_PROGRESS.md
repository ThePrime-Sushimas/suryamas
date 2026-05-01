# Module Compliance Fix — Progress Tracker

## Phase 1: COMPLETED ✅ (25 modules)
bank-accounts, payment-methods, payment-terms, cash-counts, cash-flow, permissions, pricelists, product-uoms, users, auth, expense-categorization, jobs, monitoring, pos-sync, sub-categories, supplier-products, products, branches, categories, employees, companies, employee_branches, suppliers, banks, metric-units

## Phase 2: Remaining 17 Modules (accounting, reconciliation, pos-imports)

### Pattern (sama seperti Phase 1):
1. Baca controller + routes
2. Rewrite controller: `Request` from express, `ValidatedAuthRequest` cast inside method, `await handleError(res, error, req, { action })`, `error: unknown`, no `withValidated`/`getParamString`/`AuthRequest`/`as any`
3. Rewrite routes: remove legacy casts, clean `(req, res) =>`, `.catch((err) => console.error(...))`
4. Fix FE store: `parseApiError()` from `@/lib/errorParser`
5. Verify: `cd backend && npx tsc --noEmit && npx tsc`
6. Update DEV_STATUS.md

### Priority Order (by issue count — biggest first):

#### Tier 1: Heavy (30+ legacy patterns)
1. ✅ `pos-imports/pos-aggregates` — done — BE: 48 patterns, 23 no-await. FE: 15 issues
2. ✅ `accounting/journals/journal-headers` — done — BE: 42 patterns, 15 no-await. FE: 12 issues
3. ✅ `accounting/chart-of-accounts` — done — BE: 31 patterns, 16 no-await. FE: 12 issues
4. ✅ `pos-imports/pos-imports` — done — BE: 31 patterns, 12 no-await. FE: 7 issues
5. ✅ `accounting/accounting-purposes` — done — BE: 30 patterns, 15 no-await. FE: 8 issues
6. ✅ `reconciliation/bank-statement-import` — done — BE: 28 patterns, 21 no-await. FE: 1 issue
7. ✅ `accounting/accounting-purpose-accounts` — done — BE: 28 patterns, 12 no-await. FE: 13 issues
8. ✅ `accounting/fiscal-periods` — done — BE: 28 patterns, 11 no-await. FE: 10 issues

#### Tier 2: Medium (10-30 legacy patterns)
9. ⬜ `reconciliation/bank-reconciliation` — BE: 20 patterns, 1 no-await. FE: N/A (hooks)
10. ⬜ `accounting/journals/journal-lines` — BE: 12 patterns, 5 no-await. FE: 3 issues
11. ⬜ `reconciliation/bank-settlement-group` — BE: 11 patterns, 1 no-await. FE: N/A (hooks)

#### Tier 3: Light (< 10 legacy patterns)
12. ⬜ `accounting/trial-balance` — BE: 6 patterns, 2 no-await. FE: N/A (page-level)
13. ⬜ `accounting/income-statement` — BE: 6 patterns, 2 no-await. FE: N/A (page-level)
14. ⬜ `accounting/balance-sheet` — BE: 6 patterns, 2 no-await. FE: N/A (page-level)
15. ⬜ `reconciliation/fee-reconciliation` — BE: 3 patterns, 1 no-await. FE: N/A
16. ⬜ `pos-imports/pos-transactions` — BE: 3 patterns, 3 no-await. FE: N/A
17. ⬜ `pos-sync-aggregates` — BE: 0 patterns. FE: N/A (already clean)

### Key files:
- Patokan: `.amazonq/docs/DEV_STATUS.md` + `.amazonq/rules/Basic.md`
- Express augmentation: `backend/src/types/express.d.ts`
- Global error parser: `frontend/src/lib/errorParser.ts` → `parseApiError()`
- Postgres error helper: `backend/src/utils/postgres-error.util.ts` → `isPostgresError()`
- Reference controller: `backend/src/modules/branches/branches.controller.ts`
