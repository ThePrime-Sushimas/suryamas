# Technical Design — Daily Stock Opname (Daily Closing Count)

## Overview

This document describes the technical design for the Daily Stock Opname feature — a nightly inventory control system for READY warehouses. The system calculates expected balances, accepts physical counts, records variances as stock movements, and provides reporting/dashboard capabilities.

## Architecture

### 2.1 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Opname List  │  │ Opname Detail│  │ Variance Report       │ │
│  │ Page         │  │ /Input Page  │  │ + Dashboard Widget    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
└─────────┼──────────────────┼──────────────────────┼─────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Express)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              daily-stock-opname module                     │   │
│  │  controller → service → repository                        │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│  ┌──────────┐  ┌───────────┴──┐  ┌──────────────┐  ┌────────┐ │
│  │ Stock    │  │ Theoretical  │  │ Storage      │  │ Audit  │ │
│  │ Module   │  │ Consumption  │  │ Service (R2) │  │Service │ │
│  └──────────┘  └──────────────┘  └──────────────┘  └────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL                                   │
│  daily_closing_counts, daily_closing_count_lines,                │
│  branch_opname_config, stock_balances, stock_movements           │
└─────────────────────────────────────────────────────────────────┘
```


### 2.2 Backend Module Structure

```
backend/src/modules/daily-stock-opname/
├── daily-stock-opname.controller.ts
├── daily-stock-opname.service.ts
├── daily-stock-opname.repository.ts
├── daily-stock-opname.routes.ts
├── daily-stock-opname.schema.ts
├── daily-stock-opname.types.ts
├── daily-stock-opname.errors.ts
└── daily-stock-opname.openapi.ts
```

### 2.3 Frontend Feature Structure

```
frontend/src/features/daily-stock-opname/
├── api/
│   └── dailyStockOpname.ts
├── components/
│   ├── OpnameLineRow.tsx
│   ├── OpnameSummaryCard.tsx
│   ├── OpnamePhotoUpload.tsx
│   ├── OpnameStatusBadge.tsx
│   ├── VarianceIndicator.tsx
│   ├── ResolveModal.tsx
│   └── DashboardWidget.tsx
├── pages/
│   ├── DailyStockOpnamePage.tsx        (list)
│   ├── DailyStockOpnameDetailPage.tsx  (detail/input)
│   └── OpnameVarianceReportPage.tsx    (report)
├── utils/
│   └── opnameFilters.url.ts
└── types/
    └── index.ts
```

## 3. Database Schema

### 3.1 New Tables

#### `branch_opname_config`

```sql
CREATE TABLE branch_opname_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  branch_id             UUID NOT NULL REFERENCES branches(id),
  variance_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  closing_time          TIME NOT NULL DEFAULT '23:59',
  grace_period_minutes  INT NOT NULL DEFAULT 15,
  updated_by            UUID,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id)
);
```

#### `daily_closing_counts`

```sql
CREATE TABLE daily_closing_counts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
  closing_date        DATE NOT NULL,
  pic_user_id         UUID NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'CONFIRMED', 'FLAGGED')),
  total_variance_cost NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_expected_cost NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_actual_cost   NUMERIC(20,4) NOT NULL DEFAULT 0,
  line_count          INT NOT NULL DEFAULT 0,
  completed_count     INT NOT NULL DEFAULT 0,
  resolution_note     TEXT,
  resolved_by         UUID,
  resolved_at         TIMESTAMPTZ,
  confirmed_by        UUID,
  confirmed_at        TIMESTAMPTZ,
  notes               TEXT,
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID
);

CREATE UNIQUE INDEX idx_closing_counts_branch_date
  ON daily_closing_counts(branch_id, closing_date)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_closing_counts_company ON daily_closing_counts(company_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_closing_counts_status ON daily_closing_counts(status)
  WHERE deleted_at IS NULL;
```

#### `daily_closing_count_lines`

```sql
CREATE TABLE daily_closing_count_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id      UUID NOT NULL REFERENCES daily_closing_counts(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  product_code    VARCHAR(50) NOT NULL,
  product_name    VARCHAR(200) NOT NULL,
  uom             VARCHAR(30) NOT NULL,
  system_qty      NUMERIC(20,4) NOT NULL DEFAULT 0,
  expected_qty    NUMERIC(20,4) NOT NULL DEFAULT 0,
  actual_qty      NUMERIC(20,4),
  variance_qty    NUMERIC(20,4),
  variance_pct    NUMERIC(10,2),
  cost_per_unit   NUMERIC(20,4) NOT NULL DEFAULT 0,
  variance_cost   NUMERIC(20,4),
  main_balance    NUMERIC(20,4) NOT NULL DEFAULT 0,
  dpo_in_qty      NUMERIC(20,4) NOT NULL DEFAULT 0,
  theoretical_out NUMERIC(20,4) NOT NULL DEFAULT 0,
  is_high_risk    BOOLEAN NOT NULL DEFAULT false,
  requires_photo  BOOLEAN NOT NULL DEFAULT false,
  photo_url       TEXT,
  has_recipe      BOOLEAN NOT NULL DEFAULT true,
  has_warning     BOOLEAN NOT NULL DEFAULT false,
  warning_message TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  out_movement_id UUID,
  in_movement_id  UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_closing_lines_closing ON daily_closing_count_lines(closing_id);
CREATE INDEX idx_closing_lines_product ON daily_closing_count_lines(product_id);
```

### 3.2 Schema Changes to Existing Tables

```sql
-- Add 'daily_closing_count' to reference_type check constraint on stock_movements
-- (handled via ALTER or by updating the application-level validation)

-- Ensure products.risk_category exists (already present per INVENTORY_SYSTEM_V2_PLAN)
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS risk_category VARCHAR(10) DEFAULT 'LOW'
--   CHECK (risk_category IN ('HIGH', 'MEDIUM', 'LOW'));
```

### 3.3 Reference Type Addition

In `backend/src/modules/stock/stock.types.ts`, add `'daily_closing_count'` to `ReferenceType`:

```typescript
export type ReferenceType =
  | 'purchase_order' | 'transfer_order' | 'branch_loan'
  | 'daily_requisition' | 'production_order' | 'adjustment' | 'opening'
  | 'goods_processing' | 'daily_closing_count'  // ← NEW
```


## Components and Interfaces

### 4.1 Opname CRUD & Actions

| Method | Path | Description | Req |
|--------|------|-------------|-----|
| GET | `/api/v1/daily-stock-opname` | List opname sessions (paginated, filtered) | R11 |
| GET | `/api/v1/daily-stock-opname/:id` | Get opname detail with lines | R12 |
| POST | `/api/v1/daily-stock-opname` | Create new opname session | R1, R2 |
| PATCH | `/api/v1/daily-stock-opname/:id/lines/:lineId` | Update actual qty for a line | R3 |
| PATCH | `/api/v1/daily-stock-opname/:id/lines/bulk` | Bulk update actual quantities | R3 |
| POST | `/api/v1/daily-stock-opname/:id/lines/:lineId/photo` | Upload photo for a line | R4 |
| POST | `/api/v1/daily-stock-opname/:id/confirm` | Confirm opname session | R5 |
| POST | `/api/v1/daily-stock-opname/:id/resolve` | Resolve flagged session | R8 |
| DELETE | `/api/v1/daily-stock-opname/:id` | Cancel (soft-delete) draft session | R7 |

### 4.2 Configuration

| Method | Path | Description | Req |
|--------|------|-------------|-----|
| GET | `/api/v1/daily-stock-opname/config/:branchId` | Get branch opname config | R17, R18 |
| PUT | `/api/v1/daily-stock-opname/config/:branchId` | Update branch opname config | R17, R18 |

### 4.3 Reports & Dashboard

| Method | Path | Description | Req |
|--------|------|-------------|-----|
| GET | `/api/v1/daily-stock-opname/dashboard` | Today's opname status per branch | R14 |
| GET | `/api/v1/daily-stock-opname/variance-report` | Variance report (aggregated) | R13 |
| GET | `/api/v1/daily-stock-opname/variance-report/export` | Export variance report CSV | R13 |

## Data Models

### 5.1 Backend Types (`daily-stock-opname.types.ts`)

```typescript
export type OpnameStatus = 'DRAFT' | 'CONFIRMED' | 'FLAGGED'
export type OpnameDisplayStatus = OpnameStatus | 'MISSED' | 'NOT_STARTED'

export interface DailyClosingCount {
  id: string
  company_id: string
  branch_id: string
  warehouse_id: string
  closing_date: string
  pic_user_id: string
  status: OpnameStatus
  total_variance_cost: number
  total_expected_cost: number
  total_actual_cost: number
  line_count: number
  completed_count: number
  resolution_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  notes: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface DailyClosingCountWithRelations extends DailyClosingCount {
  branch_name: string
  branch_code: string
  warehouse_name: string
  pic_name: string
  resolved_by_name: string | null
  confirmed_by_name: string | null
}

export interface DailyClosingCountLine {
  id: string
  closing_id: string
  product_id: string
  product_code: string
  product_name: string
  uom: string
  system_qty: number
  expected_qty: number
  actual_qty: number | null
  variance_qty: number | null
  variance_pct: number | null
  cost_per_unit: number
  variance_cost: number | null
  main_balance: number
  dpo_in_qty: number
  theoretical_out: number
  is_high_risk: boolean
  requires_photo: boolean
  photo_url: string | null
  has_recipe: boolean
  has_warning: boolean
  warning_message: string | null
  sort_order: number
  out_movement_id: string | null
  in_movement_id: string | null
}

export interface DailyClosingCountDetail extends DailyClosingCountWithRelations {
  lines: DailyClosingCountLine[]
  summary: OpnameSummary
}

export interface OpnameSummary {
  total_expected_cost: number
  total_actual_cost: number
  total_variance_cost: number
  completion_pct: number
  line_count: number
  completed_count: number
  flagged_line_count: number
}
```

```typescript
// DTOs
export interface CreateOpnameDto {
  branch_id: string
  notes?: string
}

export interface UpdateLineDto {
  actual_qty: number
}

export interface BulkUpdateLinesDto {
  lines: { line_id: string; actual_qty: number }[]
}

export interface ConfirmOpnameDto {
  // No body needed — user context from auth
}

export interface ResolveOpnameDto {
  resolution_note: string
}

export interface UpsertOpnameConfigDto {
  variance_threshold_pct?: number
  closing_time?: string  // HH:mm format
  grace_period_minutes?: number
}

// Config
export interface BranchOpnameConfig {
  id: string
  company_id: string
  branch_id: string
  variance_threshold_pct: number
  closing_time: string
  grace_period_minutes: number
  updated_by: string | null
  updated_at: string
}

// Dashboard
export interface OpnameDashboardItem {
  branch_id: string
  branch_name: string
  branch_code: string
  status: OpnameDisplayStatus
  session_id: string | null
  total_variance_cost: number | null
  completion_pct: number | null
  closing_date: string | null
}

// Variance Report
export interface VarianceReportItem {
  product_id: string
  product_code: string
  product_name: string
  uom: string
  risk_category: string
  total_variance_qty: number
  total_variance_cost: number
  avg_variance_pct: number
  session_count: number
  flagged_count: number
}

export interface VarianceReportFilter {
  date_from: string
  date_to: string
  branch_id?: string
  product_id?: string
  risk_category?: string
  group_by?: 'day' | 'week' | 'month'
}
```

## 6. Data Flow — Key Operations

### 6.1 Create Opname Session

```
User clicks "Mulai Opname" on list page
        │
        ▼
POST /api/v1/daily-stock-opname { branch_id }
        │
        ▼
┌─ Service: createSession() ─────────────────────────────────────┐
│ 1. Validate: current date (Jakarta TZ), not past closing_time  │
│ 2. Validate: no existing session for branch+date               │
│ 3. Resolve READY warehouse for branch                          │
│ 4. Resolve MAIN warehouse for branch                           │
│ 5. Get branch_opname_config (or defaults)                      │
│ 6. Calculate expected balances:                                 │
│    a. Get current stock_balances for READY warehouse            │
│    b. Get today's DPO IN_TRANSFER movements to READY           │
│    c. Get theoretical consumption for today (POS × recipes)    │
│    d. expected = ready_balance + dpo_in - theoretical           │
│    e. Clamp negative to 0, flag warning                        │
│ 7. Get MAIN warehouse balances (snapshot)                      │
│ 8. Get product risk_category for each product                  │
│ 9. Get cost_per_unit (from stock_balances.avg_cost or last     │
│    movement cost)                                              │
│ 10. Insert daily_closing_counts header                         │
│ 11. Insert daily_closing_count_lines (all products)            │
│ 12. AuditService.log('CREATE', ...)                            │
└────────────────────────────────────────────────────────────────┘
        │
        ▼
Return session detail with all lines
```


### 6.2 Confirm Opname Session

```
User clicks "Konfirmasi" on detail page
        │
        ▼
POST /api/v1/daily-stock-opname/:id/confirm
        │
        ▼
┌─ Service: confirmSession() ────────────────────────────────────┐
│ 1. Validate: session is DRAFT                                  │
│ 2. Validate: current time within closing_time + grace          │
│ 3. Validate: all lines have actual_qty (no nulls)              │
│ 4. Validate: high-risk lines with photo requirement have photo │
│ 5. Get branch_opname_config for threshold                      │
│ 6. BEGIN TRANSACTION                                           │
│    For each line:                                              │
│    a. Calculate variance = actual_qty - expected_qty           │
│    b. Calculate variance_cost = variance × cost_per_unit       │
│    c. IF variance < 0:                                         │
│       → stockRepository.createMovement(OUT_WASTE, abs(var))    │
│       → stockRepository.upsertBalance(actual_qty)              │
│       → Store out_movement_id on line                          │
│    d. IF variance > 0:                                         │
│       → stockRepository.createMovement(IN_ADJUSTMENT, var)     │
│       → stockRepository.upsertBalance(actual_qty)              │
│       → Store in_movement_id on line                           │
│    e. IF variance == 0:                                        │
│       → stockRepository.upsertBalance(actual_qty)              │
│       (sync balance to actual, no movement needed)             │
│ 7. Calculate total_variance_cost (sum of abs(line costs))      │
│ 8. Determine status:                                           │
│    IF any line variance_pct > threshold → FLAGGED              │
│    ELSE → CONFIRMED                                            │
│ 9. Update header (status, totals, confirmed_by, confirmed_at)  │
│ 10. COMMIT TRANSACTION                                         │
│ 11. AuditService.log('UPDATE', ...)                            │
└────────────────────────────────────────────────────────────────┘
        │
        ▼
Return updated session detail
```

### 6.3 Expected Balance Calculation Detail

```
For each product in READY warehouse:

  ready_balance = stock_balances.qty WHERE warehouse_id = READY
                  (already reflects all prior movements)

  dpo_in_qty = SUM(stock_movements.qty)
               WHERE warehouse_id = READY
               AND movement_type = 'IN_TRANSFER'
               AND reference_type = 'transfer_order'
               AND movement_date = today
               AND created_at <= session_creation_time

  theoretical_out = (from theoretical_consumption query)
                    SUM(recipe_qty × pos_sales_qty)
                    for direct products + WIP ingredient explosion
                    WHERE sales_date = today AND branch = this branch

  expected_qty = ready_balance + dpo_in_qty - theoretical_out
               = MAX(0, calculated_value)  -- clamp negatives
```

**Note:** The `ready_balance` from `stock_balances` already includes DPO transfers that happened today (since DPO confirm creates IN_TRANSFER movements that update stock_balances). So the formula simplifies to:

```
expected_qty = ready_balance - theoretical_out
```

We do NOT add `dpo_in_qty` separately because it's already reflected in `ready_balance`. The `dpo_in_qty` field on the line is stored for **display purposes only** (showing the user how much came in today).


## 7. Service Layer Design

### 7.1 Key Methods

```typescript
class DailyStockOpnameService {
  // ─── SESSION CRUD ───────────────────────────────────────────
  async create(branchIds: string[], dto: CreateOpnameDto, userId: string): Promise<DailyClosingCountDetail>
  async getById(id: string, branchIds: string[]): Promise<DailyClosingCountDetail>
  async list(branchIds: string[], pagination, filter?, search?): Promise<PaginatedResult>
  async cancel(id: string, branchIds: string[], userId: string): Promise<void>

  // ─── LINE UPDATES ──────────────────────────────────────────
  async updateLine(sessionId: string, lineId: string, branchIds: string[], dto: UpdateLineDto, userId: string): Promise<DailyClosingCountLine>
  async bulkUpdateLines(sessionId: string, branchIds: string[], dto: BulkUpdateLinesDto, userId: string): Promise<DailyClosingCountLine[]>
  async uploadPhoto(sessionId: string, lineId: string, branchIds: string[], file: Buffer, fileName: string, contentType: string, userId: string): Promise<{ photo_url: string }>

  // ─── ACTIONS ────────────────────────────────────────────────
  async confirm(id: string, branchIds: string[], userId: string): Promise<DailyClosingCountDetail>
  async resolve(id: string, branchIds: string[], dto: ResolveOpnameDto, userId: string): Promise<DailyClosingCountDetail>

  // ─── CONFIG ─────────────────────────────────────────────────
  async getConfig(branchId: string): Promise<BranchOpnameConfig>
  async upsertConfig(branchId: string, companyId: string, dto: UpsertOpnameConfigDto, userId: string): Promise<BranchOpnameConfig>

  // ─── REPORTS & DASHBOARD ────────────────────────────────────
  async getDashboard(branchIds: string[]): Promise<OpnameDashboardItem[]>
  async getVarianceReport(branchIds: string[], filter: VarianceReportFilter): Promise<VarianceReportItem[]>
  async exportVarianceReport(branchIds: string[], filter: VarianceReportFilter): Promise<Buffer>

  // ─── INTERNAL HELPERS ───────────────────────────────────────
  private async calculateExpectedBalances(warehouseId: string, branchId: string, date: string): Promise<ExpectedBalanceLine[]>
  private async getTheoreticalConsumptionForDate(branchId: string, date: string): Promise<Map<string, number>>
  private async validateTimeRestriction(branchId: string, action: 'create' | 'edit' | 'confirm'): Promise<void>
  private isSessionExpired(session: DailyClosingCount): boolean
}
```

### 7.2 Integration with DPO Module

Add a check in `DailyPrepOrdersService.confirm()`:

```typescript
// In daily-prep-orders.service.ts → confirm()
// Before processing, check if opname already confirmed for this date+branch
const opnameExists = await dailyStockOpnameRepository.hasConfirmedSession(
  detail.branch_id,
  todayJakarta()
)
if (opnameExists) {
  throw new DpoBlockedByOpnameError()
}
```


## 8. Repository Layer Design

### 8.1 Key Queries

```typescript
class DailyStockOpnameRepository {
  // Transaction wrapper (same pattern as stockRepository)
  async withTransaction<T>(op: (client: PoolClient) => Promise<T>): Promise<T>

  // ─── HEADER ─────────────────────────────────────────────────
  async findAll(branchIds: string[], pagination, filter?, search?): Promise<{ data; total }>
  async findByIdAccessible(id: string, branchIds: string[]): Promise<DailyClosingCountDetail | null>
  async findByBranchAndDate(branchId: string, date: string): Promise<DailyClosingCount | null>
  async hasConfirmedSession(branchId: string, date: string): Promise<boolean>
  async insertHeader(client: PoolClient, data): Promise<DailyClosingCount>
  async updateHeaderStatus(client: PoolClient, id: string, data): Promise<void>
  async softDelete(id: string, userId: string): Promise<boolean>

  // ─── LINES ──────────────────────────────────────────────────
  async insertLines(client: PoolClient, closingId: string, lines: InsertLineData[]): Promise<void>
  async updateLineActual(id: string, closingId: string, actual_qty: number): Promise<DailyClosingCountLine>
  async updateLinePhoto(id: string, closingId: string, photo_url: string): Promise<void>
  async updateLineMovements(client: PoolClient, id: string, data: { out_movement_id?; in_movement_id?; variance_qty; variance_pct; variance_cost }): Promise<void>
  async getLineById(id: string, closingId: string): Promise<DailyClosingCountLine | null>

  // ─── EXPECTED BALANCE HELPERS ───────────────────────────────
  async getReadyBalances(warehouseId: string): Promise<Map<string, { qty: number; avg_cost: number }>>
  async getDpoTransfersForDate(warehouseId: string, date: string): Promise<Map<string, number>>
  async getMainBalances(mainWarehouseId: string): Promise<Map<string, number>>
  async getProductsWithStock(warehouseId: string): Promise<ProductStockInfo[]>
  async getLastMovementCost(warehouseId: string, productId: string): Promise<number>

  // ─── CONFIG ─────────────────────────────────────────────────
  async findConfig(branchId: string): Promise<BranchOpnameConfig | null>
  async upsertConfig(branchId: string, companyId: string, data, userId: string): Promise<BranchOpnameConfig>

  // ─── DASHBOARD ──────────────────────────────────────────────
  async getDashboardData(branchIds: string[], today: string): Promise<OpnameDashboardItem[]>

  // ─── VARIANCE REPORT ────────────────────────────────────────
  async getVarianceReport(branchIds: string[], filter: VarianceReportFilter): Promise<VarianceReportItem[]>
}
```

### 8.2 Theoretical Consumption Integration

The opname service will call the existing `theoreticalConsumptionRepository.getTheoreticalConsumption()` method with `periodStart = periodEnd = closingDate` and the branch's POS ID. This returns per-product theoretical quantities which are used in the expected balance calculation.

```typescript
// In service.createSession():
const branchPosId = await theoreticalConsumptionRepository.resolveBranchIds(branchId)
const theoreticalItems = await theoreticalConsumptionRepository.getTheoreticalConsumption(
  closingDate, closingDate, branchPosId.branchPosId
)
// Convert to Map<product_id, theoretical_qty>
const theoreticalMap = new Map(theoreticalItems.map(i => [i.product_id, i.theoretical_qty]))
```


## 9. Validation Schemas (`daily-stock-opname.schema.ts`)

```typescript
import { z } from 'zod'

export const createOpnameSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    notes: z.string().max(500).optional(),
  }),
})

export const updateLineSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    lineId: z.string().uuid(),
  }),
  body: z.object({
    actual_qty: z.number().min(0),
  }),
})

export const bulkUpdateLinesSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    lines: z.array(z.object({
      line_id: z.string().uuid(),
      actual_qty: z.number().min(0),
    })).min(1).max(500),
  }),
})

export const resolveSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    resolution_note: z.string().min(10).max(1000),
  }),
})

export const configSchema = z.object({
  params: z.object({ branchId: z.string().uuid() }),
  body: z.object({
    variance_threshold_pct: z.number().min(1).max(100).optional(),
    closing_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    grace_period_minutes: z.number().min(0).max(60).optional(),
  }),
})

export const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    branch_id: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'CONFIRMED', 'FLAGGED', 'MISSED', '']).optional(),
    search: z.string().optional(),
  }),
})

export const varianceReportSchema = z.object({
  query: z.object({
    date_from: z.string(),
    date_to: z.string(),
    branch_id: z.string().uuid().optional(),
    product_id: z.string().uuid().optional(),
    risk_category: z.enum(['HIGH', 'MEDIUM', 'LOW', '']).optional(),
    group_by: z.enum(['day', 'week', 'month']).default('day'),
  }),
})
```

## 10. Frontend Pages Design

### 10.1 Opname List Page (`DailyStockOpnamePage.tsx`)

**Route:** `/daily-stock-opname`

**Features:**
- Filter by date range, branch, status (using `useUrlFilters`)
- Search by PIC name
- Table columns: Date, Branch, PIC, Status (badge), Items (completed/total), Variance Cost, Actions
- "Mulai Opname" button (creates new session for today)
- Status badges: DRAFT (yellow), CONFIRMED (green), FLAGGED (red), MISSED (gray)
- Click row → navigate to detail page

### 10.2 Opname Detail Page (`DailyStockOpnameDetailPage.tsx`)

**Route:** `/daily-stock-opname/:id`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Branch | Date | PIC | Status Badge                  │
│ Summary Cards: Expected Cost | Actual Cost | Variance | %   │
├─────────────────────────────────────────────────────────────┤
│ Progress Bar: 45/60 items completed                         │
├─────────────────────────────────────────────────────────────┤
│ Filter: [Search product] [High Risk Only] [Has Variance]    │
├─────────────────────────────────────────────────────────────┤
│ Table:                                                      │
│ ┌─────┬──────┬────────┬────────┬────────┬────────┬───────┐ │
│ │Code │Name  │Expected│Actual  │Variance│Var %   │Photo  │ │
│ │     │      │(system)│(input) │        │        │       │ │
│ ├─────┼──────┼────────┼────────┼────────┼────────┼───────┤ │
│ │SAL01│Salmon│ 5.2 kg │[___]kg │ -0.3   │ -5.8%  │ 📷   │ │
│ │WAG01│Wagyu │ 3.0 kg │[___]kg │        │        │ 📷!  │ │
│ │UDG01│Udang │ 8.5 kg │[8.2]kg│ -0.3   │ -3.5%  │ ✅   │ │
│ └─────┴──────┴────────┴────────┴────────┴────────┴───────┘ │
│                                                             │
│ Side info per row: MAIN balance: 12.5 kg                    │
├─────────────────────────────────────────────────────────────┤
│ [Batalkan]                              [Konfirmasi Opname] │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- DRAFT: editable inputs, photo upload enabled, confirm/cancel buttons
- CONFIRMED/FLAGGED: read-only, resolve button (for FLAGGED, manager only)
- Auto-calculate variance on input change (client-side)
- Highlight rows exceeding threshold in red/orange
- Show "⚠️ No recipe" indicator for products without recipe coverage
- Show MAIN balance as tooltip or side column


### 10.3 Variance Report Page (`OpnameVarianceReportPage.tsx`)

**Route:** `/daily-stock-opname/variance-report`

**Features:**
- Date range picker, branch filter, risk category filter
- Group by: day / week / month toggle
- Table: Product, Total Variance Qty, Total Variance Cost, Avg Variance %, Sessions, Flagged Count
- Sort by any column
- Export CSV button
- Chart: variance trend over time (optional, phase 2)

### 10.4 Dashboard Widget (`DashboardWidget.tsx`)

**Location:** Embedded in main dashboard page

**Layout:**
```
┌─────────────────────────────────────────┐
│ 📋 Stock Opname Hari Ini                │
├─────────────────────────────────────────┤
│ Cabang A    ✅ Confirmed   Var: Rp 25k  │
│ Cabang B    🟡 In Progress  45/60       │
│ Cabang C    ⚠️ Flagged     Var: Rp 180k │
│ Cabang D    ⬜ Not Started              │
│ Cabang E    🔴 Missed (yesterday)       │
└─────────────────────────────────────────┘
```

### 10.5 URL Filter Config (`opnameFilters.url.ts`)

```typescript
import {
  parsePositiveInt, parseEnum, parseString,
  serializeString, serializeNumber, mergeWithPageReset,
  type UrlFilterBase, type UrlFilterUtils,
} from '@/lib/urlFilters'

type OpnameListStatus = 'DRAFT' | 'CONFIRMED' | 'FLAGGED' | 'MISSED' | ''
const VALID_STATUSES = new Set<OpnameListStatus>(['DRAFT', 'CONFIRMED', 'FLAGGED', 'MISSED', ''])

export type OpnameFilters = UrlFilterBase & {
  status: OpnameListStatus
  branch_id: string
  date_from: string
  date_to: string
  search: string
}

export const OPNAME_FILTER_DEFAULTS: OpnameFilters = {
  page: 1, limit: 25,
  status: '', branch_id: '', date_from: '', date_to: '', search: '',
}

export const opnameFilterConfig: UrlFilterUtils<OpnameFilters> = {
  defaults: OPNAME_FILTER_DEFAULTS,
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
    mergeWithPageReset(current, patch, OPNAME_FILTER_DEFAULTS, ['status', 'branch_id', 'date_from', 'date_to', 'search']),
}
```


## 11. Integration Points

### 11.1 Modules That This Feature Depends On

| Module | Usage |
|--------|-------|
| `stock` | `stockRepository.withTransaction()`, `createMovement()`, `upsertBalance()`, `getBalanceForUpdate()` |
| `theoretical-consumption` | `getTheoreticalConsumption()` for expected balance calculation |
| `warehouses` | Resolve MAIN/READY warehouse IDs per branch |
| `monitoring` (AuditService) | Audit logging for all operations |
| `storage.service` | Photo upload to R2/S3 |
| `products` | Product info, `risk_category` column |

### 11.2 Modules That Need Changes

| Module | Change |
|--------|--------|
| `stock/stock.types.ts` | Add `'daily_closing_count'` to `ReferenceType` |
| `daily-prep-orders` | Add opname blocking check in `confirm()` method |
| `App.tsx` (frontend) | Add routes for opname pages |
| Dashboard page (frontend) | Add opname widget |

### 11.3 Permission Model

New permission module: `daily_stock_opname`

| Permission | Who |
|-----------|-----|
| `daily_stock_opname.view` | All branch staff |
| `daily_stock_opname.create` | Kitchen PIC, Manager |
| `daily_stock_opname.update` | Kitchen PIC (own session), Manager |
| `daily_stock_opname.confirm` | Kitchen PIC, Manager |
| `daily_stock_opname.resolve` | Manager only |
| `daily_stock_opname.config` | Manager, Admin |
| `daily_stock_opname.report` | Manager, Owner |

## Error Handling

```typescript
// daily-stock-opname.errors.ts
export class OpnameNotFoundError extends AppError { ... }
export class OpnameDuplicateError extends AppError { ... }        // same branch+date
export class OpnameNotDraftError extends AppError { ... }
export class OpnameNotFlaggedError extends AppError { ... }
export class OpnameTimeExpiredError extends AppError { ... }      // past closing time
export class OpnameBackdateError extends AppError { ... }         // trying to create for past date
export class OpnameIncompleteError extends AppError { ... }       // not all lines filled
export class OpnamePhotoRequiredError extends AppError { ... }    // high-risk without photo
export class OpnameSessionExpiredError extends AppError { ... }   // DRAFT from previous day
export class DpoBlockedByOpnameError extends AppError { ... }    // DPO blocked (in DPO module)
```

## 13. Photo Upload Design

**Storage path:** `{companyId}/opname/{year}/{month}/{sessionId}/{lineId}_{timestamp}.{ext}`

**Flow:**
1. Frontend sends multipart/form-data to `POST /api/v1/daily-stock-opname/:id/lines/:lineId/photo`
2. Controller uses Multer middleware (memory storage, 10MB limit, JPEG/PNG only)
3. Service calls `storageService.uploadToPath(file, path, contentType, 'buktisetoran')`
4. Public URL stored on line record
5. Old photo deleted if replacing

## 14. Time Zone Handling

All date/time logic uses `Asia/Jakarta` (UTC+7):

```typescript
// Utility function
function nowJakarta(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
}

function todayJakarta(): string {
  return nowJakarta().toISOString().split('T')[0]
}

function currentTimeJakarta(): string {
  return nowJakarta().toTimeString().slice(0, 5) // "HH:mm"
}

function isWithinClosingTime(closingTime: string, graceMinutes: number): boolean {
  const now = nowJakarta()
  const [h, m] = closingTime.split(':').map(Number)
  const deadline = new Date(now)
  deadline.setHours(h, m + graceMinutes, 0, 0)
  return now <= deadline
}
```


## 15. Migration File

File: `backend/database/migrations/20260530000000_daily_stock_opname.sql`

Contains:
1. `CREATE TABLE branch_opname_config`
2. `CREATE TABLE daily_closing_counts` with unique index
3. `CREATE TABLE daily_closing_count_lines` with indexes
4. Seed default config for existing branches (variance_threshold_pct = 15, closing_time = '23:59')

## 16. Routes Registration

In `backend/src/app.ts`:

```typescript
import { dailyStockOpnameRoutes } from './modules/daily-stock-opname/daily-stock-opname.routes'
// ...
app.use('/api/v1/daily-stock-opname', authenticate, dailyStockOpnameRoutes)
```

In `frontend/src/App.tsx`:

```typescript
const DailyStockOpnamePage = lazy(() => import('./features/daily-stock-opname/pages/DailyStockOpnamePage'))
const DailyStockOpnameDetailPage = lazy(() => import('./features/daily-stock-opname/pages/DailyStockOpnameDetailPage'))
const OpnameVarianceReportPage = lazy(() => import('./features/daily-stock-opname/pages/OpnameVarianceReportPage'))

// Inside routes:
<Route path="daily-stock-opname" element={<RequirePermission module="daily_stock_opname" action="view"><DailyStockOpnamePage /></RequirePermission>} />
<Route path="daily-stock-opname/:id" element={<RequirePermission module="daily_stock_opname" action="view"><DailyStockOpnameDetailPage /></RequirePermission>} />
<Route path="daily-stock-opname/variance-report" element={<RequirePermission module="daily_stock_opname" action="report"><OpnameVarianceReportPage /></RequirePermission>} />
```

## Correctness Properties

### Property 1: Transaction Atomicity
All stock movements during confirmation execute in a single database transaction. If any movement or balance update fails, the entire transaction rolls back and the session remains in DRAFT status.
**Validates: Requirements 16.3, 16.4**

### Property 2: Session Uniqueness
Database-level unique index on (branch_id, closing_date) WHERE deleted_at IS NULL prevents duplicate sessions. Application-level check provides user-friendly error message before hitting the constraint.
**Validates: Requirements 1.2, 1.3**

### Property 3: Snapshot Consistency
Expected balance, cost_per_unit, and MAIN balance are snapshotted at session creation time and stored on line records. These values never change regardless of subsequent stock movements or DPO confirmations.
**Validates: Requirements 2.6, 3.5**

### Property 4: Time Zone Consistency
All date/time comparisons throughout the feature use Asia/Jakarta timezone (UTC+7). No mixing of UTC and local time.
**Validates: Requirements 2.7, 6.5**

### Property 5: Balance Integrity
After confirmation, stock_balances for ALL products in the READY warehouse reflect the actual counted quantities, including lines where variance is zero. This ensures the ledger matches physical reality.
**Validates: Requirements 5.5**

### Property 6: Idempotency
Confirming an already-confirmed session returns an error (OpnameNotDraftError). Stock movements are never duplicated.
**Validates: Requirements 5.1**

## Testing Strategy

### Unit Tests
- Service: `calculateExpectedBalances()` with various scenarios (no stock, no recipe, negative expected)
- Service: `validateTimeRestriction()` with edge cases around closing time + grace period
- Service: `confirm()` variance threshold logic (CONFIRMED vs FLAGGED)

### Integration Tests
- Create session → verify lines populated correctly from stock_balances + theoretical consumption
- Confirm session → verify stock_movements created with correct types and quantities
- Confirm session → verify stock_balances updated to actual quantities
- DPO blocking → verify DPO confirm fails when opname already confirmed
- Time restriction → verify creation/editing blocked after closing time

### E2E Tests
- Full flow: create → input quantities → upload photo → confirm → verify stock updated
- Flagged flow: create → input with high variance → confirm → resolve

## Implementation Order

| Phase | Tasks | Dependencies |
|-------|-------|-------------|
| 1 | Migration + types + repository | None |
| 2 | Service (create, calculate expected) | Phase 1 |
| 3 | Service (update lines, confirm with stock movements) | Phase 2 |
| 4 | Controller + routes + schema validation | Phase 3 |
| 5 | DPO blocking integration | Phase 4 |
| 6 | Frontend: List page | Phase 4 |
| 7 | Frontend: Detail/Input page | Phase 4 |
| 8 | Config endpoints + UI | Phase 4 |
| 9 | Photo upload | Phase 7 |
| 10 | Resolve flagged flow | Phase 7 |
| 11 | Dashboard widget | Phase 6 |
| 12 | Variance report + CSV export | Phase 6 |

---

*Design created: 30 Mei 2026*
*Based on requirements: `.kiro/specs/daily-stock-opname/requirements.md`*
