# Petty Cash Module — Complete Design Document

## 1. Overview

Modul Petty Cash menggunakan model **request-based imprest system**:
- Cabang mengajukan request modal → approve → uang cair (DISBURSED)
- Expense dicatat realtime selama request aktif
- Settlement menutup periode: hitung sisa, jurnal, stock movement
- Sisa dikembalikan ke bank ATAU di-carry ke request baru

### State Machine

```
PENDING ──[approve]──→ DISBURSED ──[settlement posted]──→ CLOSED
   │
   └──[reject]──→ REJECTED (terminal)
```

### Constraint Utama
- **1 DISBURSED per branch** — cabang hanya boleh punya 1 request aktif
- Expense hanya bisa dicatat saat request status = DISBURSED
- Settlement hanya bisa dibuat saat request status = DISBURSED
- Void settlement BLOCKED kalau carried_to request sudah punya expenses

---

## 2. Database Schema

### 2.1. ALTER: `categories.affects_inventory`

```sql
ALTER TABLE categories
  ADD COLUMN affects_inventory BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN categories.affects_inventory IS
  'true = pengeluaran petty cash kategori ini masuk gudang (inventory-in)';
```

### 2.2. Tabel `petty_cash_requests`

```sql
CREATE TABLE petty_cash_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  branch_id             UUID NOT NULL REFERENCES branches(id),
  request_number        VARCHAR(30) NOT NULL,

  status                TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','DISBURSED','CLOSED','REJECTED')),

  amount_requested      NUMERIC(15,2) NOT NULL,
  amount_disbursed      NUMERIC(15,2),

  -- Carry dari request sebelumnya
  carried_from_id       UUID REFERENCES petty_cash_requests(id),
  carried_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- COA & bank
  petty_cash_coa_id     UUID NOT NULL REFERENCES chart_of_accounts(id),
  source_bank_account_id INTEGER REFERENCES bank_accounts(id),

  -- Jurnal disburse
  disburse_journal_id   UUID REFERENCES journal_headers(id),

  description           TEXT,
  notes                 TEXT,

  -- Approval trail
  submitted_by          UUID REFERENCES auth_users(id),
  submitted_at          TIMESTAMPTZ,
  approved_by           UUID REFERENCES auth_users(id),
  approved_at           TIMESTAMPTZ,
  rejected_by           UUID REFERENCES auth_users(id),
  rejected_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  closed_by             UUID REFERENCES auth_users(id),
  closed_at             TIMESTAMPTZ,

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID REFERENCES auth_users(id),
  updated_by            UUID REFERENCES auth_users(id),
  deleted_at            TIMESTAMPTZ,

  UNIQUE(company_id, request_number)
);

CREATE INDEX idx_pc_requests_branch
  ON petty_cash_requests(branch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_pc_requests_carried_from
  ON petty_cash_requests(carried_from_id) WHERE carried_from_id IS NOT NULL;
```

### 2.3. Tabel `petty_cash_settlements`

```sql
CREATE TABLE petty_cash_settlements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            UUID NOT NULL REFERENCES petty_cash_requests(id),
  company_id            UUID NOT NULL REFERENCES companies(id),
  branch_id             UUID NOT NULL REFERENCES branches(id),

  settlement_date       DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Kalkulasi (server-side)
  total_disbursed       NUMERIC(15,2) NOT NULL,
  total_expenses        NUMERIC(15,2) NOT NULL,
  remaining_balance     NUMERIC(15,2) NOT NULL,

  -- Keputusan sisa
  amount_returned       NUMERIC(15,2) NOT NULL DEFAULT 0,
  carried_to_id         UUID REFERENCES petty_cash_requests(id),

  -- Jurnal settlement
  journal_id            UUID REFERENCES journal_headers(id),

  -- Bank tujuan pengembalian sisa
  return_bank_account_id INTEGER REFERENCES bank_accounts(id),

  notes                 TEXT,

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID REFERENCES auth_users(id),
  updated_by            UUID REFERENCES auth_users(id),

  UNIQUE(request_id)
);
```

### 2.4. Tabel `petty_cash_expenses`

```sql
CREATE TABLE petty_cash_expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID NOT NULL REFERENCES petty_cash_requests(id),
  company_id        UUID NOT NULL REFERENCES companies(id),
  branch_id         UUID NOT NULL REFERENCES branches(id),

  expense_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  amount            NUMERIC(15,2) NOT NULL,
  description       TEXT,

  -- Kategorisasi
  category_id       UUID NOT NULL REFERENCES categories(id),
  sub_category_id   UUID REFERENCES sub_categories(id),

  -- COA expense (default dari purpose, bisa override per line)
  expense_coa_id    UUID REFERENCES chart_of_accounts(id),

  -- Inventory fields (wajib kalau category.affects_inventory = true)
  product_id        UUID REFERENCES products(id),
  product_uom_id    UUID REFERENCES product_uoms(id),
  qty               NUMERIC(15,4),
  unit_price        NUMERIC(15,2),
  warehouse_id      UUID REFERENCES warehouses(id),
  stock_movement_id UUID,  -- Loose UUID (no FK, konsisten dgn codebase)

  -- Link ke settlement (diisi saat settlement di-post)
  settlement_id     UUID,  -- FK ditambah via ALTER setelah settlements dibuat

  -- Receipt/struk
  receipt_url       TEXT,

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth_users(id),
  updated_by        UUID REFERENCES auth_users(id),
  deleted_at        TIMESTAMPTZ
);

-- FK setelah kedua tabel exist
ALTER TABLE petty_cash_expenses
  ADD CONSTRAINT fk_pc_expenses_settlement
  FOREIGN KEY (settlement_id) REFERENCES petty_cash_settlements(id);

CREATE INDEX idx_pc_expenses_request
  ON petty_cash_expenses(request_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pc_expenses_product
  ON petty_cash_expenses(product_id) WHERE product_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_pc_expenses_settlement
  ON petty_cash_expenses(settlement_id) WHERE settlement_id IS NOT NULL;
```

### 2.5. Diagram Relasi

```
petty_cash_requests (1 per lifecycle)
    │
    ├── petty_cash_expenses[] (N per request, realtime)
    │       ├── category_id → categories (affects_inventory flag)
    │       ├── product_id → products (kalau inventory)
    │       └── warehouse_id → warehouses (kalau inventory)
    │
    ├── petty_cash_settlements (max 1 per request)
    │       ├── journal_id → journal_headers
    │       ├── carried_to_id → petty_cash_requests (request baru)
    │       └── return_bank_account_id → bank_accounts
    │
    ├── disburse_journal_id → journal_headers
    ├── petty_cash_coa_id → chart_of_accounts
    ├── source_bank_account_id → bank_accounts (INTEGER)
    └── carried_from_id → petty_cash_requests (self-ref)
```

---

## 3. Backend Architecture

### 3.1. Module Structure

```
backend/src/modules/petty-cash/
├── petty-cash.controller.ts
├── petty-cash.service.ts
├── petty-cash.repository.ts
├── petty-cash.routes.ts
├── petty-cash.schema.ts
├── petty-cash.types.ts
├── petty-cash.errors.ts
└── petty-cash.openapi.ts
```

### 3.2. TypeScript Types

```typescript
// petty-cash.types.ts

export type PettyCashRequestStatus = 'PENDING' | 'DISBURSED' | 'CLOSED' | 'REJECTED'

export interface PettyCashRequest {
  id: string
  company_id: string
  branch_id: string
  request_number: string
  status: PettyCashRequestStatus
  amount_requested: number
  amount_disbursed: number | null
  carried_from_id: string | null
  carried_amount: number
  petty_cash_coa_id: string
  source_bank_account_id: number | null
  disburse_journal_id: string | null
  description: string | null
  notes: string | null
  // audit trail...
  submitted_by: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  closed_by: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface PettyCashRequestWithRelations extends PettyCashRequest {
  branch_name: string
  branch_code: string
  petty_cash_coa_code: string
  petty_cash_coa_name: string
  source_bank_name: string | null
  source_bank_account_number: string | null
  created_by_name: string | null
  approved_by_name: string | null
  // Computed
  total_expenses: number       // SUM(expenses.amount)
  remaining_balance: number    // (amount_disbursed + carried_amount) - total_expenses
  expense_count: number
}

export interface PettyCashExpense {
  id: string
  request_id: string
  company_id: string
  branch_id: string
  expense_date: string
  amount: number
  description: string | null
  category_id: string
  sub_category_id: string | null
  expense_coa_id: string | null
  product_id: string | null
  product_uom_id: string | null
  qty: number | null
  unit_price: number | null
  warehouse_id: string | null
  stock_movement_id: string | null
  settlement_id: string | null
  receipt_url: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface PettyCashExpenseWithRelations extends PettyCashExpense {
  category_name: string
  category_code: string
  sub_category_name: string | null
  product_code: string | null
  product_name: string | null
  warehouse_name: string | null
  uom_name: string | null
  created_by_name: string | null
  affects_inventory: boolean
}

export interface PettyCashSettlement {
  id: string
  request_id: string
  company_id: string
  branch_id: string
  settlement_date: string
  total_disbursed: number
  total_expenses: number
  remaining_balance: number
  amount_returned: number
  carried_to_id: string | null
  journal_id: string | null
  return_bank_account_id: number | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

// ─── DTOs ──────────────────────────────────────────────

export interface CreateRequestDto {
  branch_id: string
  amount_requested: number
  petty_cash_coa_id: string
  description?: string
}

export interface ApproveRequestDto {
  source_bank_account_id: number
  amount_disbursed: number
  notes?: string
}

export interface RejectRequestDto {
  rejection_reason: string
}

export interface CreateExpenseDto {
  expense_date?: string
  amount: number
  description?: string
  category_id: string
  sub_category_id?: string
  expense_coa_id?: string
  product_id?: string
  product_uom_id?: string
  qty?: number
  unit_price?: number
  warehouse_id?: string
  receipt_url?: string
}

export interface CreateSettlementDto {
  settlement_date?: string
  amount_returned: number
  return_bank_account_id?: number  // wajib kalau amount_returned > 0
  refill_amount?: number           // nominal request baru (kalau refill)
  notes?: string
}

export interface VoidSettlementDto {
  reason: string
}

// ─── List Filters ──────────────────────────────────────

export interface PettyCashRequestListFilter {
  branch_ids: string[]
  branch_id?: string
  status?: string
  date_from?: string
  date_to?: string
  search?: string
}
```

### 3.3. Service Layer — Key Business Logic

```typescript
// petty-cash.service.ts (pseudocode)

class PettyCashService {

  // ─── REQUEST LIFECYCLE ─────────────────────────────────

  async createRequest(dto: CreateRequestDto, branchIds: string[], userId: string) {
    // 1. Validate branch access
    // 2. Generate request_number (pg_advisory_xact_lock pattern)
    // 3. Insert with status = PENDING
  }

  async approveRequest(id: string, dto: ApproveRequestDto, branchIds: string[], userId: string) {
    // VALIDASI:
    // 1. Status harus PENDING
    // 2. Tidak boleh ada request lain DISBURSED di branch yang sama
    // 3. source_bank_account_id wajib
    //
    // DALAM TRANSACTION:
    // 1. Update status → DISBURSED
    // 2. Set amount_disbursed, approved_by, approved_at
    // 3. Create disburse journal:
    //    DR Petty Cash COA (petty_cash_coa_id) = amount_disbursed
    //    CR Bank COA (bank_accounts.coa_account_id) = amount_disbursed
    // 4. Post journal (submit → approve → post workflow)
    // 5. Store disburse_journal_id
    //
    // CATATAN: carried_amount TIDAK dibuatkan jurnal
    // (sudah tercatat di request sebelumnya)
  }

  async rejectRequest(id: string, dto: RejectRequestDto, branchIds: string[], userId: string) {
    // Validate status = PENDING
    // Update status → REJECTED + rejection_reason
  }

  // ─── EXPENSES (realtime saat DISBURSED) ────────────────

  async createExpense(requestId: string, dto: CreateExpenseDto, branchIds: string[], userId: string) {
    // VALIDASI:
    // 1. Request.status = DISBURSED
    // 2. Request.branch_id accessible by user
    // 3. Kalau category.affects_inventory = true:
    //    → product_id, warehouse_id, qty WAJIB diisi
    // 4. SUM(existing expenses) + dto.amount <= total_disbursed + carried_amount
    //    (saldo tidak boleh minus)
    //
    // INSERT expense
  }

  async updateExpense(expenseId: string, dto: Partial<CreateExpenseDto>, branchIds: string[], userId: string) {
    // Validate: request masih DISBURSED, belum ada settlement
  }

  async deleteExpense(expenseId: string, branchIds: string[], userId: string) {
    // Soft delete, validate: request masih DISBURSED, belum ada settlement
  }

  // ─── SETTLEMENT ────────────────────────────────────────

  async createSettlement(requestId: string, dto: CreateSettlementDto, branchIds: string[], userId: string) {
    // VALIDASI:
    // 1. Request.status = DISBURSED
    // 2. Hitung server-side:
    //    total_disbursed = amount_disbursed + carried_amount
    //    total_expenses = SUM(expenses.amount WHERE deleted_at IS NULL)
    //    remaining_balance = total_disbursed - total_expenses
    // 3. amount_returned + carried_to_amount = remaining_balance
    // 4. Kalau amount_returned > 0: return_bank_account_id WAJIB
    //
    // DALAM TRANSACTION:
    // 1. Create settlement record
    // 2. Update all expenses: SET settlement_id = settlement.id
    // 3. Create settlement journal (lihat Section 4)
    // 4. Post journal
    // 5. Create stock movements untuk inventory lines (lihat Section 5)
    // 6. Update request.status → CLOSED
    // 7. Kalau refill: buat request baru (DISBURSED langsung, no journal)
    //    dengan carried_amount = remaining_balance - amount_returned
    //    dan carried_from_id = current request.id
  }

  async voidSettlement(settlementId: string, dto: VoidSettlementDto, branchIds: string[], userId: string) {
    // GUARD: kalau carried_to request sudah punya expenses → BLOCK
    //
    // DALAM TRANSACTION:
    // 1. Reverse stock movements (OUT_REVERSAL)
    // 2. Reverse/delete settlement journal
    // 3. Delete carried_to request (kalau ada, dan belum ada expenses)
    // 4. Delete settlement record
    // 5. Clear expenses.settlement_id
    // 6. Revert request.status → DISBURSED
  }
}
```

---

## 4. Journal Creation

### 4.1. Disburse Journal (saat approve request)

```
source_module:    'petty_cash'
reference_type:   'petty_cash_disburse'
reference_id:     request.id
journal_type:     'GENERAL'
description:      'Pencairan Kas Kecil — {request_number}'

Lines:
  DR  Petty Cash COA (petty_cash_coa_id)           = amount_disbursed
  CR  Bank COA (bank_accounts.coa_account_id)      = amount_disbursed
```

COA credit side di-resolve dari `bank_accounts.coa_account_id WHERE id = source_bank_account_id`
(mengikuti pattern `findPurPayJournalCoa` di AP Payments).

### 4.2. Settlement Journal (saat post settlement)

```
source_module:    'petty_cash'
reference_type:   'petty_cash_settlement'
reference_id:     settlement.id
journal_type:     'GENERAL'
description:      'Settlement Kas Kecil — {request_number}'

Lines (DEBIT side):
  -- Satu line per unique expense_coa_id (resolved via Section 16.1 logic)
  DR  [Expense COA 1]   = SUM(amount) WHERE resolved_coa = X
  DR  [Expense COA 2]   = SUM(amount) WHERE resolved_coa = Y
  -- Kalau amount_returned > 0:
  DR  Bank COA (return)  = amount_returned

Lines (CREDIT side):
  CR  Petty Cash COA     = total_expenses + amount_returned

  ⚠️ CREDIT = total_expenses + amount_returned (BUKAN total_disbursed!)
  Sisa yang di-carry tetap "hidup" sebagai saldo Petty Cash COA di GL.
  Lihat Section 16.2 untuk penjelasan lengkap.
```

### 4.3. COA Resolution Logic

**Lihat Section 16.1 untuk implementasi lengkap.**

Summary:
1. `expense.expense_coa_id` (user override per line) — first priority
2. `category.affects_inventory = true` → resolve dari purpose `PUR-INV` DEBIT mapping per company
3. Expense biasa → resolve dari purpose `CSH-OUT` DEBIT mapping per company
4. Kalau mapping tidak ditemukan → throw error (tidak ada hardcoded fallback)

---

## 5. Stock Movement Integration

### 5.1. Timing: saat Post Settlement (bukan saat input expense)

Alasan:
- Expense belum final sampai settlement — bisa edit/delete tanpa reverse stock
- Satu kali batch processing lebih efisien
- Konsisten: jurnal juga di-create saat settlement

### 5.2. Pattern per expense line

```typescript
// Dalam settlement transaction, untuk setiap expense WHERE affects_inventory = true:

async createInventoryMovement(
  client: PoolClient,
  expense: PettyCashExpense,
  requestId: string,
  userId: string,
): Promise<string> {
  const costPerUnit = expense.unit_price ?? (expense.qty ? expense.amount / expense.qty : expense.amount)
  const qty = expense.qty ?? 1

  // Lock balance
  const balance = await stockRepository.getBalanceForUpdate(client, expense.warehouse_id!, expense.product_id!)
  const currentQty = balance ? Number(balance.qty) : 0
  const currentAvgCost = balance ? Number(balance.avg_cost) : 0

  // Weighted average cost
  const newQty = currentQty + qty
  const newAvgCost = currentQty > 0
    ? ((currentQty * currentAvgCost) + (qty * costPerUnit)) / newQty
    : costPerUnit

  // Create movement
  const movement = await stockRepository.createMovement(client, {
    warehouse_id: expense.warehouse_id!,
    product_id: expense.product_id!,
    movement_type: 'IN_PURCHASE',
    qty,
    cost_per_unit: costPerUnit,
    reference_type: 'petty_cash',  // Tambah ke ReferenceType union (TS only)
    reference_id: requestId,
    notes: `Petty cash: ${expense.description || 'pembelian tunai'}`,
    movement_date: expense.expense_date,
    created_by: userId,
  }, newQty)

  // Update balance
  await stockRepository.upsertBalance(client, expense.warehouse_id!, expense.product_id!, newQty, newAvgCost)

  return movement.id
}
```

### 5.3. Void Reversal

```typescript
// movement_type: OUT_REVERSAL (konsisten dengan monthly_stock_opname pattern)
// Reverse IN_PURCHASE → OUT_REVERSAL

async reverseStockMovements(settlementId: string, client: PoolClient): Promise<void> {
  // 1. Find all expenses with stock_movement_id WHERE settlement_id = this
  // 2. For each: create OUT_REVERSAL movement, update balance
  // 3. Clear expense.stock_movement_id
}
```

### 5.4. TypeScript Change (no DB migration)

```typescript
// backend/src/modules/stock/stock.types.ts — tambah ke union:
export type ReferenceType =
  | 'purchase_order' | 'transfer_order' | 'branch_loan'
  | 'daily_requisition' | 'production_order' | 'adjustment' | 'opening'
  | 'goods_processing' | 'daily_closing_count' | 'monthly_stock_opname'
  | 'petty_cash'  // ← NEW
```

---

## 6. forceDelete Integration

### 6.1. Handler di `journal-headers.service.ts`

Disisipkan setelah handler `purchase_invoice` (#7):

```typescript
// Handler: petty_cash disburse journal
} else if (
  journal.source_module === 'petty_cash' &&
  journal.reference_type === 'petty_cash_disburse' &&
  journal.reference_id
) {
  // Guard: kalau request sudah CLOSED (ada settlement) → BLOCK
  const request = await pettyCashRepository.findRequestById(journal.reference_id)
  if (request?.status === 'CLOSED') throw JournalErrors.CANNOT_DELETE_POSTED()

  await journalHeadersRepository.withTransaction(async (client) => {
    // 1. Revert request: DISBURSED → PENDING, clear disburse fields
    await pettyCashRepository.revertRequestToPending(journal.reference_id!, userId, client)
    // 2. Standard cleanup
    await journalHeadersRepository.clearReversalReferences(id, client)
    await journalHeadersRepository.clearJournalReferences(id, client)
    await journalHeadersRepository.delete(id, userId, client)
  })
  await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
    journal_number: journal.journal_number,
    petty_cash_request_id: journal.reference_id,
  })
  return

// Handler: petty_cash settlement journal
} else if (
  journal.source_module === 'petty_cash' &&
  journal.reference_type === 'petty_cash_settlement' &&
  journal.reference_id
) {
  // Guard: kalau carried_to request sudah punya expenses → BLOCK
  const settlement = await pettyCashRepository.findSettlementById(journal.reference_id)
  if (settlement?.carried_to_id) {
    const carriedExpenses = await pettyCashRepository.countExpensesByRequestId(settlement.carried_to_id)
    if (carriedExpenses > 0) throw JournalErrors.CANNOT_DELETE_POSTED()
  }

  await journalHeadersRepository.withTransaction(async (client) => {
    // 1. Reverse stock movements (OUT_REVERSAL)
    await pettyCashRepository.reverseStockMovements(journal.reference_id!, client)
    // 2. Delete carried_to request (kalau ada)
    if (settlement?.carried_to_id) {
      await pettyCashRepository.hardDeleteRequest(settlement.carried_to_id, client)
    }
    // 3. Clear settlement_id from expenses
    await pettyCashRepository.clearExpenseSettlementIds(settlement!.request_id, client)
    // 4. Delete settlement record
    await pettyCashRepository.deleteSettlement(journal.reference_id!, client)
    // 5. Revert request: CLOSED → DISBURSED
    await pettyCashRepository.revertRequestToDisbursed(settlement!.request_id, userId, client)
    // 6. Standard cleanup
    await journalHeadersRepository.clearReversalReferences(id, client)
    await journalHeadersRepository.clearJournalReferences(id, client)
    await journalHeadersRepository.delete(id, userId, client)
  })
  await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
    journal_number: journal.journal_number,
    petty_cash_settlement_id: journal.reference_id,
  })
  return
}
```

### 6.2. Update `_clearJournalRefsSequential`

Tambahkan 2 statement:

```sql
UPDATE petty_cash_requests SET disburse_journal_id = NULL, updated_at = NOW()
  WHERE disburse_journal_id = $1;
UPDATE petty_cash_settlements SET journal_id = NULL, updated_at = NOW()
  WHERE journal_id = $1;
```

---

## 7. API Routes

```
-- Requests
POST   /api/v1/petty-cash/requests              Create request (PENDING)
GET    /api/v1/petty-cash/requests              List (filters: branch, status, date, search)
GET    /api/v1/petty-cash/requests/:id          Detail + expenses[] + settlement
PUT    /api/v1/petty-cash/requests/:id          Update (PENDING only)
DELETE /api/v1/petty-cash/requests/:id          Soft delete (PENDING only)
POST   /api/v1/petty-cash/requests/:id/approve  PENDING → DISBURSED + journal
POST   /api/v1/petty-cash/requests/:id/reject   PENDING → REJECTED

-- Expenses
POST   /api/v1/petty-cash/requests/:id/expenses         Add expense
GET    /api/v1/petty-cash/requests/:id/expenses         List expenses
PUT    /api/v1/petty-cash/expenses/:expenseId           Update expense
DELETE /api/v1/petty-cash/expenses/:expenseId           Soft delete expense
POST   /api/v1/petty-cash/expenses/:expenseId/upload    Upload receipt

-- Settlement
POST   /api/v1/petty-cash/requests/:id/settlement       Create + post settlement
GET    /api/v1/petty-cash/requests/:id/settlement       Get settlement detail
POST   /api/v1/petty-cash/settlements/:id/void          Void settlement

-- Utility
GET    /api/v1/petty-cash/active-request                Active DISBURSED request (per branch)
GET    /api/v1/petty-cash/dashboard                     Summary per branch
```

---

## 8. Permission Model

```
Module: petty_cash

petty_cash.view           — Lihat daftar request & expenses
petty_cash.create         — Buat request & input expense
petty_cash.update         — Edit request (PENDING) & expense (DISBURSED)
petty_cash.delete         — Hapus request/expense
petty_cash.approve        — Approve/Reject request
petty_cash.settle         — Buat settlement (post jurnal + stock)
petty_cash.void           — Void settlement
```

---

## 9. Accounting Purposes (Seed)

```typescript
// Purposes baru
{ purpose_code: 'PC-DSB', purpose_name: 'Petty Cash Disburse',
  description: 'Pencairan dana kas kecil dari bank', applied_to: 'CASH' }
{ purpose_code: 'PC-STL', purpose_name: 'Petty Cash Settlement',
  description: 'Penutupan periode kas kecil', applied_to: 'CASH' }

// COA mappings default
PC-DSB:
  DEBIT  → 110101 (Petty Cash HO) / 110102 (Petty Cash Outlet)
  CREDIT → resolved from bank_accounts.coa_account_id

PC-STL:
  DEBIT  → varies per expense line (expense_coa_id)
  CREDIT → 110101 / 110102 (Petty Cash COA from request)
```

---

## 10. Frontend Architecture

### 10.1. Feature Structure

```
frontend/src/features/petty-cash/
├── api/
│   └── pettyCash.api.ts              TanStack Query hooks
├── components/
│   ├── PettyCashRequestCard.tsx      Card: request aktif, saldo, aksi
│   ├── PettyCashExpenseForm.tsx      Form tambah expense + inventory fields
│   ├── PettyCashExpenseTable.tsx     Tabel expenses dengan running total
│   ├── PettyCashSettlementForm.tsx   Form settlement: summary + options
│   ├── PettyCashStatusBadge.tsx      Badge status (PENDING/DISBURSED/etc)
│   └── InventoryFieldsSection.tsx   Conditional section (affects_inventory)
├── pages/
│   ├── PettyCashDashboardPage.tsx    Overview per branch
│   ├── PettyCashListPage.tsx         List semua request + filters
│   ├── PettyCashRequestDetailPage.tsx  Detail + expenses + actions
│   └── PettyCashSettlementDetailPage.tsx  Breakdown COA + journal link
├── hooks/
│   └── usePettyCashFilters.ts        URL filters (AP Payments pattern)
├── types/
│   ├── pettyCash.types.ts
│   └── pettyCashFilters.types.ts
├── utils/
│   ├── pettyCashFilters.url.ts
│   └── pettyCashFilters.toApiQuery.ts
└── constants/
    └── index.ts                      Status labels, colors, etc.
```

### 10.2. URL Filter Config

```typescript
// utils/pettyCashFilters.url.ts
import {
  parsePositiveInt, parseEnum, parseString,
  serializeString, serializeNumber, mergeWithPageReset,
  type UrlFilterBase, type UrlFilterUtils,
} from '@/lib/urlFilters'

type PcStatus = 'PENDING' | 'DISBURSED' | 'CLOSED' | 'REJECTED' | ''
const VALID_STATUSES = new Set<PcStatus>(['PENDING','DISBURSED','CLOSED','REJECTED',''])

export type PettyCashFilters = UrlFilterBase & {
  status: PcStatus
  branch_id: string
  date_from: string
  date_to: string
  search: string
}

export const PC_FILTER_DEFAULTS: PettyCashFilters = {
  page: 1, limit: 25,
  status: '', branch_id: '', date_from: '', date_to: '', search: '',
}

export const pettyCashFilterConfig: UrlFilterUtils<PettyCashFilters> = {
  defaults: PC_FILTER_DEFAULTS,

  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 25, 100),
    status: parseEnum(sp.get('status'), VALID_STATUSES, ''),
    branch_id: parseString(sp.get('branch_id')),
    date_from: parseString(sp.get('date_from')),
    date_to: parseString(sp.get('date_to')),
    search: parseString(sp.get('search')),
  }),

  stringify: (f) => {
    const sp = new URLSearchParams()
    const s = (k: string, v: string | null) => { if (v) sp.set(k, v) }
    s('page', serializeNumber(f.page, 1))
    s('limit', serializeNumber(f.limit, 25))
    s('status', serializeString(f.status))
    s('branch_id', serializeString(f.branch_id))
    s('date_from', serializeString(f.date_from))
    s('date_to', serializeString(f.date_to))
    s('search', serializeString(f.search))
    return sp
  },

  merge: (current, patch) =>
    mergeWithPageReset(current, patch, PC_FILTER_DEFAULTS,
      ['status','branch_id','date_from','date_to','search']),

  equals: (a, b) =>
    a.page === b.page && a.limit === b.limit && a.status === b.status
    && a.branch_id === b.branch_id && a.date_from === b.date_from
    && a.date_to === b.date_to && a.search === b.search,
}
```

### 10.3. Key UX Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard (per branch)                                         │
│                                                                 │
│  ┌─── Request Aktif: PC-JKT-20260727-001 ──────────────────┐   │
│  │  Status: DISBURSED                                       │   │
│  │  Dana Cair:  Rp 500.000                                 │   │
│  │  Carry:      Rp  50.000                                 │   │
│  │  Total:      Rp 550.000                                 │   │
│  │  Terpakai:   Rp 320.000  (8 expense)                    │   │
│  │  Sisa:       Rp 230.000                                 │   │
│  │                                                         │   │
│  │  [+ Tambah Expense]  [📋 Buat Settlement]               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Expenses Hari Ini:                                             │
│  ┌──────┬──────────────────┬──────────┬────────────┐           │
│  │ Jam  │ Keterangan       │ Kategori │ Jumlah     │           │
│  ├──────┼──────────────────┼──────────┼────────────┤           │
│  │ 07:30│ Beli sayur pasar │ Sayur 🥬 │ Rp 85.000  │           │
│  │ 09:15│ Parkir mobil     │ Transport│ Rp 10.000  │           │
│  │ 11:00│ Beli es batu     │ Bhn Baku │ Rp 25.000  │           │
│  └──────┴──────────────────┴──────────┴────────────┘           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Settlement Form                                                │
│                                                                 │
│  Ringkasan:                                                     │
│    Dana cair:           Rp 500.000                              │
│    Carried sebelumnya:  Rp  50.000                              │
│    Total tersedia:      Rp 550.000                              │
│    Total pengeluaran:   Rp 420.000  (12 expense)                │
│    ─────────────────────────────                                │
│    Sisa:                Rp 130.000                              │
│                                                                 │
│  Breakdown per COA:                                             │
│    610708 Misc Expense:     Rp 180.000                          │
│    110501 Raw Material:     Rp 200.000  (inventory)             │
│    610303 Electricity:      Rp  40.000                          │
│                                                                 │
│  Keputusan sisa:                                                │
│    ○ Tutup total — setor Rp 130.000 ke: [▼ Bank BCA xxxxx]     │
│    ● Refill — carry Rp 130.000 + tambah Rp [500.000] dari bank │
│                                                                 │
│  [Post Settlement]                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 10.4. Expense Form — Conditional Inventory Fields

```
┌──────────────────────────────────────────────────────┐
│  Tambah Pengeluaran                                  │
│                                                      │
│  Tanggal:      [2026-07-27]                          │
│  Kategori:     [▼ Sayur Segar ]  ← affects_inventory │
│  Sub-kategori: [▼ Sayur Daun  ]                      │
│  Jumlah:       [Rp 85.000    ]                       │
│  Keterangan:   [Beli kangkung, bayam di pasar]       │
│                                                      │
│  ┌── ⚠️ Kategori ini masuk gudang ─────────────────┐ │
│  │                                                  │ │
│  │  Produk:    [▼ Kangkung Segar        ] *         │ │
│  │  Gudang:    [▼ Gudang Utama Jakarta  ] *         │ │
│  │  Qty:       [5.0000    ] [▼ Kg ]     *          │ │
│  │  Hrg/unit:  [Rp 17.000 ] (opsional)             │ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  📷 Upload Struk: [Pilih file...]                    │
│                                                      │
│  [Simpan]  [Batal]                                   │
└──────────────────────────────────────────────────────┘
```

Pattern conditional rendering mengikuti `ProductForm.tsx`:
```tsx
{selectedCategory?.affects_inventory && (
  <div className="border-l-2 border-amber-300 pl-3 mt-3 space-y-3">
    <Alert variant="warning" size="sm">
      Kategori ini akan dicatat sebagai barang masuk gudang
    </Alert>
    <ProductSelector required ... />
    <WarehouseSelector required ... />
    <div className="grid grid-cols-2 gap-3">
      <QtyInput required ... />
      <UnitPriceInput optional ... />
    </div>
  </div>
)}
```

---

## 11. Migration Plan

### Urutan File

```
20260727_001_add_affects_inventory_to_categories.sql
20260727_002_create_petty_cash_module.sql
20260727_003_seed_petty_cash_accounting_purposes.sql
```

### Migration 001: affects_inventory

```sql
BEGIN;
ALTER TABLE categories ADD COLUMN affects_inventory BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN categories.affects_inventory IS
  'true = expense petty cash untuk kategori ini otomatis masuk gudang sebagai inventory-in';
COMMIT;
```

### Migration 002: petty_cash tables

```sql
BEGIN;

-- 1. petty_cash_requests
CREATE TABLE petty_cash_requests ( ... );  -- full DDL dari Section 2.2

-- 2. petty_cash_settlements (dibuat sebelum expenses karena FK)
CREATE TABLE petty_cash_settlements ( ... );  -- full DDL dari Section 2.3

-- 3. petty_cash_expenses
CREATE TABLE petty_cash_expenses ( ... );  -- full DDL dari Section 2.4
ALTER TABLE petty_cash_expenses
  ADD CONSTRAINT fk_pc_expenses_settlement
  FOREIGN KEY (settlement_id) REFERENCES petty_cash_settlements(id);

COMMIT;
```

### Migration 003: seed purposes

```sql
BEGIN;

-- Perlu run sebagai script/seed karena purpose pakai company_id
-- Atau insert manual per company. Format:
INSERT INTO accounting_purposes (company_id, purpose_code, purpose_name, description, applied_to, is_system, is_active, created_by, updated_by)
VALUES
  (:company_id, 'PC-DSB', 'Petty Cash Disburse', 'Pencairan dana kas kecil dari bank', 'CASH', true, true, :system_user, :system_user),
  (:company_id, 'PC-STL', 'Petty Cash Settlement', 'Penutupan periode kas kecil', 'CASH', true, true, :system_user, :system_user);

-- COA mappings (specific per company):
-- PC-DSB DEBIT  → Petty Cash account (110101 or 110102)
-- PC-DSB CREDIT → resolved runtime from bank_accounts.coa_account_id
-- PC-STL DEBIT  → resolved runtime per expense line
-- PC-STL CREDIT → Petty Cash account (110101 or 110102)

COMMIT;
```

---

## 12. Implementation Phases

### Phase 1 — MVP (target: 2 weeks)

| Step | Scope |
|------|-------|
| 1 | Migration schema (3 files) |
| 2 | Seed accounting purposes |
| 3 | Backend: types + errors + schema (Zod) |
| 4 | Backend: repository (CRUD + withTransaction) |
| 5 | Backend: service — request lifecycle (create/approve/reject) |
| 6 | Backend: service — expenses CRUD |
| 7 | Backend: service — settlement (journal + stock movements) |
| 8 | Backend: routes + controller |
| 9 | Backend: forceDelete handlers + clearJournalRefs update |
| 10 | Frontend: api hooks (TanStack Query) |
| 11 | Frontend: PettyCashListPage + filters |
| 12 | Frontend: PettyCashRequestDetailPage + expense table |
| 13 | Frontend: PettyCashExpenseForm (dengan inventory conditional) |
| 14 | Frontend: PettyCashSettlementForm |
| 15 | Frontend: Dashboard |

### Phase 2 — Enhancement

- Monthly report / Excel export
- Budget limit per category per bulan + alert
- Multi-level approval workflow
- Notification integration (saat request pending, saat saldo rendah)
- Receipt bulk upload (multiple files per expense)

### Phase 3 — Advanced

- Mobile-optimized expense input (PWA)
- Auto-categorize dari description (pattern matching)
- Recurring expense templates
- Bank statement reconciliation untuk pengembalian sisa

---

## 13. Technical Decisions Summary

| Decision | Rationale |
|----------|-----------|
| TEXT+CHECK bukan PG ENUM | Konsisten dgn AP Payments, mudah ALTER |
| Stock movement di settlement, bukan per-expense | Expense bisa edit/delete tanpa reverse stock |
| 1 journal per settlement (batch) | Lebih clean, 1 jurnal = 1 periode kas kecil |
| `reference_type: 'petty_cash'` (VARCHAR, no CHECK) | DB tidak punya CHECK, hanya TypeScript union |
| Carried balance tanpa jurnal baru | Dana sudah tercatat di jurnal request sebelumnya |
| `affects_inventory` di level category | Cukup granular untuk MVP, bisa extend ke sub_category nanti |
| Sequence number: advisory lock pattern | Ikuti AP Payments, prevent race condition |
| Loose UUID untuk stock_movement_id | Konsisten dgn codebase (no FK ke stock_movements) |
| Denormalize company_id + branch_id di expenses | Ikuti pattern AP payment invoice lines |
| Void blocked kalau carried request punya expenses | Prevent orphan data dan inconsistent state |

---

## 14. Error Classes

```typescript
// petty-cash.errors.ts

export class PettyCashRequestNotFoundError extends AppError { }
export class PettyCashInvalidStatusError extends AppError { }
export class PettyCashBranchHasActiveRequestError extends AppError { }
export class PettyCashBudgetExceededError extends AppError { }
export class PettyCashInventoryFieldsRequiredError extends AppError { }
export class PettyCashSettlementExistsError extends AppError { }
export class PettyCashSettlementBalanceMismatchError extends AppError { }
export class PettyCashVoidBlockedByCarriedExpensesError extends AppError { }
export class PettyCashExpenseNotFoundError extends AppError { }
export class PettyCashReturnBankRequiredError extends AppError { }
```


---

## 15. Integrasi Report: Unified Payment Report Page

### 15.1. Konteks

Halaman `/finance/ap-payments/report` menggunakan `UnifiedPaymentReportPage.tsx` yang sudah
menggabungkan 3 tipe pembayaran ke satu tabel unified:

| RowType | Sumber | Deskripsi |
|---------|--------|-----------|
| `PURCHASE` | AP Payments | Pembayaran hutang supplier (via PO/PI) |
| `GENERAL` | General Invoice Payments | Tagihan umum (listrik, sewa, dll) |
| `MARKETPLACE` | Marketplace Checkout Sessions | Pembelian marketplace |
| **`PETTY_CASH`** | **Petty Cash Expenses** | **Pengeluaran kas kecil (NEW)** |

Pattern page ini sudah extensible: setiap tipe punya converter function yang
menghasilkan `UnifiedRow`, lalu di-merge dan sort by date.

### 15.2. Perubahan di `UnifiedPaymentReportPage.tsx`

#### a. Extend RowType

```typescript
type RowType = 'PURCHASE' | 'GENERAL' | 'MARKETPLACE' | 'PETTY_CASH'
```

#### b. Tambah converter function

```typescript
interface PettyCashExpenseReportRow {
  id: string
  request_id: string
  request_number: string
  request_status: PettyCashRequestStatus
  branch_name: string
  expense_date: string
  amount: number
  description: string | null
  category_name: string
  category_code: string
  sub_category_name: string | null
  affects_inventory: boolean
  product_name: string | null
  petty_cash_coa_name: string
  request_total_disbursed: number   // amount_disbursed + carried_amount
  request_remaining: number         // total_disbursed - SUM(expenses)
  settlement_status: 'SETTLED' | null  // null = belum ada settlement
}

function fromPettyCashExpense(expense: PettyCashExpenseReportRow): UnifiedRow {
  return {
    _type: 'PETTY_CASH',
    _id: `petty-cash-${expense.id}`,
    invoice_number: expense.request_number,
    vendor_name: expense.category_name + (expense.sub_category_name
      ? ` / ${expense.sub_category_name}` : ''),
    branch_name: expense.branch_name,
    payment_number: expense.request_number,
    payment_method: 'CASH',
    rekening: expense.petty_cash_coa_name,
    payment_date: expense.expense_date,
    nominal_bayar: expense.amount,
    invoice_total: expense.request_total_disbursed,
    invoice_remaining: expense.request_remaining,
    invoice_due_date: null,
    invoice_status: expense.settlement_status ?? 'ACTIVE',
    payment_status: expense.request_status,
    source_bank_name: null,
    source_account_number: null,
    source_account_name: expense.petty_cash_coa_name,
    dest_bank_name: null,
    dest_account_number: null,
    dest_account_name: expense.description,
  }
}
```

#### c. Tambah query + enable flag

```typescript
const pettyCashQuery = useMemo(() => ({
  limit: -1,
  ...(filters.branchId ? { branch_id: filters.branchId } : {}),
  ...(filters.search   ? { search:    filters.search }   : {}),
  ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
  ...(filters.dateTo   ? { date_to:   filters.dateTo }   : {}),
}), [filters])

const enablePettyCash = hasApplied && (filters.rowType === '' || filters.rowType === 'PETTY_CASH')
const { data: pettyCashData, isLoading: pcLoading, isError: pcError } =
  usePettyCashExpenseReport(pettyCashQuery, { enabled: enablePettyCash })
```

#### d. Merge ke allRows

```typescript
const showPc = enablePettyCash && !hasSupplierFilter && !hasVendorFilter
const pcRows = showPc ? (pettyCashData?.data ?? []).map(fromPettyCashExpense) : []
return sortByDate([...apRows, ...genRows, ...mktRows, ...pcRows])
```

#### e. Update isLoading

```typescript
const isLoading =
  (enableAp && apLoading) ||
  (enableGeneral && generalLoading) ||
  (enableMarketplace && marketplaceLoading) ||
  (enablePettyCash && pcLoading)
```

#### f. Filter dropdown option

```tsx
<select value={draft.rowType} onChange={e => setDraft({...draft, rowType: e.target.value})}>
  <option value="">Semua Tipe</option>
  <option value="PURCHASE">Pembelian</option>
  <option value="GENERAL">Tagihan Umum</option>
  <option value="MARKETPLACE">Marketplace</option>
  <option value="PETTY_CASH">Kas Kecil</option>  {/* ← NEW */}
</select>
```

#### g. TypeBadge component

```tsx
function TypeBadge({ type }: { type: RowType }) {
  // existing badges...
  if (type === 'PETTY_CASH') return (
    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700
                     dark:bg-amber-900/30 dark:text-amber-300">
      Kas Kecil
    </span>
  )
}
```

#### h. Payment status labels

```typescript
function getPaymentStatusLabel(status: string | null, type: RowType): string {
  // existing logic...
  if (type === 'PETTY_CASH') {
    const labels: Record<string, string> = {
      PENDING: 'Pending',
      DISBURSED: 'Aktif',
      CLOSED: 'Selesai',
      REJECTED: 'Ditolak',
    }
    return labels[status ?? ''] ?? (status ?? '')
  }
}

function getInvoiceStatusLabel(status: string | null, type: RowType): string {
  // existing logic...
  if (type === 'PETTY_CASH') {
    return status === 'SETTLED' ? 'Settled' : 'Belum Settlement'
  }
}
```

### 15.3. Backend: Report Endpoint

```
GET /api/v1/petty-cash/report/expenses
Query: branch_id?, date_from?, date_to?, search?, limit?
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "request_id": "uuid",
      "request_number": "PC-JKT-20260727-001",
      "request_status": "DISBURSED",
      "branch_name": "Jakarta Pusat",
      "expense_date": "2026-07-27",
      "amount": 85000,
      "description": "Beli kangkung pasar",
      "category_name": "Sayur Segar",
      "category_code": "SAYUR",
      "sub_category_name": "Sayur Daun",
      "affects_inventory": true,
      "product_name": "Kangkung",
      "petty_cash_coa_name": "Kas Kecil Outlet",
      "request_total_disbursed": 550000,
      "request_remaining": 230000,
      "settlement_status": null
    }
  ],
  "pagination": { ... }
}
```

#### SQL Query (repository)

```sql
SELECT
  e.id, e.request_id, e.expense_date, e.amount, e.description,
  r.request_number, r.status AS request_status,
  b.branch_name,
  c.category_name, c.category_code, c.affects_inventory,
  sc.sub_category_name,
  p.product_name,
  coa.account_name AS petty_cash_coa_name,
  (r.amount_disbursed + r.carried_amount) AS request_total_disbursed,
  (r.amount_disbursed + r.carried_amount) - COALESCE(exp_sum.total, 0) AS request_remaining,
  CASE WHEN s.id IS NOT NULL THEN 'SETTLED' ELSE NULL END AS settlement_status
FROM petty_cash_expenses e
JOIN petty_cash_requests r ON r.id = e.request_id
JOIN branches b ON b.id = e.branch_id
JOIN categories c ON c.id = e.category_id
LEFT JOIN sub_categories sc ON sc.id = e.sub_category_id
LEFT JOIN products p ON p.id = e.product_id
JOIN chart_of_accounts coa ON coa.id = r.petty_cash_coa_id
LEFT JOIN petty_cash_settlements s ON s.request_id = r.id
LEFT JOIN LATERAL (
  SELECT SUM(ex.amount) AS total
  FROM petty_cash_expenses ex
  WHERE ex.request_id = r.id AND ex.deleted_at IS NULL
) exp_sum ON true
WHERE e.deleted_at IS NULL
  AND r.deleted_at IS NULL
  -- filters: branch_id, date range, search
ORDER BY e.expense_date DESC, e.created_at DESC
```

### 15.4. Excel Export

Kolom tambahan untuk petty cash rows di export:

| Header | Value |
|--------|-------|
| Tipe | "Kas Kecil" |
| No. Request | request_number |
| Kategori | category_name / sub_category_name |
| Tgl Pengeluaran | expense_date |
| Jumlah | amount |
| Keterangan | description |
| Saldo Tersisa | request_remaining |
| Status | request_status |
| Inventory? | "Ya" / "Tidak" |

Export sudah ada di `UnifiedPaymentReportPage` — cukup extend mapping-nya untuk handle
`_type === 'PETTY_CASH'` rows.

### 15.5. Implementation Note

Integrasi ini masuk di **Phase 1 Step 15** (setelah frontend dashboard selesai), karena:
1. Butuh backend report endpoint yang join expenses + requests
2. Butuh frontend API hook `usePettyCashExpenseReport`
3. Perubahan di `UnifiedPaymentReportPage.tsx` relatif kecil (additive, bukan refactor)


---

## 16. Klarifikasi & Gap Resolution

### 16.1. COA Resolution Multi-Company (Gap #1)

**Problem:** Section 4.3 menggunakan hardcoded `INVENTORY_COA_DEFAULT = 110501` dan
`MISC_EXPENSE_COA_DEFAULT = 610708`. Ini bermasalah di multi-company karena COA ID
berbeda per company.

**Resolusi:** COA default di-resolve **runtime dari `accounting_purpose_accounts`**, bukan hardcoded.

```typescript
// Revised resolveExpenseCoaId — di service layer
async function resolveExpenseCoaId(
  expense: PettyCashExpense,
  category: Category,
  companyId: string,
): Promise<string> {
  // 1. User override (explicit per line)
  if (expense.expense_coa_id) return expense.expense_coa_id

  // 2. Kalau inventory: resolve dari purpose PC-STL DEBIT mapping
  //    yang ber-field_mapping = 'inventory'
  //    ATAU fallback: cari purpose PUR-INV DEBIT (akun persediaan)
  if (category.affects_inventory) {
    const inventoryCoa = await accountingPurposeAccountsRepository
      .findDebitAccountByPurposeCode('PUR-INV', companyId)
    if (inventoryCoa) return inventoryCoa.account_id
    throw new PettyCashCoaMissingError('Inventory COA belum ter-mapping di purpose PUR-INV')
  }

  // 3. Expense biasa: resolve dari purpose PC-STL DEBIT mapping
  //    ATAU fallback: purpose CSH-OUT DEBIT (akun misc expense)
  const expenseCoa = await accountingPurposeAccountsRepository
    .findDebitAccountByPurposeCode('CSH-OUT', companyId)
  if (expenseCoa) return expenseCoa.account_id
  throw new PettyCashCoaMissingError('Expense COA belum ter-mapping di purpose CSH-OUT')
}
```

**Rule:**
- TIDAK ADA hardcoded account_code di service layer
- Semua COA di-resolve dari `accounting_purpose_accounts` per company
- Kalau mapping tidak ditemukan → throw error (jangan fallback ke magic number)
- `PUR-INV` DEBIT → akun Persediaan (110501 di company default, bisa beda di company lain)
- `CSH-OUT` DEBIT → akun Misc Expense (610708 di company default)
- User tetap bisa override per line via `expense_coa_id`

---

### 16.2. Refill Flow — Journal Rules (Gap #2)

**Problem:** Saat settlement dengan refill, request baru dibuat. Apa isi `amount_disbursed`?
Kapan jurnal disburse dibuat untuk request baru?

**Resolusi — 3 skenario:**

#### Skenario A: Pure Carry (refill_amount = 0 atau tidak diisi)

```
Settlement request lama:
  remaining_balance = 130.000
  amount_returned = 0
  → carried semua ke request baru

Request baru:
  amount_requested = 0
  amount_disbursed = 0         ← TIDAK ada dana baru dari bank
  carried_amount = 130.000     ← saldo lama dibawa
  status = DISBURSED           ← langsung aktif
  disburse_journal_id = NULL   ← TIDAK ada jurnal (dana sudah ada di kas)
  source_bank_account_id = NULL
```

**Tidak ada jurnal baru** — dana sudah tercatat di jurnal disburse request sebelumnya.
Settlement journal sudah menutup periode lama (CR Petty Cash = total_disbursed lama).
Tapi carried amount tetap "hidup" di kas kecil karena settlement journal hanya
meng-credit sebesar total_expenses + amount_returned (bukan total_disbursed).

Wait — ini salah. Mari koreksi accounting-nya:

**Revisi settlement journal untuk handle carry:**

```
Settlement journal HANYA untuk expense yang benar-benar terjadi:
  DR  Expense COA lines     = total_expenses
  DR  Bank COA (returned)   = amount_returned  (kalau ada)
  CR  Petty Cash COA        = total_expenses + amount_returned

  BUKAN CR = total_disbursed!
  Karena carried_amount tetap "hidup" sebagai saldo di Petty Cash COA.
```

Ini berarti setelah settlement, saldo Petty Cash di GL = `carried_amount yang dibawa`.
Cocok — tidak perlu jurnal baru untuk request baru.

#### Skenario B: Carry + Tambah Dana Baru (refill_amount > 0)

```
Settlement request lama:
  remaining_balance = 130.000
  amount_returned = 0
  → carried semua ke request baru

Request baru:
  amount_requested = refill_amount  (misal 500.000)
  amount_disbursed = 500.000        ← dana BARU dari bank
  carried_amount = 130.000          ← saldo lama
  status = DISBURSED
  source_bank_account_id = [user pilih]
  disburse_journal_id = [jurnal baru]

Jurnal disburse request baru:
  DR  Petty Cash COA  = 500.000  (hanya amount_disbursed, bukan carried)
  CR  Bank COA        = 500.000
```

**Ada jurnal** — sebesar `amount_disbursed` saja (dana baru keluar dari bank).
Carried amount tidak dibuatkan jurnal.

#### Skenario C: Partial Return + Partial Carry (amount_returned > 0 DAN ada carry)

```
Settlement request lama:
  remaining_balance = 130.000
  amount_returned = 50.000    ← setor balik ke bank
  carried_to_amount = 80.000  ← bawa ke request baru

  Validasi: 50.000 + 80.000 = 130.000 ✓

Settlement journal:
  DR  Expense COA lines     = 420.000  (total_expenses)
  DR  Bank COA (returned)   = 50.000   (amount_returned → balik ke bank)
  CR  Petty Cash COA        = 470.000  (total_expenses + amount_returned)

  Setelah ini: saldo Petty Cash di GL = 80.000 (carried)

Request baru:
  amount_disbursed = refill_amount (bisa 0 kalau pure carry, atau > 0 kalau tambah)
  carried_amount = 80.000
```

#### Summary Rules:

| Kondisi | amount_disbursed request baru | Jurnal disburse? | Journal amount |
|---------|-------------------------------|------------------|----------------|
| Pure carry (refill_amount = 0) | 0 | ❌ Tidak | — |
| Carry + tambah (refill_amount > 0) | refill_amount | ✅ Ya | refill_amount |
| Tanpa carry (close total, lalu buat request baru manual) | amount_requested | ✅ Ya (saat approve) | amount_disbursed |

#### Revisi Section 4.2 — Settlement Journal Formula:

```
Settlement Journal:
  DEBIT:
    DR  [Expense COA lines]   = total_expenses (grouped by COA)
    DR  Bank COA (return)     = amount_returned (kalau > 0)
  CREDIT:
    CR  Petty Cash COA        = total_expenses + amount_returned

  BUKAN total_disbursed! Karena sisa yang di-carry tetap "hidup" di Petty Cash COA.
```

**Ini adalah perubahan penting dari Section 4.2 yang original.**

---

### 16.3. Report Hook — `usePettyCashExpenseReport` (Gap #3)

Hook ini belum ada di Section 10 api file. Ditambahkan:

```typescript
// frontend/src/features/petty-cash/api/pettyCash.api.ts

// ─── Report Hook (untuk Unified Payment Report) ──────────────────

interface PettyCashExpenseReportRow {
  id: string
  request_id: string
  request_number: string
  request_status: PettyCashRequestStatus
  branch_name: string
  expense_date: string
  amount: number
  description: string | null
  category_name: string
  category_code: string
  sub_category_name: string | null
  affects_inventory: boolean
  product_name: string | null
  petty_cash_coa_name: string
  request_total_disbursed: number
  request_remaining: number
  settlement_status: 'SETTLED' | null
}

export const usePettyCashExpenseReport = (
  params: {
    branch_id?: string
    date_from?: string
    date_to?: string
    search?: string
    limit?: number
  },
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ['petty-cash', 'report', 'expenses', params],
    queryFn: async () => {
      const { data } = await api.get('/petty-cash/report/expenses', { params })
      return data as { data: PettyCashExpenseReportRow[]; pagination: Pagination }
    },
    enabled: options?.enabled ?? true,
  })
}
```

---

### 16.4. Report `request_remaining` — Saldo Aktual vs Running (Gap #4)

**Problem:** Setiap expense row menampilkan `request_remaining` yang sama (saldo saat query time),
bukan saldo setelah expense tersebut spesifik. Ini bisa confusing kalau user melihat banyak
rows dari request yang sama.

**Resolusi:** Ini **intended behavior** — menampilkan **saldo aktual request saat ini**, bukan
running balance historis. Alasan:

1. Report ini untuk monitoring posisi keuangan, bukan untuk audit trail per-transaksi
2. Running balance per-expense membutuhkan window function yang complex dan mahal
3. Konsisten dengan cara `invoice_remaining` ditampilkan di PURCHASE rows (sisa outstanding
   saat ini, bukan sisa setelah payment tersebut)

**Mitigation di UI:** Label kolom di tabel BUKAN "Sisa setelah pengeluaran" melainkan
"Saldo Request" — ini memperjelas bahwa ini posisi saat ini:

```
| Tgl       | Kategori     | Jumlah   | Saldo Request |
|-----------|-------------|----------|---------------|
| 27 Jul    | Sayur       | 85.000   | 230.000       |  ← semua row sama
| 27 Jul    | Parkir      | 10.000   | 230.000       |  ← karena ini posisi NOW
| 27 Jul    | Es Batu     | 25.000   | 230.000       |
```

Kalau di kemudian hari butuh running balance, bisa ditambah kolom `balance_after` di
`petty_cash_expenses` yang diisi server-side saat create expense (mirip
`stock_movements.balance_after`). Tapi ini Phase 2.


---

## 17. Receipt Upload Implementation

### 17.1. Existing Pattern (dari AP Payments)

Project sudah punya infrastructure upload yang lengkap:

- **Storage:** Cloudflare R2 (S3-compatible) via `backend/src/services/storage.service.ts`
- **Middleware:** `documentUploadSingle(fieldName)` dari `backend/src/middleware/upload-document.middleware.ts`
- **Limits:** max 10MB, format: JPG, PNG, WEBP, PDF, HEIC
- **Extension resolver:** `resolveDocumentUploadExtension()` dari `backend/src/utils/document-upload.util.ts`

Flow AP Payment proof upload sebagai referensi:
```
Route:      POST /ap-payments/:id/proof
Middleware: documentUploadSingle('proof')
Controller: validate file → storageService.uploadApPaymentProof() → service.uploadProof()
Storage:    R2 bucket 'buktisetoran', path: {companyId}/ap-payments/{year}/{month}/{fileName}
DB:         ap_payments.proof_url = R2 path (bukan full URL)
Display:    storageService.createSignedUrl(path, expiry, bucket) → pre-signed URL
```

### 17.2. Petty Cash Receipt Upload — Phase 1 (ikuti pattern existing)

#### Backend Route

```typescript
// petty-cash.routes.ts
router.post(
  '/expenses/:expenseId/upload-receipt',
  authenticate,
  canUpdate(MODULE),
  requireWriteAccess,
  documentUploadSingle('receipt'),
  (req, res) => pettyCashController.uploadReceipt(req, res),
)
```

#### Controller

```typescript
// petty-cash.controller.ts
async uploadReceipt(req: Request, res: Response): Promise<void> {
  const { userId, branchIds } = await pcScope(req)
  const expenseId = req.params.expenseId
  const file = req.file

  if (!file) {
    res.status(400).json({ success: false, message: 'File tidak diterima.' })
    return
  }

  const ext = resolveDocumentUploadExtension(file)
  if (!ext) {
    res.status(400).json({
      success: false,
      message: `Tipe file tidak didukung. Gunakan: ${DOCUMENT_UPLOAD_EXTENSIONS.join(', ')}`,
    })
    return
  }

  const expense = await pettyCashService.getExpenseById(expenseId, branchIds)
  const companyId = expense.company_id

  const fileName = `${expenseId}-${Date.now()}.${ext}`
  const storagePath = `${companyId}/petty-cash-receipts/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileName}`

  await storageService.uploadToPath(file.buffer, storagePath, file.mimetype, PETTY_CASH_BUCKET)

  const updated = await pettyCashService.updateReceiptUrl(expenseId, storagePath, userId)
  sendSuccess(res, updated)
}
```

#### Storage Config

```typescript
// Bucket: 'buktisetoran' (reuse existing bucket — subfolder berbeda)
// ATAU buat bucket baru: 'pettycashreceipts' (tergantung policy R2)
//
// Rekomendasi: reuse 'buktisetoran' karena sudah ada dan policy-nya sama
const PETTY_CASH_BUCKET = 'buktisetoran'

// Path convention:
// {companyId}/petty-cash-receipts/{year}/{month}/{expenseId}-{timestamp}.{ext}
```

#### DB Update

```typescript
// petty-cash.repository.ts
async updateReceiptUrl(expenseId: string, receiptUrl: string, userId: string, client?: PoolClient): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE petty_cash_expenses
     SET receipt_url = $1, updated_by = $2, updated_at = NOW()
     WHERE id = $3 AND deleted_at IS NULL`,
    [receiptUrl, userId, expenseId]
  )
}
```

#### Serve (signed URL untuk display)

```typescript
// Di service saat get expense detail:
async getExpenseWithReceiptUrl(expense: PettyCashExpense): Promise<PettyCashExpenseWithRelations> {
  return {
    ...expense,
    receipt_signed_url: expense.receipt_url
      ? await storageService.createSignedUrl(expense.receipt_url, 3600, PETTY_CASH_BUCKET)
      : null,
  }
}
```

### 17.3. Frontend — Upload Component

```typescript
// frontend/src/features/petty-cash/api/pettyCash.api.ts

export const useUploadPettyCashReceipt = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ expenseId, file }: { expenseId: string; file: File }) => {
      const formData = new FormData()
      formData.append('receipt', file)
      const { data } = await api.post(
        `/petty-cash/expenses/${expenseId}/upload-receipt`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return data.data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['petty-cash', 'expenses'] })
      qc.invalidateQueries({ queryKey: ['petty-cash', 'requests'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Gagal mengupload struk')),
  })
}
```

#### UI Pattern (di PettyCashExpenseForm atau detail row)

```tsx
// Ikuti pattern ApPaymentProofModal — bisa inline atau modal
// Untuk MVP: inline file input di form expense

<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Struk / Kwitansi
  </label>
  {expense.receipt_signed_url ? (
    <div className="flex items-center gap-2">
      <a href={expense.receipt_signed_url} target="_blank"
         className="text-sm text-blue-600 hover:underline">
        Lihat Struk
      </a>
      <button onClick={() => fileInputRef.current?.click()}
              className="text-xs text-gray-500 hover:text-gray-700">
        Ganti
      </button>
    </div>
  ) : (
    <input
      type="file"
      ref={fileInputRef}
      accept="image/*,.pdf,.heic"
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) uploadReceipt.mutate({ expenseId: expense.id, file })
      }}
      className="text-sm"
    />
  )}
</div>
```

### 17.4. Summary

| Aspek | Implementasi |
|-------|-------------|
| Storage backend | Cloudflare R2 (existing) |
| Bucket | `buktisetoran` (reuse, subfolder `/petty-cash-receipts/`) |
| Middleware | `documentUploadSingle('receipt')` (existing) |
| Max size | 10MB (existing limit) |
| Formats | JPG, PNG, WEBP, PDF, HEIC (existing filter) |
| Path | `{companyId}/petty-cash-receipts/{year}/{month}/{id}-{ts}.{ext}` |
| DB field | `petty_cash_expenses.receipt_url` (R2 path, bukan full URL) |
| Display | Pre-signed URL via `storageService.createSignedUrl()` |
| Frontend hook | `useUploadPettyCashReceipt()` — FormData POST |
| Phase | **Phase 1** (bukan Phase 2 — sudah ada infra, tinggal pakai) |

**Catatan:** Karena infrastructure R2 + middleware + signed URL sudah lengkap,
receipt upload masuk Phase 1 (bukan Phase 2 seperti yang awalnya disebut).
Effort-nya minimal — hanya wiring, tidak perlu setup baru.
