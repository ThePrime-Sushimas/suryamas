# Multi-Company — Suryamas ERP

> **Status:** Active refactor (May 2026). Many modules updated; not all forms/APIs migrated yet.
> Read this before touching branch-scoped transactions, WIP, production orders, or COA.

---

## Model

- One user can access **multiple companies** via `employee_branches` → `branches.company_id`.
- **Header branch context** (`x-branch-id` / `req.context.company_id`) = company of the **active** branch in the UI switcher.
- **Form-selected branch** (`body.branch_id`) may differ from header context on transaction forms (PR, PO, production order, DPO, etc.).

**Never assume** `getWriteScope().companyId` equals the company of `body.branch_id`.

---

## Backend patterns

| Use case | Scope | Company resolution |
|----------|--------|-------------------|
| List / getById (read) | `getReadScope()` → `companyIds[]` | `WHERE company_id = ANY($1::uuid[])` |
| Create with `branch_id` in body | `getCompanyIdForBranch(branch_id)` | Order/header `company_id` = branch's company |
| Mutations on existing doc (complete, void, journal) | `findByIdAccessible(id, companyIds)` + `requireBranchAccess(order.branch_id)` | Use `order.company_id` for COA/fiscal/journal |
| Master data dropdown filter | Optional query `company_id` + `requireCompanyAccess` | Narrow list to one company |

### Reference implementations

- `backend/src/utils/branch-access.util.ts` — `getReadScope`, `getWriteScope`, `getCompanyIdForBranch`, `requireBranchAccess`, `requireCompanyAccess`
- `backend/src/modules/food-production/production-orders/` — create + complete (May 2026 fix)
- `backend/src/modules/daily-prep-orders/daily-prep-orders.service.ts` — `generate()` uses `getCompanyIdForBranch`
- `backend/src/modules/purchase-invoices/purchase-invoices.service.ts`
- `backend/src/modules/stock/stock.service.ts`

### Anti-patterns (cause 404 / wrong company errors)

```typescript
// ❌ Wrong for forms that send branch_id
const { companyId } = await getWriteScope(req)
await repo.findById(id, companyId)

// ✅ Correct
const { companyIds } = await getReadScope(req)
const branchIds = await getAccessibleBranchIds(userId)
const order = await repo.findByIdAccessible(id, companyIds)
requireBranchAccess(order.branch_id, branchIds)
// use order.company_id for COA
```

---

## Frontend patterns

- Transaction forms: `useUserBranches()` includes `company_id` per branch.
- Default selected branch → `useBranchContextStore().currentBranch.branch_id` when available.
- Dependent dropdowns (WIP, warehouse, etc.): pass `company_id` from **selected branch**, fetch with `enabled: !!companyId`.
- Prefer `GET /wip-items?branch_id=...&filter_by_position=true` — server resolves `company_id` from branch (jangan kirim `company_id` manual dari frontend).
- Position filter pakai `resolveUserWipAccessForBranch` (employee_positions + position di `employee_branches` untuk cabang itu), bukan `findByUserPositions` saja.

### Production order form

`frontend/src/features/food-production/pages/ProductionOrderForm.tsx`

1. Auto-fill cabang from current branch context.
2. `useWipItems({ company_id: branchCompanyId }, { enabled: !!branchCompanyId })`.
3. Reset WIP lines when cabang changes.

---

## WIP & food production

- `wip_items.company_id` — WIP belongs to one company.
- Production order must use WIP where `wip.company_id === branch.company_id`.
- Position filter (`filter_by_position`) is independent of company filter.

---

## Checklist when adding/changing a transaction module

- [ ] Create: `company_id` from `getCompanyIdForBranch(body.branch_id)`, not header alone
- [ ] Read/update/delete: `findByIdAccessible` + `companyIds[]` from `getReadScope`
- [ ] `requireBranchAccess` on mutation
- [ ] COA / fiscal period / journal use **document's** `company_id`
- [ ] Frontend: filter master dropdowns by selected branch's `company_id`
- [ ] Document in this file if new edge case found

---

## Related docs

- `.amazonq/rules/memory-bank/CODING_PATTERNS.md` — multi-tenant SQL
- `.cursor/rules/suryamas-project-context.mdc` — always-applied pointer to this file


ATURAN AKSES DATA:

1. READ (list, getById, dropdown):
   - Pakai getReadScope(req) → { userId, companyIds }
   - Query filter: WHERE company_id = ANY($1::uuid[])
   - Repository harus punya findByIdAccessible(id, companyIds)
   - Guard: if (!companyIds.length) return null / []

2. WRITE master data (tidak punya branch_id di body):
   - Pakai getWriteScope(req) → { userId, companyIds, companyId }
   - companyId dari header branch context

3. WRITE transaksi (punya branch_id di body):
   - Validasi: requireBranchAccess(branch_id, branchIds)
   - Derive company: getCompanyIdForBranch(branch_id)
   - JANGAN pakai getWriteScope().companyId

4. MUTATE existing record (update/delete):
   - getReadScope() + findByIdAccessible() untuk verifikasi akses
   - Pakai existing.company_id untuk operasi tulis
   - Pass existing ke service method untuk hindari double-fetch
   - Service method signature: update(id, companyId, dto, userId, existing?: T)

5. FILTER branch_id di query param:
   - Tidak perlu validasi requireBranchAccess
   - Semua branch dalam 1 company boleh lihat data satu sama lain
   - Filter by companyIds sudah cukup

POLA REPOSITORY:
- findAll: WHERE company_id = ANY($1::uuid[])
- findByIdAccessible: WHERE id = $1 AND company_id = ANY($2::uuid[])
- findAll dan findByIdAccessible harus ada guard if (!companyIds.length) return null/[]
- findById(id, companyId) tetap dipertahankan untuk internal service calls

SHARED UTILS (branch-access.util.ts):
- getReadScope(req): Promise<{ userId, companyIds }>
- getWriteScope(req): Promise<{ userId, companyIds, companyId }>
- getBranchReadScope(req): Promise<{ userId, companyIds, branchIds }>
- getAccessibleCompanyIds(userId): Promise<string[]>
- getAccessibleBranchIds(userId): Promise<string[]>
- requireBranchAccess(branchId, branchIds): void
- getCompanyIdForBranch(branchId): Promise<string | null>
