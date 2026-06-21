# INVENTORY — Branch-Level Filtering Audit

> Generated: 2026-06-21  
> Last updated: 2026-06-21 (clarification round 4: multi-central per company)  
> Scope: Semua module backend + frontend yang menggunakan `company_id` dan/atau `branch_id`  
> Excluded: migrations, seed data, test files

---

## `[UPDATED — clarification round 4: multi-central per company]` Implementation Plan: Central Branch

### Keputusan Produk (Final)

- Branch "Central" = row biasa di `branches` dengan flag `is_central = true`
- `branch_id` **wajib** di semua tabel transaksional/journal — tidak ada lagi NULL
- **Satu company boleh punya >1 Central branch** — TIDAK ada partial unique index
- Semua 3 service yang pakai Central di-trigger **manual dari UI oleh user** — bisa tampilkan dropdown pemilihan jika >1 Central
- Utility function return **array** (`getCentralBranches`), bukan single ID

---

### Step 1: Migration — `20260721_add_is_central_to_branches.sql`

```sql
-- ============================================================
-- Migration: Add is_central flag to branches
-- Purpose: Mark branches as "Central" for company-wide expenses
--          (admin bank, bunga, expense HO, etc.)
-- NOTE: Multiple Central branches per company ARE ALLOWED
-- ============================================================

-- 1. Add column
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_central BOOLEAN NOT NULL DEFAULT false;

-- 2. Comment
COMMENT ON COLUMN branches.is_central IS
  'true = branch ini menampung biaya umum company-wide (admin bank, bunga, expense HO). '
  'Boleh lebih dari 1 per company — user memilih via dropdown saat submit.';
```

**⚠️ TIDAK ADA partial unique index** — sengaja dihapus dari round 3. Bisa ada banyak `is_central = true` per company.

---

### Step 2: Seed — `[CONFIRMED]`

**Company: SUSHIMAS** (id: `3576839e-d83a-4061-8551-fe9b5d971111`) — satu-satunya company yang ada saat ini.

| branch_code | branch_name | is_sales | is_central |
|---|---|---|---|
| `CENTRAL_KITCHEN` | Central Kitchen | false | false |
| **`CENTRAL_STOCK`** | **Central Stock** | **false** | **→ true** |
| `BOG-001` | SUSHIMAS CIBINONG | true | false |
| `JKT-001` | SUSHIMAS CONDET | true | false |
| `DEP-001` | SUSHIMAS DEPOK | true | false |
| `BEK-001` | SUSHIMAS GRAND GALAXY | true | false |
| `BEK-002` | SUSHIMAS GRAND WISATA | true | false |

```sql
-- Seed Central branch
UPDATE branches SET is_central = true
WHERE id = 'd5acf3df-47b0-467b-a22b-d93493dddac2';
-- Branch: Central Stock, Company: SUSHIMAS
```

#### `[UPDATED — clarification round 4]` Company B Investigation

**Hasil**: Saat ini hanya ada **1 company** di database (`SUSHIMAS`). Tidak ada "Company B" — ini rencana masa depan. Tidak ada seed tambahan yang diperlukan sekarang.

Ketika Company B dibuat nanti, admin perlu:
1. Buat branch baru di Company B
2. Set `is_central = true` pada branch yang menjadi Central untuk Company B
3. Sistem otomatis mendukung ini tanpa code change (karena `getCentralBranches()` query per company_id)

---

### Step 3: Utility Function — `[UPDATED — clarification round 4]`

Lokasi: `backend/src/utils/branch-access.util.ts`

```typescript
// ── Central Branch ──

export interface CentralBranchOption {
  id: string
  branch_code: string
  branch_name: string
}

/**
 * Returns all Central branches for a company.
 * A company may have zero, one, or multiple Central branches.
 *
 * Caller (UI-facing service) is responsible for:
 * - If 0 results: surface error to user (no Central configured)
 * - If 1 result: may auto-select without prompting user
 * - If 2+ results: must prompt user to choose via dropdown
 */
export async function getCentralBranches(companyId: string): Promise<CentralBranchOption[]> {
  const { rows } = await pool.query(
    `SELECT id, branch_code, branch_name
     FROM branches
     WHERE company_id = $1 AND is_central = true AND status = 'active'
     ORDER BY branch_name`,
    [companyId]
  )
  return rows
}
```

**Tidak ada cache** — harus selalu fresh (daftar Central bisa berubah dari admin UI kapan saja).

**Unit test** (`backend/src/utils/__tests__/branch-access.test.ts`):

```typescript
describe('getCentralBranches', () => {
  it('should return array of Central branches for company with 1 Central', async () => {
    const result = await getCentralBranches(TEST_COMPANY_ID)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0]).toHaveProperty('id')
    expect(result[0]).toHaveProperty('branch_code')
    expect(result[0]).toHaveProperty('branch_name')
  })

  it('should return empty array for company without Central branch', async () => {
    const result = await getCentralBranches('00000000-0000-0000-0000-000000000000')
    expect(result).toEqual([])
  })

  it('should return multiple items for company with 2+ Central branches', async () => {
    // Requires test seed with 2+ is_central = true
    const result = await getCentralBranches(MULTI_CENTRAL_COMPANY_ID)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })
})
```

---

### Step 3b: New Endpoint — `GET /api/v1/branches/central`

Dibutuhkan oleh frontend untuk populate dropdown "Pilih Central Branch".

**Route**: Tambahkan di `backend/src/modules/branches/branches.routes.ts`

```typescript
// GET /api/v1/branches/central?company_id=xxx
router.get('/central', authenticate, async (req, res) => {
  const companyId = req.query.company_id as string || req.context?.company_id || ''
  const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
  requireCompanyAccess(companyId, companyIds)
  const centrals = await getCentralBranches(companyId)
  sendSuccess(res, centrals, 'Central branches retrieved')
})
```

---

### Step 4: Apply to Services — `[UPDATED — clarification round 4]`

**Perubahan paradigma**: Backend TIDAK lagi auto-resolve Central. Backend menerima `branch_id` dari request (dipilih user di frontend). Backend hanya **validasi** bahwa `branch_id` yang dikirim adalah Central branch yang valid untuk company tersebut.

#### 4a. `expense-categorization`

**Backend** — `expense-categorization.service.ts`:

```diff
+import { getCentralBranches } from '../../utils/branch-access.util'

   async generateJournal(
     companyIds: string[],
     statementIds: number[],
     userId: string,
-    options?: { journal_date?: string; description?: string }
+    options?: { journal_date?: string; description?: string; branch_id?: string }
   ): Promise<{ journal_id: string; journal_number: string; lines_count: number; total_amount: number }> {
     ...
     const companyId = stmts[0].company_id as string
     requireCompanyAccess(companyId, companyIds)
     ...

+    // Resolve Central branch
+    const centrals = await getCentralBranches(companyId)
+    if (centrals.length === 0) {
+      throw new BusinessRuleError('Belum ada Central branch dikonfigurasi untuk company ini')
+    }
+    let branchId: string
+    if (options?.branch_id) {
+      // Validate user-provided branch_id is a valid Central branch
+      if (!centrals.some(c => c.id === options.branch_id)) {
+        throw new BusinessRuleError('Branch yang dipilih bukan Central branch yang valid')
+      }
+      branchId = options.branch_id
+    } else if (centrals.length === 1) {
+      branchId = centrals[0].id
+    } else {
+      throw new BusinessRuleError('Company memiliki lebih dari 1 Central branch — pilih salah satu via parameter branch_id')
+    }

     const journal = await journalHeadersService.create({
       company_id: companyId,
+      branch_id: branchId,
       journal_date: journalDate,
       ...
     }, userId)
```

**Schema** — `expense-categorization.schema.ts`:

```diff
 export const generateJournalSchema = z.object({
   body: z.object({
     statement_ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
     journal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
     description: z.string().max(500).optional(),
+    branch_id: z.string().uuid().optional(),
   }),
 })
```

**Frontend** — `frontend/src/features/expense-categorization/pages/ExpenseCategorizationPage.tsx`:

- Fetch Central branches via `GET /api/v1/branches/central?company_id=X` saat page load
- If 1 result → auto-include `branch_id` in submit payload (no dropdown needed)
- If 2+ results → show dropdown "Pilih Central Branch" sebelum tombol "Generate Journal"
- If 0 results → disable tombol "Generate Journal" + show warning

#### 4b. `bank-mutation-entries`

**Backend** — `bank-mutation-entries.service.ts`:

```diff
+import { getCentralBranches } from '../../../utils/branch-access.util'

   async reconcileWithMutationEntry(
     dto: ReconcileBankStatementWithMutationEntryDto,
     userId: string,
     companyIds: string[],
   ): Promise<BankMutationEntryDetail> {
     const companyId = await this.resolveCompanyIdForMutation(companyIds, dto.bankStatementId)
     ...

+    // Resolve Central branch for journal
+    const centrals = await getCentralBranches(companyId)
+    if (centrals.length === 0) {
+      throw new BusinessRuleError('Belum ada Central branch dikonfigurasi untuk company ini')
+    }
+    let journalBranchId: string
+    if (dto.branchId) {
+      if (!centrals.some(c => c.id === dto.branchId)) {
+        throw new BusinessRuleError('Branch yang dipilih bukan Central branch yang valid')
+      }
+      journalBranchId = dto.branchId
+    } else if (centrals.length === 1) {
+      journalBranchId = centrals[0].id
+    } else {
+      throw new BusinessRuleError('Company memiliki lebih dari 1 Central branch — pilih salah satu')
+    }

     // Pass to createJournalForEntry
-    await this.createJournalForEntry(entry.id, { companyId, ... }, userId)
+    await this.createJournalForEntry(entry.id, { companyId, branchId: journalBranchId, ... }, userId)
```

**Schema** — `bank-mutation-entries.schema.ts`:

```diff
 export const reconcileWithMutationEntrySchema = z.object({
   body: z.object({
     ...
+    branchId: z.string().uuid().optional(),
   }),
 })
```

**Frontend** — `frontend/src/features/bank-reconciliation/components/reconciliation/NonPosReconcileModal.tsx`:

- Fetch Central branches saat modal dibuka
- If 1 → auto-include in payload
- If 2+ → show dropdown field "Central Branch" di form
- If 0 → show error, block submit

#### 4c. `fiscal-periods`

**Backend** — `fiscal-periods.service.ts`:

```diff
+import { getCentralBranches } from '../../../utils/branch-access.util'

   async closePeriodWithEntries(id: string, dto: ClosePeriodWithEntriesDto, ...): Promise<...> {
     ...

+    // Resolve Central branch for closing journal
+    const centrals = await getCentralBranches(companyId)
+    if (centrals.length === 0) {
+      throw new BusinessRuleError('Belum ada Central branch untuk closing journal')
+    }
+    let closingBranchId: string
+    if (dto.branch_id) {
+      if (!centrals.some(c => c.id === dto.branch_id)) {
+        throw new BusinessRuleError('Branch yang dipilih bukan Central branch yang valid')
+      }
+      closingBranchId = dto.branch_id
+    } else if (centrals.length === 1) {
+      closingBranchId = centrals[0].id
+    } else {
+      throw new BusinessRuleError('Pilih Central branch untuk closing journal')
+    }

     const headerRes = await client.query(
       `INSERT INTO journal_headers (
         company_id, branch_id, journal_number, ...
-      ) VALUES ($1, NULL, $2, $3, ...)`,
-      [companyId, journalNumber, seq, ...]
+      ) VALUES ($1, $2, $3, $4, ...)`,
+      [companyId, closingBranchId, journalNumber, seq, ...]
     )
```

**DTO** — `fiscal-period.types.ts`:

```diff
 export interface ClosePeriodWithEntriesDto {
   retained_earnings_account_id: string
   close_reason?: string
+  branch_id?: string
 }
```

**Frontend** — `frontend/src/features/accounting/fiscal-periods/components/ClosePeriodModal.tsx`:

- Fetch Central branches saat modal dibuka
- If 1 → auto-include in payload (silent, no extra field)
- If 2+ → show dropdown "Central Branch untuk Closing Journal" di step confirm
- If 0 → block closing + show error

---

### Step 5: Fiscal Period Closing — `[CONFIRMED round 3, updated round 4]`

Temuan: `fiscal-periods.service.ts:918` explicitly sets `branch_id = NULL`.
Keputusan: default ke Central branch, dipilih user via UI (lihat Step 4c).

---

### Step 6: Backfill & Migration `bank_mutation_entries`

_(Tidak berubah dari round 3 — migration tambah kolom `branch_id`, backfill ke Central. Detail lihat round 3.)_

```sql
-- Migration
ALTER TABLE bank_mutation_entries ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
CREATE INDEX IF NOT EXISTS idx_bme_branch_id ON bank_mutation_entries(branch_id) WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

-- Backfill (setelah seed Central)
UPDATE bank_mutation_entries bme
SET branch_id = (
  SELECT b.id FROM branches b
  WHERE b.company_id = bme.company_id AND b.is_central = true
  LIMIT 1
)
WHERE bme.branch_id IS NULL;
```

### Step 6b: `journal_headers` — **TIDAK PERLU BACKFILL** (confirmed: 0 NULL rows)

---

### `[UPDATED — clarification round 4]` Frontend UI Components for Central Dropdown

| Service | Frontend File | Action Trigger |
|---|---|---|
| expense-categorization | `frontend/src/features/expense-categorization/pages/ExpenseCategorizationPage.tsx` | Button "📝 Generate Journal" (line ~300) |
| bank-mutation-entries | `frontend/src/features/bank-reconciliation/components/reconciliation/NonPosReconcileModal.tsx` | Submit button di modal reconcile non-POS |
| fiscal-periods | `frontend/src/features/accounting/fiscal-periods/components/ClosePeriodModal.tsx` | Confirm step di modal close period |

Masing-masing komponen perlu:
1. Fetch `GET /api/v1/branches/central?company_id=X`
2. Logic: 0 → block+error, 1 → auto-select, 2+ → show dropdown
3. Include `branch_id` di request payload ke backend

---

## Kategori A — Query ke tabel dengan `company_id`/`branch_id` (sudah benar)

_(Tidak berubah — ~35 modules verified ✓)_

### Accounting Reports
- [x] Trial Balance, Balance Sheet, Income Statement, General Ledger, Daily Ledger, Journals ✓

### Transactional Modules
- [x] Purchase Orders, Purchase Invoices, Goods Receipts, AP Payments, General Invoices ✓
- [x] Stock, Stock Adjustments, Stock Transfers, Fixed Assets ✓
- [x] Daily Prep Orders, Daily Stock Opname, Monthly Stock Opname, Production Requests, Goods Processing ✓

### POS & Sales
- [x] All POS modules ✓

### Reports & Dashboard
- [x] Waste Report, Shortage Report, COGS, Theoretical Consumption, Cash Flow ✓
- [x] Dashboard HRD ✓
- [x] All frontend accounting report pages (Trial Balance, Balance Sheet, Income Statement, Cash Flow) ✓

---

## Kategori B — Report/endpoint dengan filter `company_id` tapi belum `branch_id`

### Reconciliation Module
- [ ] `fee-reconciliation.repository.ts:getFeeDiscrepancies` — perlu branch filter
- [ ] `bank-reconciliation.repository.ts:1064` — perlu branch filter
- [ ] `bank-settlement-group.repository.ts:65` — perlu branch filter
- [ ] `fee-discrepancy-review.repository.ts:21` — perlu branch filter

### Cash Counts
- [ ] `cash-counts.repository.ts:42` — kolom `branch_id` sudah ada di schema, belum dipakai di query

### Bank Mutation Entries
- [ ] `bank-mutation-entries.repository.ts:62` — perlu migration + filter (detail di Step 6)

### Balance Sheet
- [ ] `balance-sheet.repository.ts:73` — `getRetainedEarnings()` perlu branch filter

### Frontend UI
- [ ] `BankReconciliationPage.tsx` — perlu branch selector
- [ ] `FeeDiscrepancyReviewPage.tsx` — perlu branch filter dropdown

---

## Kategori C — UI yang select company tapi belum select branch

- [ ] `ChartOfAccountsPage.tsx:116`
- [ ] `DashboardPage.tsx:37`
- [ ] `DashboardSalesPage.tsx:69`
- [ ] `BankStatementImportListPage.tsx`

---

## Kategori D — Query yang assume company = isolasi data penuh

### Perlu Fix
- [ ] `balance-sheet.repository.ts:73` — `getRetainedEarnings()` perlu branch filter
- [ ] `expense-categorization.service.ts:237` — Central branch via user selection (Step 4a)
- [ ] `fiscal-periods.service.ts:918` — Central branch via user selection (Step 4c)

### By-Design (Tidak Perlu Perubahan)
- [x] `cash-flow-sales.repository.ts:188` — payment_method_groups display-only ✓
- [x] `pricelists.repository.ts:56` — shared pricing ✓
- [x] `accounting-purposes.repository.ts:43` — company config ✓
- [x] `cash-flow-sales.repository.ts:47-129` — period balances per bank account ✓
- [x] `payment-method-alerts.service.ts` — notification, bukan financial record ✓
- [x] `NotificationRoutingPage.tsx` — subscriber routing ✓

---

## Perlu Ditinjau Manual — Remaining

| # | File | Status | Alasan |
|---|---|---|---|
| 1 | `DashboardPage.tsx` | **Masih open** | Explicit branch filter pada dashboard? |
| 2 | `bank-reconciliation/` | **Masih open** | Branch filter di reconciliation UI? |

**2 UX decisions remaining** — non-blocking untuk Tahap 2.

---

## Summary Statistics (Final)

| Kategori | Total Items | Status |
|----------|-------------|--------|
| A (Sudah benar) | ~35 modules | ✅ No action needed |
| B (Perlu tambah branch filter) | 10 items | ⚠️ Siap fix |
| C (UI perlu branch selector) | 4 items | ⚠️ Siap fix |
| D (Perlu fix) | 3 items | ⚠️ Siap fix |
| Perlu Ditinjau Manual | 2 items (UX only) | 🔍 Non-blocking |

---

## Execution Dependencies (Urutan) — `[UPDATED round 4]`

```
1. Migration: is_central on branches (NO unique index)
   ↓
2. Seed: CENTRAL_STOCK → is_central = true
   ↓
3. Migration: branch_id on bank_mutation_entries
   ↓
4. Backfill: bank_mutation_entries → Central (LIMIT 1)
   ↓
5. Utility: getCentralBranches() di branch-access.util.ts
   ↓
6. Endpoint: GET /api/v1/branches/central
   ↓
7. Service fixes + schema updates (parallel):
   ├── expense-categorization (service + schema + controller)
   ├── bank-mutation-entries (service + schema)
   └── fiscal-periods (service + DTO)
   ↓
8. Frontend Central dropdown (parallel):
   ├── ExpenseCategorizationPage.tsx
   ├── NonPosReconcileModal.tsx
   └── ClosePeriodModal.tsx
   ↓
9. Kategori B fixes (query filters)
   ↓
10. Kategori C fixes (UI branch selectors)
   ↓
11. Retained earnings fix (Kategori D)
```

---

## ✅ READY FOR TAHAP 2

Semua investigasi selesai. Semua keputusan produk sudah final:
- Central branch = `CENTRAL_STOCK` untuk SUSHIMAS
- Multi-central allowed (no unique constraint)
- User pilih via dropdown jika >1
- Auto-select jika exactly 1

**Tunggu konfirmasi manusia untuk mulai eksekusi Tahap 2.**
