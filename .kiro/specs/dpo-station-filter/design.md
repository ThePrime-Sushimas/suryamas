# Design Document: DPO Station Filter

## Overview

This feature adds a mandatory station filter to the DPO generation flow. The filter ensures only products belonging to selected stations appear in the forecast, and the selected station codes are persisted on the DPO header for traceability.

## Architecture

The implementation follows the existing module pattern with changes across the full stack:
- **Backend**: Extend `GenerateDpoDto` and Zod schema, add `station_codes` column to `daily_prep_orders`, modify `calcForecastLines` SQL query
- **Frontend**: Add multi-select dropdown to `DpoGenerateModal` using existing `usePositions` hook

## Components and Interfaces

### Backend Components

#### 1. Database Migration

Add `station_codes` column to the `daily_prep_orders` table.

```sql
-- Migration: Add station_codes to daily_prep_orders
ALTER TABLE daily_prep_orders
  ADD COLUMN station_codes TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN daily_prep_orders.station_codes IS 'Position codes selected during DPO generation for station filtering';
```

#### 2. Schema Extension (`daily-prep-orders.schema.ts`)

Extend `generateDpoSchema` to include `station_codes` validation:

```typescript
export const generateDpoSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    prep_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source_warehouse_id: z.string().uuid(),
    target_warehouse_id: z.string().uuid(),
    station_codes: z.array(z.string().min(1)).min(1, 'Minimal 1 station harus dipilih'),
    notes: z.string().nullable().optional(),
  })
})
```

#### 3. DTO Extension (`daily-prep-orders.types.ts`)

Add `station_codes` to `GenerateDpoDto`:

```typescript
export interface GenerateDpoDto {
  branch_id: string
  prep_date: string
  source_warehouse_id: string
  target_warehouse_id: string
  station_codes: string[]       // NEW: position_code values for filtering
  notes?: string | null
  created_by?: string
}
```

Add `station_codes` to `DailyPrepOrder` interface:

```typescript
export interface DailyPrepOrder {
  // ... existing fields ...
  station_codes: string[]       // NEW: stored station filter
}
```

#### 4. Repository Changes (`daily-prep-orders.repository.ts`)

**4a. `calcForecastLines` — Add station filter parameter**

Add a `stationCodes: string[]` parameter and inject a WHERE clause filtering products by their `station` (position_code) field. The filter is applied by joining `products` in the `daily_direct` and `daily_wip` CTEs and adding:

```sql
AND p.station = ANY($7::text[])
```

The parameter `$7` is the `station_codes` array. This ensures only products assigned to the selected stations contribute to the forecast calculation.

The `all_products` CTE also needs the filter:

```sql
all_products AS (
  SELECT DISTINCT product_id, product_name, product_code, uom
  FROM daily_total
  ORDER BY product_id
)
```

Since `daily_total` is derived from `daily_direct` and `daily_wip` which already filter by station, `all_products` is implicitly filtered.

**However**, products with sales history but NULL/empty station will be excluded because `NULL = ANY('{...}')` evaluates to NULL (falsy) in PostgreSQL.

**4b. `createWithLines` — Store station_codes on DPO header**

Add `station_codes` to the INSERT statement:

```typescript
const { rows: [dpo] } = await client.query(
  `INSERT INTO daily_prep_orders
     (company_id, branch_id, dpo_number, prep_date, status,
      source_warehouse_id, target_warehouse_id,
      station_codes,
      weight_7d, weight_30d, weight_dow, coverage_days,
      holiday_factor_applied, has_upcoming_holiday,
      notes, created_by, updated_by)
   VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
   RETURNING *`,
  [
    companyId, dto.branch_id, dpoNumber, dto.prep_date,
    dto.source_warehouse_id, dto.target_warehouse_id,
    dto.station_codes,
    config.weight_7d, config.weight_30d, config.weight_dow, config.coverage_days,
    config.holiday_factor_applied, config.has_upcoming_holiday,
    dto.notes ?? null, dto.created_by ?? null
  ]
)
```

#### 5. Service Changes (`daily-prep-orders.service.ts`)

Pass `dto.station_codes` to `calcForecastLines`:

```typescript
const rawLines = await dailyPrepOrdersRepository.calcForecastLines(
  branchPosId, dto.branch_id, dto.prep_date, config,
  dto.source_warehouse_id, dto.target_warehouse_id,
  dto.station_codes  // NEW parameter
)
```

### Frontend Components

#### 1. Multi-Select Station Dropdown in `DpoGenerateModal`

Add state and UI for station selection:

```typescript
import { usePositions } from '@/features/settings/api/settings.api'

// Inside DpoGenerateModal component:
const { data: positions = [] } = usePositions()
const [stationCodes, setStationCodes] = useState<string[]>([])

// Filter to only active positions
const activePositions = positions.filter(p => p.is_active)
```

The multi-select renders as a dropdown with checkboxes. Selected stations display as removable chips/tags. The last remaining station cannot be deselected (enforced in the toggle handler).

#### 2. Validation in `handleGenerate`

Add station validation before API call:

```typescript
if (stationCodes.length === 0) {
  toast.error('Pilih minimal 1 station')
  return
}
```

#### 3. API Call Extension

Include `station_codes` in the generate request body:

```typescript
const result = await generateDpo.mutateAsync({
  branch_id: branchId,
  prep_date: prepDate,
  source_warehouse_id: sourceWarehouseId,
  target_warehouse_id: targetWarehouseId,
  station_codes: stationCodes,  // NEW
  notes: notes || null,
})
```

#### 4. DPO Detail View

Display stored `station_codes` in the DPO detail header section. Map codes to position names using the positions data:

```typescript
// In DPO detail component
const stationNames = dpo.station_codes
  .map(code => positions.find(p => p.position_code === code)?.position_name ?? code)
  .join(', ')
```

## Data Models

### Database Schema Change

```
daily_prep_orders
├── ... (existing columns)
└── station_codes TEXT[] NOT NULL DEFAULT '{}'   ← NEW
```

### Updated TypeScript Interfaces

```typescript
// GenerateDpoDto (request)
{
  branch_id: string
  prep_date: string
  source_warehouse_id: string
  target_warehouse_id: string
  station_codes: string[]    // NEW - array of position_code values
  notes?: string | null
  created_by?: string
}

// DailyPrepOrder (response/DB row)
{
  // ... existing fields
  station_codes: string[]    // NEW - persisted filter
}
```

## Interfaces

### API Contract Change

**POST /api/v1/daily-prep-orders/generate**

Request body (updated):
```json
{
  "branch_id": "uuid",
  "prep_date": "2025-01-15",
  "source_warehouse_id": "uuid",
  "target_warehouse_id": "uuid",
  "station_codes": ["GRILL", "FRYER"],
  "notes": "optional"
}
```

Validation rules:
- `station_codes`: required, array, min length 1, each element must be a non-empty string

Error response (400) when validation fails:
```json
{
  "success": false,
  "error": "Validation error",
  "validation_errors": [
    { "path": "station_codes", "message": "Minimal 1 station harus dipilih" }
  ]
}
```

## Error Handling

| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| `station_codes` missing or empty array | 400 | "Minimal 1 station harus dipilih" |
| `station_codes` contains empty string | 400 | Zod validation error for min(1) on array element |
| No products match selected stations | 200 | DPO created with 0 relevant lines (existing behavior handles empty forecast) |

## Testing Strategy

- **Unit tests**: Validate Zod schema accepts/rejects correct inputs, verify station filter logic with mock data
- **Property tests**: Validate universal properties (schema validation, filter correctness, persistence round-trip) across generated inputs
- **Integration tests**: Verify SQL-level filtering in `calcForecastLines` with real database, end-to-end DPO generation with station filter

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Station codes validation accepts valid inputs and rejects invalid

*For any* array of one or more non-empty strings, the `generateDpoSchema` Zod schema SHALL accept the `station_codes` field. *For any* empty array, missing field, or array containing empty strings, the schema SHALL reject with a validation error.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 2: Station filter returns exactly matching products

*For any* set of products with assigned stations and *for any* non-empty subset of station codes, the forecast filter SHALL return exactly those products whose `station` field is contained in the provided `station_codes` — no products with non-matching stations, NULL stations, or empty stations shall appear in the result.

**Validates: Requirements 4.1, 4.2, 6.1**

### Property 3: Station codes persistence round-trip

*For any* valid DPO generation with a given `station_codes` array, reading the created DPO header record SHALL return the same `station_codes` array that was provided during generation.

**Validates: Requirements 5.1**
