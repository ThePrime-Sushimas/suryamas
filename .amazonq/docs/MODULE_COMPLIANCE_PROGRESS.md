# Module Compliance Fix — Progress Tracker

## Status: 7 Remaining Partial Modules (BE Controller Rewrite)

FE store sudah fix (`parseApiError`). Yang perlu: rewrite BE controller + routes untuk hapus legacy imports.

### Remaining:
1. ✅ `categories` — done
2. ⬜ `employees` — `getParamString`
3. ⬜ `companies` — `getParamString`
4. ⬜ `employee_branches` — `getParamString`
5. ⬜ `suppliers` — `withValidated`, `req as unknown as Request`
6. ⬜ `banks` — `withValidated`, `req as unknown as Request`
7. ⬜ `metric-units` — `getParamString`, `AuthenticatedRequest`. Routes: legacy casts

### Completed (this session — 17 full rewrites + 8 FE store fixes):
✅ bank-accounts, payment-methods, payment-terms, cash-counts, cash-flow, permissions, pricelists, product-uoms, users, auth, expense-categorization, jobs, monitoring, pos-sync, sub-categories, supplier-products, products, branches

### Pattern (proven — follow exactly):
1. Read controller + routes files
2. Rewrite controller:
   - `Request` from express (not `AuthRequest`/`AuthenticatedRequest`)
   - `ValidatedAuthRequest<typeof schema>` cast inside method body (not in signature)
   - `req.user?.id ?? ''` (not `req.user!.id`)
   - `await handleError(res, error, req, { action: '...' })` with descriptive action
   - `error: unknown` in all catch blocks
   - No `withValidated` wrapper — plain arrow functions
   - No `getParamString` — use validated params or `req.params.x`
3. Rewrite routes:
   - Remove all `AuthenticatedRequest`/`AuthenticatedQueryRequest`/`ValidatedAuthRequest` casts
   - Clean `(req, res) => controller.method(req, res)` for ALL routes
   - `.catch((err) => console.error(...))` for registerModule (not silent)
4. Verify: `cd backend && npx tsc --noEmit` then `npx tsc`
5. Update DEV_STATUS.md: BE table row + move from partial to fully compliant

### Reference file:
`backend/src/modules/branches/branches.controller.ts` — just rewritten, use as template.

### Key files:
- Patokan: `.amazonq/docs/DEV_STATUS.md` + `.amazonq/rules/Basic.md`
- Express augmentation: `backend/src/types/express.d.ts` (has `sort`, `queryFilter`, `filterParams`, `context`, `user`, `validated`, `pagination`)
- Global error parser: `frontend/src/lib/errorParser.ts` → `parseApiError()`
- Postgres error helper: `backend/src/utils/postgres-error.util.ts` → `isPostgresError()`
