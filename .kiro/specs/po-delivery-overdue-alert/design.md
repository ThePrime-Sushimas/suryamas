# Design Document: PO Delivery Overdue Alert

## Overview

This design adds a computed `overdue_days` field to the Purchase Orders list API response. The calculation is performed server-side via SQL to enable future sorting/filtering. The frontend displays a warning icon with tooltip on overdue POs in both desktop table and mobile card layouts.

## Architecture

The feature modifies the existing PO list query pipeline without introducing new tables or migrations. The overdue calculation is a computed field derived from existing data:

```
[purchase_order_lines] → supplier_product_id → [supplier_products.lead_time_days]
                                                         ↓ (fallback)
                                               [suppliers.lead_time_days]
```

**Data flow:**
1. SQL query computes `overdue_days` and `overdue_trigger_product` via a lateral subquery
2. Repository returns the new fields as part of `PurchaseOrderWithRelations`
3. Service passes through without transformation
4. Controller returns in API response
5. Frontend renders warning icon + tooltip when `overdue_days > 0`

## Components and Interfaces

### 1. SQL Query Modification (Repository Layer)

The `HEADER_SELECT` and `HEADER_FROM` constants in `purchase-orders.repository.ts` are extended with a lateral subquery that computes overdue information.

#### Overdue Lateral Subquery

```sql
LEFT JOIN LATERAL (
  SELECT
    CASE
      WHEN po.status NOT IN ('SENT', 'ORDERED', 'PARTIAL_RECEIVED') THEN NULL
      WHEN po.status IN ('SENT', 'ORDERED') AND EXISTS (
        SELECT 1 FROM goods_receipts gr
        WHERE gr.po_id = po.id AND gr.deleted_at IS NULL AND gr.status = 'CONFIRMED'
      ) THEN NULL
      ELSE
        GREATEST(
          0,
          CURRENT_DATE - (po.order_date + COALESCE(
            (SELECT MIN(sp.lead_time_days)
             FROM purchase_order_lines pol2
             JOIN supplier_products sp ON sp.id = pol2.supplier_product_id
             WHERE pol2.po_id = po.id AND sp.lead_time_days IS NOT NULL),
            s.lead_time_days
          ))
        )::int
    END AS overdue_days,
    CASE
      WHEN po.status NOT IN ('SENT', 'ORDERED', 'PARTIAL_RECEIVED') THEN NULL
      WHEN po.status IN ('SENT', 'ORDERED') AND EXISTS (
        SELECT 1 FROM goods_receipts gr
        WHERE gr.po_id = po.id AND gr.deleted_at IS NULL AND gr.status = 'CONFIRMED'
      ) THEN NULL
      ELSE (
        SELECT p.product_name
        FROM purchase_order_lines pol3
        JOIN supplier_products sp2 ON sp2.id = pol3.supplier_product_id
        JOIN products p ON p.id = pol3.product_id
        WHERE pol3.po_id = po.id AND sp2.lead_time_days IS NOT NULL
        ORDER BY sp2.lead_time_days ASC
        LIMIT 1
      )
    END AS overdue_trigger_product
) overdue_calc ON true
```

**Key design decisions:**
- Uses `LEFT JOIN LATERAL` to keep the subquery scoped per-PO row (consistent with existing `lines_agg` pattern)
- `COALESCE` handles the fallback from supplier_product-level to supplier-level lead_time_days
- `GREATEST(0, ...)` ensures we never return negative values; the application layer converts 0 to NULL
- The `overdue_trigger_product` identifies which product's lead time triggered the alert (for tooltip display)
- Status check and GR exclusion are handled in SQL to avoid N+1 queries

#### Updated HEADER_SELECT

```typescript
const HEADER_SELECT = `
  po.*,
  b.branch_name, b.branch_code,
  s.supplier_name, s.supplier_code, s.invoice_bypass_reason,
  pr.request_number,
  app_emp.full_name AS approved_by_name,
  pt.term_name AS payment_term_name,
  COALESCE(lines_agg.line_count, 0)::int AS line_count,
  NULLIF(overdue_calc.overdue_days, 0) AS overdue_days,
  overdue_calc.overdue_trigger_product
`
```

The `NULLIF(..., 0)` converts a zero result to NULL, satisfying requirement 1.4.

### 2. Backend Type Changes

#### `purchase-orders.types.ts`

```typescript
export interface PurchaseOrderWithRelations extends PurchaseOrder {
  branch_name: string
  branch_code: string
  supplier_name: string
  supplier_code: string
  invoice_bypass_reason: 'marketplace' | 'cash' | 'informal' | null
  request_number: string
  approved_by_name: string | null
  line_count: number
  // Overdue alert fields (computed, not stored)
  overdue_days: number | null
  overdue_trigger_product: string | null
}
```

No changes needed to the service or controller layers — the fields flow through the existing `findAll` → `list` → `sendSuccess` pipeline.

### 3. API Response Shape

The existing `/api/v1/purchase-orders` GET endpoint response gains two new fields per PO object:

```typescript
{
  // ... existing fields ...
  overdue_days: number | null,          // null when not overdue or not eligible
  overdue_trigger_product: string | null // product name with shortest lead time
}
```

### 4. Frontend Type Changes

#### `purchaseOrders.api.ts` — PurchaseOrder interface

```typescript
export interface PurchaseOrder {
  // ... existing fields ...
  overdue_days: number | null
  overdue_trigger_product: string | null
}
```

### 5. Frontend Component: OverdueWarning

A small reusable component renders the warning icon with tooltip:

```typescript
// frontend/src/features/purchase-orders/components/OverdueWarning.tsx
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'

interface OverdueWarningProps {
  overdueDays: number
  triggerProduct: string | null
}

export function OverdueWarning({ overdueDays, triggerProduct }: OverdueWarningProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip((v) => !v)}
    >
      <AlertTriangle className="w-4 h-4 text-amber-500" />
      {showTooltip && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
          <span className="font-semibold">Terlambat {overdueDays} hari</span>
          {triggerProduct && (
            <span className="block text-gray-300 mt-0.5">
              Item: {triggerProduct}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
```

### 6. Desktop Table Integration

In `PurchaseOrdersPage.tsx`, the warning icon is rendered inline with the PO number cell:

```typescript
<td className="px-4 py-3">
  <div className="flex items-center gap-1.5">
    <Link to={`${PURCHASE_ORDERS_LIST_PATH}/${po.id}`} className="font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline" onClick={e => e.stopPropagation()}>
      {po.po_number}
    </Link>
    {po.overdue_days != null && po.overdue_days > 0 && (
      <OverdueWarning overdueDays={po.overdue_days} triggerProduct={po.overdue_trigger_product} />
    )}
  </div>
</td>
```

### 7. Mobile Card Integration

In the mobile card layout, the warning icon is placed next to the PO number:

```typescript
<div className="min-w-0 flex-1">
  <div className="flex items-center gap-1.5">
    <p className="font-mono font-medium text-gray-900 dark:text-white text-sm">{po.po_number}</p>
    {po.overdue_days != null && po.overdue_days > 0 && (
      <OverdueWarning overdueDays={po.overdue_days} triggerProduct={po.overdue_trigger_product} />
    )}
  </div>
  <p className="text-xs text-gray-500 truncate">
    {po.supplier_name} · {po.branch_name}
  </p>
</div>
```

## Data Models

No new tables or migrations. The feature uses existing tables:

| Table | Relevant Columns | Role |
|-------|-----------------|------|
| `purchase_orders` | `order_date`, `status`, `supplier_id` | Source PO data |
| `purchase_order_lines` | `po_id`, `supplier_product_id` | Links PO to supplier products |
| `supplier_products` | `id`, `lead_time_days` (nullable) | Line-level lead time |
| `suppliers` | `id`, `lead_time_days` (default 1) | Fallback lead time |
| `goods_receipts` | `po_id`, `status`, `deleted_at` | GR exclusion check |

## Error Handling

- If a PO has no lines with `supplier_product_id` set AND the supplier's `lead_time_days` is used as fallback, the calculation still works (suppliers.lead_time_days defaults to 1)
- If `supplier_products` record doesn't exist for a `supplier_product_id` (data integrity issue), the JOIN simply won't match and that line is excluded from the MIN calculation
- The `COALESCE` with `s.lead_time_days` ensures there's always a fallback value
- NULL `overdue_days` is the safe default — no false positives

## Performance Considerations

- The lateral subquery adds a correlated subquery per PO row, but:
  - `purchase_order_lines` is indexed on `po_id`
  - `supplier_products` primary key lookup is O(1)
  - `goods_receipts` should have an index on `po_id` (existing)
  - The subquery only runs for eligible statuses (short-circuit via CASE)
- For large result sets, the status check in the CASE expression avoids computing lead times for DRAFT/CANCELLED POs
- No additional API calls from the frontend

## Testing Strategy

- **Unit tests**: Verify specific examples of overdue calculation (e.g., PO ordered 10 days ago with 3-day lead time = 7 days overdue)
- **Property tests**: Validate universal properties of the calculation logic (status eligibility, GR exclusion, min lead time selection)
- **Integration tests**: Verify the SQL lateral subquery returns correct results against a test database with known data
- **Component tests**: Verify the OverdueWarning component renders/hides correctly based on `overdue_days` value

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Overdue days calculation correctness

*For any* eligible PO (status in SENT, ORDERED, PARTIAL_RECEIVED) with order_date `d` and minimum lead time `lt` days, the computed overdue_days SHALL equal `current_date - (d + lt)` when positive, and NULL otherwise.

**Validates: Requirements 1.1, 1.4, 1.5**

### Property 2: Minimum lead time selection

*For any* PO with multiple line items linked to supplier_products, the lead time used in the overdue calculation SHALL be the minimum non-null `lead_time_days` value among those supplier_products. When all are NULL, the supplier-level `lead_time_days` SHALL be used as fallback.

**Validates: Requirements 1.2, 1.3**

### Property 3: Status eligibility filter

*For any* PO with status NOT in {SENT, ORDERED, PARTIAL_RECEIVED}, the overdue_days field SHALL always be NULL regardless of order_date or lead time values.

**Validates: Requirements 2.1, 2.2**

### Property 4: Goods receipt exclusion for SENT/ORDERED

*For any* PO with status SENT or ORDERED that has at least one confirmed goods receipt, the overdue_days field SHALL be NULL regardless of the calculated overdue value.

**Validates: Requirements 3.1**

### Property 5: PARTIAL_RECEIVED ignores goods receipt exclusion

*For any* PO with status PARTIAL_RECEIVED, the overdue_days SHALL be calculated normally using order_date and minimum lead time, regardless of whether confirmed goods receipts exist.

**Validates: Requirements 3.2**
