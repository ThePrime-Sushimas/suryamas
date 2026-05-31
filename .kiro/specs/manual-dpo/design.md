# Design Document: Manual DPO

## Overview

Manual DPO extends the existing Daily Prep Order module by adding a new creation path that bypasses forecast calculation. The user directly specifies products and quantities. The resulting DPO record is stored in the same `daily_prep_orders` / `daily_prep_order_lines` tables and follows the identical confirm flow (lock → confirm → stock movements).

## Architecture

### Key Architectural Decisions

1. **No new tables** — Manual DPOs reuse `daily_prep_orders` with forecast columns zeroed out.
2. **Single endpoint** — `POST /api/v1/daily-prep-orders/manual` creates header + lines atomically.
3. **Reuse confirm/edit/cancel** — Existing `confirm()`, `updateLines()`, `deleteLine()`, `softDelete()` methods work unchanged.
4. **Frontend full-page form** — A dedicated `CreateManualDpoPage` with product search and line management.

## Components and Interfaces

### Backend Components

```
backend/src/modules/daily-prep-orders/
├── daily-prep-orders.controller.ts   # + createManual handler
├── daily-prep-orders.service.ts      # + createManual() method
├── daily-prep-orders.repository.ts   # + createManualWithLines() method
├── daily-prep-orders.schema.ts       # + createManualDpoSchema
├── daily-prep-orders.types.ts        # + CreateManualDpoDto
├── daily-prep-orders.routes.ts       # + POST /manual route
└── daily-prep-orders.errors.ts       # (no changes)
```

### Frontend Components

```
frontend/src/features/daily-prep-orders2/
├── api/dailyPrepOrders.api.ts        # + useCreateManualDpo mutation
├── pages/
│   ├── DailyPrepOrdersPage.tsx       # + "Manual DPO" button
│   └── CreateManualDpoPage.tsx       # NEW — full-page creation form
└── components/
    └── ProductSearchInput.tsx         # NEW — product search with station filter
```

### Interfaces

#### CreateManualDpoDto

```typescript
// backend/src/modules/daily-prep-orders/daily-prep-orders.types.ts

export interface CreateManualDpoDto {
  branch_id: string
  prep_date: string                    // YYYY-MM-DD
  source_warehouse_id: string
  target_warehouse_id: string
  station_codes?: string[]             // optional station filter (informational)
  notes?: string | null
  lines: {
    product_id: string
    qty: number                        // becomes confirmed_qty
  }[]
  created_by?: string
}
```

### New Zod Schema: createManualDpoSchema

```typescript
// backend/src/modules/daily-prep-orders/daily-prep-orders.schema.ts

export const createManualDpoSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    prep_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source_warehouse_id: z.string().uuid(),
    target_warehouse_id: z.string().uuid(),
    station_codes: z.array(z.string().min(1)).optional(),
    notes: z.string().nullable().optional(),
    lines: z.array(z.object({
      product_id: z.string().uuid(),
      qty: z.number().gt(0, 'Qty harus lebih dari 0'),
    })).min(1, 'Minimal 1 produk harus ditambahkan'),
  })
})
```

### New API Endpoint

```
POST /api/v1/daily-prep-orders/manual
Authorization: Bearer {token}
Permission: daily_prep_orders.insert

Request Body:
{
  "branch_id": "uuid",
  "prep_date": "2025-06-15",
  "source_warehouse_id": "uuid",
  "target_warehouse_id": "uuid",
  "station_codes": ["KITCHEN", "BAR"],   // optional
  "notes": "Manual order for event",     // optional
  "lines": [
    { "product_id": "uuid", "qty": 10 },
    { "product_id": "uuid", "qty": 5 }
  ]
}

Response 201:
{
  "success": true,
  "message": "Manual DPO created",
  "data": { /* DailyPrepOrderDetail */ }
}
```

### Frontend API Hook

```typescript
// frontend/src/features/daily-prep-orders2/api/dailyPrepOrders.api.ts

export const useCreateManualDpo = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      branch_id: string
      prep_date: string
      source_warehouse_id: string
      target_warehouse_id: string
      station_codes?: string[]
      notes?: string | null
      lines: { product_id: string; qty: number }[]
    }) => {
      const { data } = await api.post('/daily-prep-orders/manual', body)
      return data.data as DailyPrepOrder
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-prep-orders'] }),
  })
}
```

## Data Models

No new tables. Manual DPOs are stored in the existing schema with forecast columns set to zero/default:

### Header (`daily_prep_orders`)

| Column | Manual DPO Value |
|--------|-----------------|
| status | `'DRAFT'` |
| weight_7d | `0` |
| weight_30d | `0` |
| weight_dow | `0` |
| coverage_days | `0` |
| holiday_factor_applied | `0` |
| has_upcoming_holiday | `false` |
| station_codes | User-provided or `[]` |
| notes | User-provided or `null` |

### Lines (`daily_prep_order_lines`)

| Column | Manual DPO Value |
|--------|-----------------|
| avg_sales_7d | `0` |
| avg_sales_30d | `0` |
| avg_sales_dow | `0` |
| holiday_factor | `0` |
| coverage_days | `0` |
| predicted_need | `0` |
| suggested_qty | `0` |
| confirmed_qty | User-specified `qty` |
| current_ready_stock | Live stock snapshot at creation |
| current_main_stock | Live stock snapshot at creation |

## Service Logic: `createManual()`

```typescript
// Pseudocode for DailyPrepOrdersService.createManual()

async createManual(branchIds: string[], dto: CreateManualDpoDto) {
  // 1. Branch access check
  requireBranchAccess(dto.branch_id, branchIds)
  const companyId = await getCompanyIdForBranch(dto.branch_id)

  // 2. Transaction
  return stockRepository.withTransaction(async (client) => {
    // 3. Get branch code for DPO number
    const branchCode = await repository.getBranchCode(client, dto.branch_id)

    // 4. Generate DPO number (same sequence as forecast DPOs)
    const dpoNumber = await repository.generateDpoNumber(
      client, companyId, branchCode, dto.prep_date
    )

    // 5. Snapshot live stock for each product
    const stockSnapshots = await repository.getStockSnapshots(
      client, dto.lines.map(l => l.product_id),
      dto.source_warehouse_id, dto.target_warehouse_id
    )

    // 6. Insert header with forecast columns zeroed
    // 7. Insert lines with confirmed_qty = dto.qty, forecast columns = 0,
    //    stock columns = live snapshot
    const dpo = await repository.createManualWithLines(
      client, companyId, dto, dpoNumber, stockSnapshots
    )

    // 8. Audit log
    await AuditService.log('CREATE', 'daily_prep_orders', dpo.id, ...)

    return dpo.id
  })

  // 9. Fetch and return full detail
  return this.fetchDetailAfterGenerate(newDpoId, companyId)
}
```

## Frontend: CreateManualDpoPage

### Page Structure

```
┌─────────────────────────────────────────────────┐
│ ← Back    Create Manual DPO         [Submit]    │
├─────────────────────────────────────────────────┤
│ Header Section                                  │
│ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│ │ Branch ▼    │ │ Prep Date   │ │ Notes     │  │
│ └─────────────┘ └─────────────┘ └───────────┘  │
│ ┌─────────────┐ ┌─────────────┐                │
│ │ Source WH ▼ │ │ Target WH ▼ │                │
│ └─────────────┘ └─────────────┘                │
├─────────────────────────────────────────────────┤
│ Product Lines                                   │
│ ┌───────────────────────────────────────────┐   │
│ │ 🔍 Search product...  │ Station filter ▼ │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Product Name    Code    Qty    [🗑]         │ │
│ │ Ayam Fillet     AYM01   10     [🗑]         │ │
│ │ Tepung Roti     TPR01   5      [🗑]         │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Form State Management

The form uses React Hook Form for header fields and local state for the dynamic lines array. Product search uses a debounced input that queries the existing products API filtered by station codes.

### Product Search

Reuses the existing products API (`GET /api/v1/products`) with query parameters:
- `search`: product name or code
- `station`: optional station code filter
- `limit`: 10 results for autocomplete

## Error Handling

| Error Condition | Error Class | HTTP Status |
|----------------|-------------|-------------|
| Missing required fields | Zod validation | 400 |
| Lines array empty | Zod validation | 400 |
| Line qty ≤ 0 | Zod validation | 400 |
| Branch not accessible | `ForbiddenError` | 403 |
| Branch not found | `NotFoundError` | 404 |
| Duplicate product in lines | `BusinessRuleError` | 422 |

No new error classes needed — existing error infrastructure handles all cases.

## Testing Strategy

### Unit Tests (Example-based)
- Header form validation: missing fields produce correct error messages
- Permission-based button visibility on the list page
- Product line add/remove UI interactions
- Confirm flow works identically for manual DPOs (reuses existing tests)

### Property Tests
- Validation schema rejects all invalid inputs (non-positive qty, missing required fields)
- Product search correctness (results match query, station filter applied)
- Data integrity of created manual DPOs (forecast columns zeroed, quantities preserved, stock snapshots correct)
- Branch access enforcement across all branch/user combinations
- DPO number format consistency

### Integration Tests
- End-to-end creation → confirm flow with real database
- Stock movement creation on confirm (reuses existing confirm integration tests)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Header validation rejects incomplete submissions

*For any* subset of required header fields (branch_id, prep_date, source_warehouse_id, target_warehouse_id) that is missing at least one field, the createManual endpoint SHALL reject the request with a validation error identifying the missing fields.

**Validates: Requirements 2.6**

### Property 2: Line quantity validation rejects non-positive values

*For any* numeric value less than or equal to zero provided as a line qty, the createManual endpoint SHALL reject the request with a validation error for that line.

**Validates: Requirements 3.5**

### Property 3: Product search returns only matching results

*For any* product list and search query string, all products returned by the search SHALL contain the query string (case-insensitive) in either the product_name or product_code field.

**Validates: Requirements 3.2**

### Property 4: Station filter restricts search results

*For any* product list and set of selected station_codes, all products returned by the filtered search SHALL have a station value matching one of the selected station_codes. When no station_codes are selected, all products SHALL be returned regardless of station.

**Validates: Requirements 4.2, 4.3**

### Property 5: Manual DPO creation zeroes forecast columns

*For any* valid CreateManualDpoDto, the resulting DPO record SHALL have weight_7d = 0, weight_30d = 0, weight_dow = 0, coverage_days = 0, holiday_factor_applied = 0, and has_upcoming_holiday = false. Additionally, all lines SHALL have avg_sales_7d = 0, avg_sales_30d = 0, avg_sales_dow = 0, predicted_need = 0, and suggested_qty = 0.

**Validates: Requirements 5.3, 5.4, 5.6**

### Property 6: Manual DPO preserves user-specified quantities

*For any* valid CreateManualDpoDto with N lines, the resulting DPO SHALL have exactly N lines, and each line's confirmed_qty SHALL equal the corresponding input line's qty value.

**Validates: Requirements 5.5**

### Property 7: Manual DPO snapshots live stock at creation time

*For any* created manual DPO line, the stored current_ready_stock SHALL equal the stock balance in the target warehouse for that product at creation time, and current_main_stock SHALL equal the stock balance in the source warehouse for that product at creation time.

**Validates: Requirements 5.7**

### Property 8: Branch access enforcement

*For any* branch_id not present in the user's accessible branch list, the createManual endpoint SHALL reject the request with a forbidden/access error.

**Validates: Requirements 5.8**

### Property 9: DPO number follows shared sequence format

*For any* created manual DPO, the generated dpo_number SHALL match the pattern `DPO-{branchCode}-{YYYYMMDD}-{NNN}` where branchCode is the branch's code, YYYYMMDD is the prep_date without dashes, and NNN is a zero-padded sequential number.

**Validates: Requirements 5.2**
