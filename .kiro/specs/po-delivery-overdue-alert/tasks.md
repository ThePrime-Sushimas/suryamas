# Implementation Plan: PO Delivery Overdue Alert

## Overview

Add a computed `overdue_days` field to the PO list API response via a SQL lateral subquery, and display a warning icon with tooltip on overdue POs in both desktop and mobile layouts. No migrations needed — the field is derived from existing `supplier_products.lead_time_days` and `suppliers.lead_time_days` data.

## Tasks

- [ ] 1. Backend: Extend repository query and types
  - [ ] 1.1 Add overdue lateral subquery to HEADER_SELECT and HEADER_FROM constants
    - In `backend/src/modules/purchase-orders/purchase-orders.repository.ts`, extend `HEADER_SELECT` to include `NULLIF(overdue_calc.overdue_days, 0) AS overdue_days` and `overdue_calc.overdue_trigger_product`
    - Add the `LEFT JOIN LATERAL` subquery for `overdue_calc` to `HEADER_FROM` that computes overdue_days using MIN(supplier_products.lead_time_days) with fallback to suppliers.lead_time_days
    - The subquery must check status eligibility (SENT, ORDERED, PARTIAL_RECEIVED) and exclude SENT/ORDERED POs with confirmed goods receipts
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 3.1, 3.2, 4.2_

  - [ ] 1.2 Add overdue fields to PurchaseOrderWithRelations type
    - In `backend/src/modules/purchase-orders/purchase-orders.types.ts`, add `overdue_days: number | null` and `overdue_trigger_product: string | null` to the `PurchaseOrderWithRelations` interface
    - _Requirements: 4.1_

- [ ] 2. Frontend: Add types and OverdueWarning component
  - [ ] 2.1 Add overdue fields to frontend PurchaseOrder interface
    - In `frontend/src/features/purchase-orders/api/purchaseOrders.api.ts`, add `overdue_days: number | null` and `overdue_trigger_product: string | null` to the `PurchaseOrder` interface
    - _Requirements: 4.1_

  - [ ] 2.2 Create OverdueWarning component
    - Create `frontend/src/features/purchase-orders/components/OverdueWarning.tsx`
    - Render an `AlertTriangle` icon (lucide-react) with amber color
    - Show tooltip on hover (desktop) and tap (mobile) displaying "Terlambat X hari" and the triggering product name
    - Use `useState` for tooltip visibility toggle
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 3. Frontend: Integrate OverdueWarning into PO list page
  - [ ] 3.1 Add OverdueWarning to desktop table layout
    - In `frontend/src/features/purchase-orders/pages/PurchaseOrdersPage.tsx`, wrap the PO number cell content in a flex container and conditionally render `<OverdueWarning>` when `po.overdue_days != null && po.overdue_days > 0`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 3.2 Add OverdueWarning to mobile card layout
    - In the mobile card section of `PurchaseOrdersPage.tsx`, wrap the PO number in a flex container and conditionally render `<OverdueWarning>` when `po.overdue_days != null && po.overdue_days > 0`
    - _Requirements: 6.1, 6.2_

- [ ] 4. Checkpoint - Verify end-to-end integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 5. Property-based tests for overdue calculation logic
  - [ ]* 5.1 Write property test for overdue days calculation correctness
    - **Property 1: Overdue days calculation correctness**
    - For any eligible PO with order_date `d` and minimum lead time `lt`, verify overdue_days equals `current_date - (d + lt)` when positive, and NULL otherwise
    - **Validates: Requirements 1.1, 1.4, 1.5**

  - [ ]* 5.2 Write property test for minimum lead time selection
    - **Property 2: Minimum lead time selection**
    - For any PO with multiple supplier_products, verify the minimum non-null lead_time_days is used; when all are NULL, verify supplier-level fallback is used
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 5.3 Write property test for status eligibility filter
    - **Property 3: Status eligibility filter**
    - For any PO with status NOT in {SENT, ORDERED, PARTIAL_RECEIVED}, verify overdue_days is always NULL
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 5.4 Write property test for goods receipt exclusion
    - **Property 4: Goods receipt exclusion for SENT/ORDERED**
    - For any PO with status SENT or ORDERED that has a confirmed goods receipt, verify overdue_days is NULL
    - **Validates: Requirements 3.1**

  - [ ]* 5.5 Write property test for PARTIAL_RECEIVED ignoring GR exclusion
    - **Property 5: PARTIAL_RECEIVED ignores goods receipt exclusion**
    - For any PO with status PARTIAL_RECEIVED, verify overdue_days is calculated normally regardless of confirmed goods receipts
    - **Validates: Requirements 3.2**

- [ ] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- No database migration is needed — overdue_days is a computed field from existing data
- The lateral subquery pattern is consistent with the existing `lines_agg` lateral join in the repository
- The `NULLIF(..., 0)` in HEADER_SELECT converts zero to NULL so the frontend only renders warnings for truly overdue POs
- Property tests validate the SQL logic correctness; they require a test database with seeded data

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5"] }
  ]
}
```
