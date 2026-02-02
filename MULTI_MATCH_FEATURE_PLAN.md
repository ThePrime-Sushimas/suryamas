# Rencana Implementasi: Custom Multi-Match Feature

## 1. Latar Belakang Masalah

### Scenario Saat Ini
- **Masalah**: Satu transaksi POS dengan payment method "Debit BCA" dipecah oleh mesin EDC menjadi multiple bank statements dengan payment types berbeda
- **Contoh Kasus**:
  - POS Aggregate (11 Jan): Debit BCA → Rp 5,069,986
  - Bank Statement (12 Jan):
    1. KR OTOMATIS MID: 885002200709 → Rp 4,754,200
    2. KARTU KREDIT MID: 002200709 → Rp 282,794
  - **Total Bank**: 5,036,994
  - **Selisih**: Rp 32,992 (biaya administrasi)

### Kebutuhan
Fitur untuk mencocokan **1 POS Aggregate** dengan **multiple Bank Statements** sekaligus.

---

## 2. Solusi yang Dipilih: Custom Multi-Match Feature

### Konsep
- Membuat relasi **many-to-many** antara `bank_statements` dan `aggregated_transactions`
- 1 Aggregate dapat dicocokan dengan N statements
- 1 Statement tetap hanya untuk 1 Aggregate (单向)

---

## 3. Database Schema Changes

### 3.1 Tabel Baru: `bank_reconciliation_groups`

```sql
-- Tabel untuk menyimpan group reconciliation (1 POS = N Bank Statements)
CREATE TABLE bank_reconciliation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  aggregate_id UUID NOT NULL REFERENCES aggregated_transactions(id),
  total_bank_amount DECIMAL(18,2) NOT NULL,
  aggregate_amount DECIMAL(18,2) NOT NULL,
  difference DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, RECONCILED, DISCREPANCY
  notes TEXT,
  reconciled_by VARCHAR(100),
  reconciled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index untuk performa query
CREATE INDEX idx_recon_groups_company ON bank_reconciliation_groups(company_id);
CREATE INDEX idx_recon_groups_aggregate ON bank_reconciliation_groups(aggregate_id);
CREATE INDEX idx_recon_groups_status ON bank_reconciliation_groups(status);
```

### 3.2 Tabel Baru: `bank_reconciliation_group_details`

```sql
-- Detail dari group - menyimpan relasi antara statement dan group
CREATE TABLE bank_reconciliation_group_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES bank_reconciliation_groups(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES bank_statements(id),
  amount DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, statement_id)
);

-- Index
CREATE INDEX idx_recon_group_details_group ON bank_reconciliation_group_details(group_id);
CREATE INDEX idx_recon_group_details_statement ON bank_reconciliation_group_details(statement_id);
```

### 3.3 Update Tabel `bank_statements`

```sql
-- Menambahkan foreign key ke reconciliation group
ALTER TABLE bank_statements
ADD COLUMN IF NOT EXISTS reconciliation_group_id UUID REFERENCES bank_reconciliation_groups(id);
```

---

## 4. Backend Changes

### 4.1 Schema Baru (`bank-reconciliation.types.ts`)

```typescript
export enum ReconciliationGroupStatus {
  PENDING = 'PENDING',
  RECONCILED = 'RECONCILED',
  DISCREPANCY = 'DISCREPANCY'
}

export interface ReconciliationGroup {
  id: string;
  company_id: string;
  aggregate_id: string;
  total_bank_amount: number;
  aggregate_amount: number;
  difference: number;
  status: ReconciliationGroupStatus;
  notes?: string;
  reconciled_by?: string;
  reconciled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationGroupDetail {
  id: string;
  group_id: string;
  statement_id: string;
  amount: number;
  created_at: string;
}

export interface MultiMatchRequest {
  companyId: string;
  aggregateId: string;
  statementIds: string[];
  notes?: string;
  overrideDifference?: boolean;
}

export interface MultiMatchResult {
  success: boolean;
  groupId: string;
  aggregateId: string;
  statementIds: string[];
  totalBankAmount: number;
  aggregateAmount: number;
  difference: number;
}
```

### 4.2 Repository Methods (`bank-reconciliation.repository.ts`)

#### Method Baru:

```typescript
/**
 * Create a reconciliation group with multiple statements
 */
async createReconciliationGroup(data: {
  companyId: string;
  aggregateId: string;
  statementIds: string[];
}): Promise<string> // returns groupId

/**
 * Get reconciliation group by ID with all statements
 */
async getReconciliationGroupById(groupId: string): Promise<any>

/**
 * Get all statements in a reconciliation group
 */
async getStatementsByGroupId(groupId: string): Promise<any[]>

/**
 * Mark statements as reconciled with a group
 */
async markStatementsAsReconciledWithGroup(
  statementIds: string[],
  groupId: string
): Promise<void>

/**
 * Undo reconciliation group
 */
async undoReconciliationGroup(groupId: string): Promise<void>

/**
 * Check if aggregate is already part of a group
 */
async isAggregateInGroup(aggregateId: string): Promise<boolean>

/**
 * Get statements that can be grouped (same date, similar amount sum)
 */
async getPotentialGroupedStatements(
  companyId: string,
  targetAmount: number,
  tolerance: number,
  excludeStatementIds?: string[]
): Promise<any[]>
```

### 4.3 Service Methods (`bank-reconciliation.service.ts`)

#### Method Baru:

```typescript
/**
 * Create multi-match: 1 POS Aggregate with N Bank Statements
 */
async createMultiMatch(
  companyId: string,
  aggregateId: string,
  statementIds: string[],
  userId?: string,
  notes?: string,
  overrideDifference?: boolean
): Promise<MultiMatchResult> {
  // 1. Validate aggregate exists and is unreconciled
  // 2. Validate all statements exist and are unreconciled
  // 3. Calculate totals
  // 4. Check if difference is within tolerance OR override is true
  // 5. Create reconciliation group
  // 6. Create group details
  // 7. Mark all statements as reconciled
  // 8. Update aggregate reconciliation status
  // 9. Log audit trail
  // 10. Return result
}

/**
 * Undo multi-match
 */
async undoMultiMatch(
  groupId: string,
  userId?: string
): Promise<void> {
  // 1. Get group details
  // 2. Reset all statements to unreconciled
  // 3. Reset aggregate to unreconciled
  // 4. Soft delete group (or mark as undone)
  // 5. Log audit trail
}

/**
 * Get suggested statements for grouping
 */
async getSuggestedGroupStatements(
  companyId: string,
  aggregateId: string,
  tolerance?: number
): Promise<any[]> {
  // 1. Get aggregate amount
  // 2. Find unreconciled statements with same/similar date
  // 3. Algorithm to find combination that matches target amount
  // 4. Return suggested combinations
}

/**
 * Get all reconciliation groups for a company
 */
async getReconciliationGroups(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]>
```

### 4.4 Controller Endpoints (`bank-reconciliation.controller.ts` & `routes`)

```typescript
/**
 * POST /api/v1/reconciliation/bank/multi-match
 * Create multi-match (1 POS = N Bank Statements)
 */
router.post(
  "/multi-match",
  canInsert("bank_reconciliation"),
  validateSchema(multiMatchSchema),
  (req, res) => controller.createMultiMatch(req as any, res)
);

/**
 * DELETE /api/v1/reconciliation/bank/multi-match/:groupId
 * Undo multi-match
 */
router.delete(
  "/multi-match/:groupId",
  canUpdate("bank_reconciliation"),
  (req, res) => controller.undoMultiMatch(req as any, res)
);

/**
 * GET /api/v1/reconciliation/bank/multi-match/suggestions
 * Get suggested statements for grouping
 */
router.get(
  "/multi-match/suggestions",
  canView("bank_reconciliation"),
  (req, res) => controller.getSuggestedGroupStatements(req as any, res)
);

/**
 * GET /api/v1/reconciliation/bank/multi-match/groups
 * Get all multi-match groups
 */
router.get(
  "/multi-match/groups",
  canView("bank_reconciliation"),
  (req, res) => controller.getReconciliationGroups(req as any, res)
);

/**
 * GET /api/v1/reconciliation/bank/multi-match/:groupId
 * Get details of a multi-match group
 */
router.get(
  "/multi-match/:groupId",
  canView("bank_reconciliation"),
  (req, res) => controller.getMultiMatchGroup(req as any, res)
);
```

### 4.5 Schema Validation (`bank-reconciliation.schema.ts`)

```typescript
export const multiMatchSchema = z.object({
  body: z.object({
    companyId: z.string().uuid("Invalid company ID"),
    aggregateId: z.coerce.string().min(1, "Aggregate ID is required"),
    statementIds: z.array(
      z.string().uuid("Statement ID must be a valid UUID"),
      { message: "Statement IDs must be valid UUIDs" }
    ).min(1, "At least one statement ID is required"),
    notes: z.string().max(500).optional(),
    overrideDifference: z.boolean().optional().default(false),
  }),
});

export const multiMatchGroupQuerySchema = z.object({
  query: z.object({
    companyId: z.string().uuid("Invalid company ID"),
    startDate: z.string().date("Invalid start date format"),
    endDate: z.string().date("Invalid end date format"),
  }),
});

export type MultiMatchInput = z.infer<typeof multiMatchSchema>;
export type MultiMatchGroupQueryInput = z.infer<typeof multiMatchGroupQuerySchema>;
```

---

## 5. Frontend Changes

### 5.1 Tipe Baru (`types/bank-reconciliation.types.ts`)

```typescript
export interface ReconciliationGroup {
  id: string;
  aggregate_id: string;
  total_bank_amount: number;
  aggregate_amount: number;
  difference: number;
  status: 'PENDING' | 'RECONCILED' | 'DISCREPANCY';
  notes?: string;
  reconciled_by?: string;
  reconciled_at?: string;
  created_at: string;
  statements?: BankStatementWithMatch[];
  aggregate?: AggregatedTransactionListItem;
}

export interface MultiMatchSuggestion {
  statements: BankStatementWithMatch[];
  totalAmount: number;
  matchPercentage: number;
}
```

### 5.2 API Service (`api/bankReconciliation.api.ts`)

```typescript
// Multi-match API calls
async createMultiMatch(data: {
  aggregateId: string;
  statementIds: string[];
  notes?: string;
  overrideDifference?: boolean;
}): Promise<ApiResponse<MultiMatchResult>>

async undoMultiMatch(groupId: string): Promise<ApiResponse<void>>

async getSuggestedGroupStatements(aggregateId: string): Promise<ApiResponse<MultiMatchSuggestion[]>>

async getReconciliationGroups(params: {
  startDate: string;
  endDate: string;
}): Promise<ApiResponse<ReconciliationGroup[]>>

async getMultiMatchGroup(groupId: string): Promise<ApiResponse<ReconciliationGroup>>
```

### 5.3 Komponen Baru: `MultiMatchModal.tsx`

```typescript
interface MultiMatchModalProps {
  aggregate: AggregatedTransactionListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    statementIds: string[],
    overrideDifference: boolean,
  ) => Promise<void>;
  isLoading?: boolean;
}
```

**Fitur Modal:**
- Tampilkan aggregate yang dipilih
- Tampilkan daftar bank statements yang bisa dipilih (multi-select)
- Hitung total nominal yang dipilih vs aggregate amount
- Tampilkan analisis selisih
- Checkbox "Override difference" jika selisih melebihi tolerance
- Tombol "Confirm Multi-Match"

### 5.4 Update: `BankMutationTable.tsx`

```typescript
// Tambahkan checkbox untuk multi-select statements
// Tampilkan indicator jika statement sudah menjadi bagian dari group

// Kolom baru:
// - Checkbox untuk select
// - Group indicator (icon/link ke group details)
```

### 5.5 Update: `useBankReconciliation.ts` Hook

```typescript
interface UseBankReconciliationReturn {
  // ... existing state
  selectedStatementIds: string[];
  setSelectedStatementIds: (ids: string[]) => void;
  selectedAggregate: AggregatedTransactionListItem | null;
  setSelectedAggregate: (agg: AggregatedTransactionListItem | null) => void;
  // ... existing methods
  createMultiMatch: (aggregateId: string, statementIds: string[], overrideDifference?: boolean) => Promise<void>;
  undoMultiMatch: (groupId: string) => Promise<void>;
  getSuggestedStatements: (aggregateId: string) => Promise<void>;
}
```

### 5.6 Komponen Baru: `MultiMatchGroupList.tsx`

```typescript
// Menampilkan daftar reconciliation groups
// Fitur:
// - List semua multi-match groups
// - Detail view (expand untuk lihat statements)
// - Tombol undo
// - Filter by status/date
```

---

## 6. Algoritma Suggestion (Otomatis)

### Problem
Given: target amount (aggregate), list of unreconciled statements
Find: Subset of statements yang totalnya mendekati target

### Solution: Knapsack-style Algorithm

```typescript
function findBestStatementCombination(
  statements: BankStatement[],
  targetAmount: number,
  tolerance: number = 0.01 // 1%
): BankStatement[][] {
  const results: BankStatement[][] = [];
  
  // Simple approach: Find combinations within tolerance
  const amounts = statements.map(s => Math.abs(s.amount));
  
  // Dynamic programming untuk find combinations
  // Return array of valid combinations sorted by closeness to target
  
  return results;
}

// Usage dalam service
async getSuggestedGroupStatements(...) {
  const unreconciledStatements = await getUnreconciledByDateRange(...);
  const aggregate = await getAggregateById(aggregateId);
  
  const combinations = findBestStatementCombination(
    unreconciledStatements,
    aggregate.nett_amount,
    tolerance
  );
  
  return combinations.map(combo => ({
    statements: combo,
    totalAmount: combo.reduce((sum, s) => sum + s.amount, 0),
    matchPercentage: 1 - Math.abs(totalAmount - aggregate.nett_amount) / aggregate.nett_amount
  }));
}
```

---

## 7. Migrasi Data

### 7.1 Migration Script

```sql
-- Run ini untuk production database
BEGIN TRANSACTION;

-- 1. Create tables
CREATE TABLE IF NOT EXISTS bank_reconciliation_groups (...);
CREATE TABLE IF NOT EXISTS bank_reconciliation_group_details (...);

-- 2. Add column
ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS reconciliation_group_id UUID;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS ...

COMMIT;
```

### 7.2 Seed Data (Optional)

```sql
-- Insert sample reconciliation groups untuk testing
```

---

## 8. Testing Plan

### 8.1 Unit Tests

```typescript
describe('MultiMatchService', () => {
  it('should create multi-match with valid data', async () => {
    // Arrange
    // Act
    // Assert
  });

  it('should reject if statements already reconciled', async () => {
    // Arrange
    // Act & Assert
  });

  it('should calculate correct difference', async () => {
    // Arrange
    // Act
    // Assert
  });

  it('should undo multi-match correctly', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### 8.2 Integration Tests

```typescript
describe('MultiMatch API', () => {
  it('POST /multi-match should create group', async () => {
    // Test dengan supertest
  });

  it('DELETE /multi-match/:id should undo', async () => {
    // Test dengan supertest
  });
});
```

---

## 9. Estimated Effort

| Task | Estimated Time |
|------|---------------|
| Database Migration | 2 hours |
| Backend - Repository | 4 hours |
| Backend - Service | 6 hours |
| Backend - Controller & Routes | 2 hours |
| Frontend - API | 2 hours |
| Frontend - Components | 8 hours |
| Testing | 4 hours |
| **Total** | **~28 hours** |

---

## 10. Alternatif Solusi (Jika Multi-Match Tidak Dimungkinkan)

### 10.1 Split Payment Support
- Ubah import POS untuk support multiple payment methods per transaction
- Setiap payment method menjadi separate aggregate

### 10.2 Manual Adjustment Feature
- Izinkan user untuk mencatat "unmatched amount" sebagai biaya administrasi
- Tetap match 1:1 tapi dengan notes tentang selisih

---

## 11. Kesimpulan

Multi-match feature adalah solusi yang paling sesuai untuk masalah Anda karena:
1. Tidak mengubah flow import POS yang sudah ada
2. Memberikan fleksibilitas untuk kasus edge seperti ini
3. Audit trail yang jelas
4. Compatible dengan sistem yang sudah ada

---

## 12. File yang Diedit/Ditambahkan

### Backend
- `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.types.ts` (UPDATE)
- `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.repository.ts` (UPDATE)
- `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.service.ts` (UPDATE)
- `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.controller.ts` (UPDATE)
- `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.routes.ts` (UPDATE)
- `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.schema.ts` (UPDATE)
- `backend/migrations/XXXXXXX_add_multi_match_tables.sql` (NEW)

### Frontend
- `frontend/src/features/bank-reconciliation/types/bank-reconciliation.types.ts` (UPDATE)
- `frontend/src/features/bank-reconciliation/api/bankReconciliation.api.ts` (UPDATE)
- `frontend/src/features/bank-reconciliation/components/reconciliation/MultiMatchModal.tsx` (NEW)
- `frontend/src/features/bank-reconciliation/components/reconciliation/MultiMatchGroupList.tsx` (NEW)
- `frontend/src/features/bank-reconciliation/components/reconciliation/BankMutationTable.tsx` (UPDATE)
- `frontend/src/features/bank-reconciliation/hooks/useBankReconciliation.ts` (UPDATE)

---

## 13. Status Implementasi

### ✅ Backend - SUDAH IMPLEMENTASI

| Task | Status |
|------|--------|
| Database Migration | ✅ Selesai - `20250125000000_add_multi_match_tables.sql` |
| Backend - Types | ✅ Selesai - `bank-reconciliation.types.ts` |
| Backend - Schema Validation | ✅ Selesai - `bank-reconciliation.schema.ts` |
| Backend - Repository | ✅ Selesai - `bank-reconciliation.repository.ts` |
| Backend - Service | ✅ Selesai - `bank-reconciliation.service.ts` |
| Backend - Controller | ✅ Selesai - `bank-reconciliation.controller.ts` |
| Backend - Routes | ✅ Selesai - `bank-reconciliation.routes.ts` |

### ✅ Frontend - SUDAH IMPLEMENTASI

| Task | Status |
|------|--------|
| Frontend - Types | ✅ Selesai - `types/bank-reconciliation.types.ts` |
| Frontend - API | ✅ Selesai - `api/bank-reconciliation.api.ts` |
| Frontend - Hooks | ✅ Selesai - `hooks/useBankReconciliation.ts` |
| Frontend - MultiMatchModal | ✅ Selesai - `components/reconciliation/MultiMatchModal.tsx` |

---

## 14. Backend API Endpoints

### Multi-Match Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/reconciliation/bank/multi-match` | Create multi-match (1 POS = N Bank Statements) |
| DELETE | `/api/v1/reconciliation/bank/multi-match/:groupId` | Undo multi-match |
| GET | `/api/v1/reconciliation/bank/multi-match/suggestions` | Get suggested statements for grouping |
| GET | `/api/v1/reconciliation/bank/multi-match/groups` | Get all multi-match groups |
| GET | `/api/v1/reconciliation/bank/multi-match/:groupId` | Get details of a multi-match group |

### Request Examples

**Create Multi-Match:**
```json
POST /api/v1/reconciliation/bank/multi-match
{
  "companyId": "550e8400-e29b-41d4-a716-446655440000",
  "aggregateId": "123e4567-e89b-12d3-a456-426614174000",
  "statementIds": [
    "123e4567-e89b-12d3-a456-426614174001",
    "123e4567-e89b-12d3-a456-426614174002"
  ],
  "notes": "Multi-match untuk transaksi Debit BCA",
  "overrideDifference": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "groupId": "123e4567-e89b-12d3-a456-426614174003",
    "aggregateId": "123e4567-e89b-12d3-a456-426614174000",
    "statementIds": ["...", "..."],
    "totalBankAmount": 5036994,
    "aggregateAmount": 5069986,
    "difference": -32992,
    "differencePercent": 0.65
  }
}
```

---

## 15. Next Steps

1. [x] Approve plan ini
2. [x] Buat migration script
3. [x] Implement backend
4. [ ] Implement frontend
5. [ ] Testing
6. [ ] Deploy ke staging
7. [ ] User acceptance testing
8. [ ] Deploy ke production

