# Design Document: Daily Stock Opname Enhancement (Phase 1)

## Overview

This design covers three enhancements to the existing Daily Stock Opname system:

1. **Requirement 19** — UI Label Rename & Tooltips: Rename "MAIN Bal." → "Stok Main", add formula tooltips to column headers
2. **Requirement 20** — Real Consumption Analysis: New backend endpoint + "Analisis" tab on the detail page comparing real vs theoretical consumption
3. **Requirement 21** — Variance Classification: Full-screen modal for classifying negative variance into waste/shortage, with notification to assigned employees

Requirements 1–18 are already implemented and remain unchanged.

---

## Architecture

### System Context

```
┌──────────────────────────────────────────────────────────────┐
│                     Frontend (React)                          │
│                                                              │
│  DailyStockOpnameDetailPage                                  │
│  ├── Tab: "Opname" (existing — label rename + tooltips)      │
│  ├── Tab: "Analisis" (NEW — real consumption table)          │
│  └── ClassificationModal (NEW — full-screen modal)           │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼─────────────────────────────────┐
│                     Backend (Express)                         │
│                                                              │
│  daily-stock-opname.controller.ts                            │
│  ├── GET  /:id/analysis        → AnalysisService             │
│  ├── POST /:id/classify        → ClassificationService       │
│  └── GET  /:id/classifications → ClassificationService       │
│                                                              │
│  Notification Dispatcher (Socket.IO + DB)                    │
└────────────────────────────┬─────────────────────────────────┘
                             │ SQL
┌────────────────────────────▼─────────────────────────────────┐
│                     PostgreSQL                                │
│                                                              │
│  daily_closing_count_lines (existing — read for analysis)    │
│  stock_movements (existing — query CONVERSION movements)     │
│  variance_classification_lines (NEW table)                   │
│  notifications (existing)                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### Backend Components

| Component | File | Responsibility |
|-----------|------|----------------|
| AnalysisService | `daily-stock-opname-analysis.service.ts` | Computes real consumption per product line |
| ClassificationService | `daily-stock-opname-classification.service.ts` | Manages variance classification entries |
| ClassificationRepository | `daily-stock-opname-classification.repository.ts` | DB operations for variance_classification_lines |
| Controller (extended) | `daily-stock-opname.controller.ts` | New endpoints for analysis and classification |
| Routes (extended) | `daily-stock-opname.routes.ts` | Route registration for new endpoints |
| Schema (extended) | `daily-stock-opname.schema.ts` | Zod schemas for new request/response |

### Frontend Components

| Component | File | Responsibility |
|-----------|------|----------------|
| DailyStockOpnameDetailPage (modified) | `pages/DailyStockOpnameDetailPage.tsx` | Label rename, tooltips, tab navigation |
| AnalysisTab | `components/AnalysisTab.tsx` | Real consumption table display |
| ClassificationModal | `components/ClassificationModal.tsx` | Full-screen variance classification UI |
| ClassificationSummary | `components/ClassificationSummary.tsx` | Summary badge and totals |

### Interfaces

```typescript
// ─── Analysis Service Interface ─────────────────────────────────────────────

interface IAnalysisService {
  getAnalysis(sessionId: string, branchIds: string[]): Promise<AnalysisResponse>
}

// ─── Classification Service Interface ───────────────────────────────────────

interface IClassificationService {
  classify(sessionId: string, branchIds: string[], dto: ClassifyDto, userId: string): Promise<ClassificationSummary>
  getClassifications(sessionId: string, branchIds: string[]): Promise<ClassificationsResponse>
}
```

---

## Data Models

### New Table: variance_classification_lines

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| closing_id | UUID | FK → daily_closing_counts(id), NOT NULL | Parent session |
| line_id | UUID | FK → daily_closing_count_lines(id), NOT NULL | Parent line |
| variance_category | VARCHAR(20) | NOT NULL, CHECK IN ('WASTE','SHORTAGE') | Classification type |
| qty | NUMERIC(20,4) | NOT NULL, CHECK > 0 | Classified quantity |
| shortage_assigned_to | UUID | FK → employees(user_id), nullable | Employee responsible |
| shortage_note | TEXT | nullable | Explanation for shortage |
| classified_by | UUID | NOT NULL | User who classified |
| classified_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When classified |
| company_id | UUID | FK → companies(id), NOT NULL | Company scope |
| branch_id | UUID | FK → branches(id), NOT NULL | Branch scope |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record creation |

### Response DTOs

```typescript
// Analysis endpoint response
interface AnalysisLineItem {
  product_id: string
  product_code: string
  product_name: string
  uom: string
  stok_kemarin: number
  barang_masuk: number
  stok_hari_ini: number
  waste: number
  total_konversi: number
  pemakaian_riil: number
  pemakaian_pos: number
  gap: number
  has_recipe: boolean
}

interface AnalysisResponse {
  session_id: string
  closing_date: string
  branch_name: string
  lines: AnalysisLineItem[]
  summary: {
    total_pemakaian_riil: number
    total_pemakaian_pos: number
    total_gap: number
  }
}

// Classification endpoint DTOs
interface ClassifyLineEntry {
  line_id: string
  variance_category: 'WASTE' | 'SHORTAGE'
  qty: number
  shortage_assigned_to: string | null
  shortage_note: string | null
}

interface ClassifyDto {
  entries: ClassifyLineEntry[]
}

interface ClassificationEntry extends ClassifyLineEntry {
  id: string
  classified_by: string
  classified_at: string
  product_name: string
  product_code: string
  uom: string
  assigned_employee_name: string | null
}

interface ClassificationSummary {
  waste_total: number
  shortage_total: number
  entry_count: number
  is_complete: boolean  // see is_complete definition below
  classification_version: number  // increments on each re-submission
}
```

**`is_complete` Definition:**

```sql
-- is_complete = true when:
-- For ALL lines WHERE variance_qty < 0:
--   SUM(vcl.qty WHERE vcl.line_id = line.id) = ABS(line.variance_qty)
-- If any line has remaining unclassified qty, is_complete = false
```

```typescript
// In getSummary repository method:
async getClassificationSummary(closingId: string): Promise<ClassificationSummary> {
  const { rows } = await pool.query(`
    WITH negative_lines AS (
      SELECT id, ABS(variance_qty) AS abs_variance
      FROM daily_closing_count_lines
      WHERE closing_id = $1 AND variance_qty < 0
    ),
    classified AS (
      SELECT line_id, SUM(qty) AS classified_qty
      FROM variance_classification_lines
      WHERE closing_id = $1
      GROUP BY line_id
    )
    SELECT
      COALESCE(SUM(CASE WHEN vcl.variance_category = 'WASTE' THEN vcl.qty END), 0) AS waste_total,
      COALESCE(SUM(CASE WHEN vcl.variance_category = 'SHORTAGE' THEN vcl.qty END), 0) AS shortage_total,
      COUNT(vcl.id) AS entry_count,
      -- is_complete: true only when ALL negative-variance lines are fully classified
      BOOL_AND(COALESCE(c.classified_qty, 0) = nl.abs_variance) AS is_complete
    FROM negative_lines nl
    LEFT JOIN classified c ON c.line_id = nl.id
    LEFT JOIN variance_classification_lines vcl ON vcl.closing_id = $1
  `, [closingId])
  
  // Also fetch classification_version from parent session
  const { rows: sessionRows } = await pool.query(`
    SELECT classification_version FROM daily_closing_counts WHERE id = $1
  `, [closingId])

  return {
    waste_total: rows[0]?.waste_total ?? 0,
    shortage_total: rows[0]?.shortage_total ?? 0,
    entry_count: rows[0]?.entry_count ?? 0,
    is_complete: rows[0]?.is_complete ?? false,
    classification_version: sessionRows[0]?.classification_version ?? 0,
  }
}
```

interface ClassificationsResponse {
  entries: ClassificationEntry[]
  summary: ClassificationSummary
}
```

---

## Component Design

### Requirement 19: UI Label Rename & Tooltips

**Scope:** Frontend-only changes to `DailyStockOpnameDetailPage.tsx`

#### Changes

1. **Column header rename:** Replace `"MAIN Bal."` text with `"Stok Main"` in the `<thead>` section.

2. **Tooltip component:** Use a lightweight `Tooltip` wrapper (existing or inline `title` attribute) on column headers that have formula explanations.

```tsx
// Tooltip on "Sisa Expected" header
<th title="Sisa Expected = Stok Awal − Pemakaian POS">
  Sisa Expected
</th>

// Tooltip on "Var" header
<th title="Variance = Actual − Sisa Expected">
  Var
</th>
```

3. **Column headers (final order):** Code, Produk, Stok Awal, Pemakaian POS, Sisa Expected, Actual, Var, Var %, Foto, Stok Main

No backend changes required.

---

### Requirement 20: Real Consumption Analysis

#### Backend: Analysis Service

**New file:** `backend/src/modules/daily-stock-opname/daily-stock-opname-analysis.service.ts`

##### Data Model (Response)

```typescript
interface AnalysisLineItem {
  product_id: string
  product_code: string
  product_name: string
  uom: string
  stok_kemarin: number      // system_qty from opname line (already includes DPO transfers)
  barang_masuk: number      // dpo_in_qty from opname line — display only, NOT used in formula
  stok_hari_ini: number     // actual_qty from confirmed line
  waste: number             // abs(variance_qty) when variance < 0, else 0
  total_konversi: number    // sum of OUT_CONVERSION + IN_CONVERSION movements
  pemakaian_riil: number    // computed: stok_kemarin − (stok_hari_ini + waste) + total_konversi
  pemakaian_pos: number     // theoretical_out from opname line (0 if has_recipe = false)
  gap: number               // pemakaian_riil - pemakaian_pos
  has_recipe: boolean
}

interface AnalysisResponse {
  session_id: string
  closing_date: string
  branch_name: string
  lines: AnalysisLineItem[]
  summary: {
    total_pemakaian_riil: number
    total_pemakaian_pos: number
    total_gap: number
  }
}
```

##### Computation Logic

```typescript
// For each opname line in the confirmed session:
function computeAnalysisLine(
  line: DailyClosingCountLine,
  conversionMovements: Map<string, number>  // product_id → net conversion qty
): AnalysisLineItem {
  const stok_kemarin = line.system_qty  // already includes DPO transfers via stock_balances
  const barang_masuk = line.dpo_in_qty  // display-only reference, NOT used in formula
  const stok_hari_ini = line.actual_qty!  // guaranteed non-null for CONFIRMED
  
  // waste = abs(negative variance) only when variance is negative
  const variance = line.actual_qty! - line.expected_qty
  const waste = variance < 0 ? Math.abs(variance) : 0
  
  // total_konversi: sum of OUT_CONVERSION and IN_CONVERSION for this product on this date
  const total_konversi = conversionMovements.get(line.product_id) ?? 0
  
  // Pemakaian Riil formula (corrected — barang_masuk excluded to avoid double-counting)
  // system_qty already includes DPO IN_TRANSFER movements via stock_balances
  const pemakaian_riil = stok_kemarin - (stok_hari_ini + waste) + total_konversi
  
  // Pemakaian POS: theoretical_out (0 if no recipe)
  const pemakaian_pos = line.has_recipe ? line.theoretical_out : 0
  
  // Gap
  const gap = pemakaian_riil - pemakaian_pos
  
  return {
    product_id: line.product_id,
    product_code: line.product_code,
    product_name: line.product_name,
    uom: line.uom,
    stok_kemarin,
    barang_masuk,       // included in response for display/transparency only
    stok_hari_ini,
    waste,
    total_konversi,
    pemakaian_riil,
    pemakaian_pos,
    gap,
    has_recipe: line.has_recipe,
  }
}
```

##### Repository Query for Conversion Movements

```typescript
// In daily-stock-opname.repository.ts
async getConversionMovementsForDate(
  warehouseId: string,
  date: string,
  productIds: string[]
): Promise<Map<string, number>> {
  // Returns net conversion quantity per product:
  // IN_CONVERSION qty is positive (product gained), OUT_CONVERSION is negative (product consumed)
  const { rows } = await pool.query(`
    SELECT product_id,
      SUM(CASE WHEN movement_type = 'IN_CONVERSION' THEN qty ELSE 0 END) -
      SUM(CASE WHEN movement_type = 'OUT_CONVERSION' THEN qty ELSE 0 END) AS net_conversion
    FROM stock_movements
    WHERE warehouse_id = $1
      AND movement_date = $2::date
      AND movement_type IN ('OUT_CONVERSION', 'IN_CONVERSION')
      AND product_id = ANY($3::uuid[])
    GROUP BY product_id
  `, [warehouseId, date, productIds])
  
  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.product_id, Number(row.net_conversion))
  }
  return map
}
```

##### API Endpoint

```
GET /api/v1/daily-stock-opname/:id/analysis
```

**Access control:** User must have `view` permission on `daily_stock_opname` module AND branch access to the session's branch.

**Validation:**
- Session must exist and be accessible
- Session must be in `CONFIRMED` or `FLAGGED` status (return 400 for DRAFT)

#### Frontend: Analisis Tab

**Modified file:** `DailyStockOpnameDetailPage.tsx`

Add tab navigation using existing pattern:

```tsx
const [activeTab, setActiveTab] = useState<'opname' | 'analisis'>('opname')
```

Tab is only shown when session status is CONFIRMED or FLAGGED. The Analisis tab renders a read-only table with columns: Produk, Stok Kemarin, Barang Masuk, Stok Hari Ini, Waste, Konversi, Pemakaian Riil, Pemakaian POS, Gap.

Gap cells with positive values are highlighted with `text-amber-600 bg-amber-50` styling.

**New TanStack Query hook:**

```typescript
// In api/dailyStockOpname.ts
export const useOpnameAnalysis = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['daily-stock-opname', id, 'analysis'],
    queryFn: async () => {
      const { data } = await api.get(`/daily-stock-opname/${id}/analysis`)
      return data.data as AnalysisResponse
    },
    enabled: !!id && enabled,
  })
```

---

### Requirement 21: Variance Classification

#### Database: New Table

**Migration file:** `backend/database/migrations/2026XXXX_variance_classification_lines.sql`

```sql
CREATE TABLE IF NOT EXISTS variance_classification_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id            UUID NOT NULL REFERENCES daily_closing_counts(id),
  line_id               UUID NOT NULL REFERENCES daily_closing_count_lines(id),
  variance_category     VARCHAR(20) NOT NULL CHECK (variance_category IN ('WASTE', 'SHORTAGE')),
  qty                   NUMERIC(20,4) NOT NULL CHECK (qty > 0),
  shortage_assigned_to  UUID REFERENCES employees(user_id),
  shortage_note         TEXT,
  classified_by         UUID NOT NULL,
  classified_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  branch_id             UUID NOT NULL REFERENCES branches(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vcl_closing ON variance_classification_lines(closing_id);
CREATE INDEX IF NOT EXISTS idx_vcl_line ON variance_classification_lines(line_id);
CREATE INDEX IF NOT EXISTS idx_vcl_assigned ON variance_classification_lines(shortage_assigned_to)
  WHERE variance_category = 'SHORTAGE';
```

#### Backend: Classification Service

**New file:** `backend/src/modules/daily-stock-opname/daily-stock-opname-classification.service.ts`

##### Input DTO

```typescript
interface ClassifyLineEntry {
  line_id: string
  variance_category: 'WASTE' | 'SHORTAGE'
  qty: number
  shortage_assigned_to: string | null  // required when category = SHORTAGE
  shortage_note: string | null
}

interface ClassifyDto {
  entries: ClassifyLineEntry[]
}
```

##### Validation Rules

```typescript
// For each unique line_id in entries:
// 1. Line must belong to this session
// 2. Line must have negative variance (variance_qty < 0)
// 3. Sum of all entries for this line_id must equal abs(line.variance_qty)
// 4. If category = 'SHORTAGE', shortage_assigned_to is required
// 5. All qty values must be > 0
// 6. If category = 'SHORTAGE', shortage_assigned_to must reference an active employee
//    (is_active = true AND deleted_at IS NULL) in the same company
```

##### Business Logic Flow

```
1.  Validate session is CONFIRMED or FLAGGED
2.  Validate caller is PIC (pic_user_id) or has 'approve' permission
3.  Validate company_id and branch_id scoping
4.  Fetch all lines with negative variance for this session
5.  Validate entries against lines (see rules above)
6.  For each SHORTAGE entry: validate shortage_assigned_to employee is active
    → Query employees table: is_active = true AND deleted_at IS NULL
    → If inactive/deleted → return error SHORTAGE_EMPLOYEE_INACTIVE
7.  If existing classifications exist (re-submission):
    a. Log previous classification state to AuditService (all entry details)
    b. Increment classification_version on session
    c. Delete old classification entries
8.  Insert new classification entries in transaction
9.  For each SHORTAGE entry: dispatch notification to shortage_assigned_to
10. Return classification summary (includes updated classification_version)
```

##### Active Employee Validation

Before accepting any SHORTAGE classification entry, the service queries the employees table:

```typescript
// In ClassificationService.classify()
async validateShortageEmployees(
  entries: ClassifyLineEntry[],
  companyId: string
): Promise<void> {
  const shortageEntries = entries.filter(e => e.variance_category === 'SHORTAGE')
  if (shortageEntries.length === 0) return

  const employeeIds = [...new Set(shortageEntries.map(e => e.shortage_assigned_to!))]
  
  const { rows } = await pool.query(`
    SELECT user_id FROM employees
    WHERE user_id = ANY($1::uuid[])
      AND company_id = $2
      AND is_active = true
      AND deleted_at IS NULL
  `, [employeeIds, companyId])

  const activeIds = new Set(rows.map(r => r.user_id))
  const inactiveIds = employeeIds.filter(id => !activeIds.has(id))

  if (inactiveIds.length > 0) {
    throw new AppError(
      'SHORTAGE_EMPLOYEE_INACTIVE',
      400,
      `Karyawan tidak aktif atau sudah dihapus tidak dapat di-assign shortage`
    )
  }
}
```

##### Classification Audit Trail (Re-submission)

When classifications already exist for a session (replace strategy), the service logs the previous state before deletion:

```typescript
// In ClassificationService.classify() — before delete
async logPreviousClassifications(
  sessionId: string,
  userId: string
): Promise<void> {
  const existing = await this.repository.getClassificationsByClosingId(sessionId)
  if (existing.length === 0) return

  await this.auditService.log({
    action: 'CLASSIFICATION_REPLACED',
    entity_type: 'daily_closing_count',
    entity_id: sessionId,
    user_id: userId,
    details: {
      previous_entries: existing.map(e => ({
        line_id: e.line_id,
        variance_category: e.variance_category,
        qty: e.qty,
        shortage_assigned_to: e.shortage_assigned_to,
        classified_by: e.classified_by,
        classified_at: e.classified_at,
      })),
      previous_version: currentVersion,  // classification_version before increment
    },
  })
}
```

##### Classification Version Tracking

The `classification_version` is stored on the parent `daily_closing_counts` table (or a dedicated column):

```sql
-- Add to daily_closing_counts table
ALTER TABLE daily_closing_counts
  ADD COLUMN IF NOT EXISTS classification_version INTEGER NOT NULL DEFAULT 0;
```

On each classify submission:
```typescript
// Increment version in the same transaction
await client.query(`
  UPDATE daily_closing_counts
  SET classification_version = classification_version + 1
  WHERE id = $1
`, [sessionId])
```

##### Notification Integration

Register new event key in `notification-events.ts`:

```typescript
// Add to NOTIFICATION_EVENT_KEYS:
OPNAME_SHORTAGE_ASSIGNED: 'opname.shortage_assigned',

// Add to NOTIFICATION_EVENT_CATALOG:
{
  event_key: NOTIFICATION_EVENT_KEYS.OPNAME_SHORTAGE_ASSIGNED,
  label: 'Shortage opname di-assign',
  description: 'Karyawan mendapat assignment shortage dari opname harian',
  category: 'inventory',
  default_type: 'warning',
  default_title_template: 'Shortage Opname',
  default_message_template: '{{product_name}} — {{qty}} {{uom}} shortage ditandai atas nama Anda oleh {{pic_name}}. Catatan: {{note}}',
  default_redirect_url_template: '/inventory/daily-stock-opname/{{session_id}}',
}
```

Notification dispatch uses the existing `notificationDispatcher.dispatch()` pattern with `additionalRecipientIds` pointing to the `shortage_assigned_to` user:

```typescript
await notificationDispatcher.dispatch(
  NOTIFICATION_EVENT_KEYS.OPNAME_SHORTAGE_ASSIGNED,
  companyId,
  {
    entityId: sessionId,
    variables: {
      product_name: line.product_name,
      qty: String(entry.qty),
      uom: line.uom,
      pic_name: picName,
      note: entry.shortage_note ?? '-',
      session_id: sessionId,
    },
    additionalRecipientIds: [entry.shortage_assigned_to!],
    excludeUserIds: [],
  }
)
```

##### API Endpoints

```
POST /api/v1/daily-stock-opname/:id/classify
  Body: { entries: ClassifyLineEntry[] }
  Response: { waste_total: number, shortage_total: number, entry_count: number }

GET  /api/v1/daily-stock-opname/:id/classifications
  Response: { entries: ClassificationEntry[], summary: ClassificationSummary }
```

**Access control:**
- POST: PIC (pic_user_id matches) OR user has `approve` permission on `daily_stock_opname`
- GET: User has `view` permission on `daily_stock_opname` AND branch access

#### Frontend: Classification Modal

**New component:** `frontend/src/features/daily-stock-opname/components/ClassificationModal.tsx`

Full-screen modal (using `fixed inset-0 z-50`) displaying:

1. **Header:** Session info, "Klasifikasi Variance" title, close button
2. **Table:** All negative-variance lines with split inputs
3. **Footer:** Summary totals, submit button

Each row allows splitting into waste and shortage:

```tsx
interface ClassificationRow {
  line_id: string
  product_name: string
  product_code: string
  uom: string
  variance_qty: number  // negative value
  abs_variance: number  // displayed
  waste_qty: number     // editable, default = abs_variance
  shortage_qty: number  // editable, default = 0
  shortage_assigned_to: string | null
  shortage_note: string | null
}
```

**Validation (client-side):**
- For each row: `waste_qty + shortage_qty === abs_variance`
- If `shortage_qty > 0`: `shortage_assigned_to` must be selected

**Employee Picker:**

The employee picker for `shortage_assigned_to` uses the existing employee search API from `@/features/employees`:

```typescript
// Uses existing employeesApi.search() from @/features/employees
import { useEmployeeSearch } from '@/features/employees/api/employees'

// In ClassificationModal component:
const { data: employees } = useEmployeeSearch({
  branch_name: session.branch_name,
  is_active: true,
})
```

API call: `GET /employees/search?branch_name={branchName}&is_active=true`

This filters to only show active employees from the same branch as the opname session, ensuring the user cannot accidentally assign shortage to an inactive or cross-branch employee.

**New TanStack Query hooks:**

```typescript
export const useClassifyOpname = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, body }: { sessionId: string; body: ClassifyDto }) => {
      const { data } = await api.post(`/daily-stock-opname/${sessionId}/classify`, body)
      return data.data
    },
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(sessionId) })
      qc.invalidateQueries({ queryKey: ['daily-stock-opname', sessionId, 'classifications'] })
    },
  })
}

export const useOpnameClassifications = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['daily-stock-opname', id, 'classifications'],
    queryFn: async () => {
      const { data } = await api.get(`/daily-stock-opname/${id}/classifications`)
      return data.data as ClassificationsResponse
    },
    enabled: !!id && enabled,
  })
```

**"Klasifikasi Variance" button visibility:**
- Session status is `CONFIRMED` or `FLAGGED`
- Current user is the PIC (`pic_user_id`) OR has `approve` permission
- Session has at least one line with negative variance

**"Classified" badge:**
- Shown when `is_complete = true` from the classification summary
- Definition: for ALL lines WHERE `variance_qty < 0`, the SUM of classification entry quantities for that line equals `ABS(variance_qty)`. If any negative-variance line has remaining unclassified qty, badge is not shown.

---

## Data Flow

### Analysis Flow

```
User clicks "Analisis" tab
  → useOpnameAnalysis(sessionId) fires
  → GET /daily-stock-opname/:id/analysis
  → AnalysisService:
      1. Load session + lines (from existing detail query)
      2. Validate status = CONFIRMED/FLAGGED
      3. Query conversion movements for date + warehouse + product IDs
      4. Compute per-line analysis using formula
      5. Return AnalysisResponse
  → Frontend renders table with highlight on positive gaps
```

### Classification Flow

```
User clicks "Klasifikasi Variance"
  → Modal opens with negative-variance lines
  → Employee picker loads: GET /employees/search?branch_name={branchName}&is_active=true
  → User splits each line into waste/shortage portions
  → User assigns employees for shortage portions (from branch active employees)
  → Submit → POST /daily-stock-opname/:id/classify
  → ClassificationService:
      1. Validate session status & user authorization
      2. Validate sum constraint per line
      3. Validate shortage employees are active (is_active=true, deleted_at IS NULL)
      4. If re-submission: log previous state to AuditService, increment version
      5. Delete old classifications (replace strategy)
      6. Insert new entries in transaction
      7. For each SHORTAGE: dispatch notification
      8. Return summary (includes classification_version)
  → Frontend invalidates queries, shows success toast
  → Detail header shows "Classified" badge
```

---

## Error Handling

| Scenario | Error Code | HTTP Status | Message |
|----------|-----------|-------------|---------|
| Analysis on DRAFT session | `OPNAME_NOT_CONFIRMED` | 400 | "Analisis hanya tersedia setelah opname dikonfirmasi" |
| Classify on DRAFT session | `OPNAME_NOT_CONFIRMED` | 400 | "Klasifikasi hanya dapat dilakukan pada sesi CONFIRMED/FLAGGED" |
| Non-PIC user without approve permission | `OPNAME_UNAUTHORIZED` | 403 | "Hanya PIC atau user dengan permission approve yang dapat mengklasifikasi" |
| Classification sum mismatch | `CLASSIFICATION_SUM_MISMATCH` | 400 | "Total klasifikasi ({sum}) tidak sama dengan abs variance ({expected}) untuk produk {name}" |
| Shortage without assigned employee | `SHORTAGE_EMPLOYEE_REQUIRED` | 400 | "Employee harus dipilih untuk klasifikasi shortage" |
| Shortage assigned to inactive/deleted employee | `SHORTAGE_EMPLOYEE_INACTIVE` | 400 | "Karyawan tidak aktif atau sudah dihapus tidak dapat di-assign shortage" |
| Session not found / no branch access | `OPNAME_NOT_FOUND` | 404 | "Sesi opname tidak ditemukan" |

---

## Testing Strategy

### Property-Based Tests

Three core properties are tested with 100+ generated inputs each:

1. **Real Consumption Formula** — Generate random valid numeric tuples (system_qty, actual_qty, variance_qty, total_konversi, theoretical_out) and verify the `computeAnalysisLine` function produces correct pemakaian_riil (using corrected formula without barang_masuk), waste, and gap values. Ensure barang_masuk is present in DTO but not used in calculation.

2. **Classification Sum Validation** — Generate random negative variances and random splits into waste/shortage portions, verify the validator accepts valid splits and rejects invalid ones.

3. **Active Employee Validation** — Generate classification entries with random employee states (active/inactive, deleted/not-deleted), verify the system accepts entries only when all shortage employees have is_active = true AND deleted_at IS NULL.

### Unit Tests (Example-Based)

- Analysis endpoint returns 400 for DRAFT sessions
- Analysis correctly maps system_qty → stok_kemarin, dpo_in_qty → barang_masuk (display only), actual_qty → stok_hari_ini
- Analysis formula does NOT include barang_masuk in pemakaian_riil calculation
- Classification requires employee for shortage entries
- Classification restricted to PIC or approve-permission users
- Classification rejects inactive/deleted employees for shortage assignment
- Classification re-submission logs previous state to AuditService before deletion
- Classification version increments on each re-submission
- Notification dispatched for shortage entries
- is_complete returns false when any negative-variance line has unclassified qty remaining
- is_complete returns true when all negative-variance lines are fully classified
- Employee picker calls GET /employees/search with branch_name and is_active=true
- UI tooltips render correct formula text
- Column header shows "Stok Main" not "MAIN Bal."

### Integration Tests

- Analysis endpoint queries conversion movements from stock_movements table
- Classification entries persist to variance_classification_lines table
- classification_version column persists and increments correctly
- AuditService receives classification history on re-submission
- Socket.IO notification delivered to assigned employee
- Classification state reflected in "Classified" badge on detail page
- Employee search API filters correctly by branch and active status

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Real Consumption Formula Invariant

*For any* opname line with valid numeric values for system_qty (stok_kemarin), actual_qty (stok_hari_ini), variance_qty, and net conversion quantity (total_konversi), the computed pemakaian_riil SHALL equal `stok_kemarin − (stok_hari_ini + waste) + total_konversi` where waste is `abs(variance_qty)` when variance_qty < 0 and `0` otherwise. The barang_masuk (dpo_in_qty) value SHALL be present in the response DTO for display but SHALL NOT be included in the pemakaian_riil formula. The gap SHALL equal `pemakaian_riil - pemakaian_pos`.

**Validates: Requirements 20.2, 20.4, 20.6, 20.8**

### Property 2: Classification Sum Invariant

*For any* opname line with negative variance and *for any* set of classification entries submitted for that line, the classification is valid if and only if the sum of all entry quantities equals the absolute value of the line's variance_qty. The system SHALL accept the classification when the sum matches and reject it when it does not.

**Validates: Requirements 21.4, 21.7**

### Property 3: Active Employee Constraint for Shortage Assignment

*For any* classification submission containing SHORTAGE entries, the system SHALL accept the submission only when ALL referenced shortage_assigned_to employees satisfy `is_active = true AND deleted_at IS NULL`. *For any* submission where at least one shortage employee is inactive or deleted, the system SHALL reject the entire submission with an error.

**Validates: Requirements 21.18**

### Property 4: Classification Completeness (is_complete)

*For any* confirmed opname session with negative-variance lines, `is_complete` SHALL be `true` if and only if *for all* lines where `variance_qty < 0`, the sum of classification entry quantities for that line equals `ABS(variance_qty)`. If any negative-variance line has remaining unclassified quantity, `is_complete` SHALL be `false`.

**Validates: Requirements 21.13**
