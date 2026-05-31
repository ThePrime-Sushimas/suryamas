# Implementation Plan: Manual DPO

## Overview

Add a manual DPO creation path that bypasses forecast calculation. Users directly specify products and quantities via a full-page form. The backend creates the DPO with forecast columns zeroed and stock snapshots captured at creation time. The resulting DPO integrates seamlessly with the existing confirm/edit/cancel flow.

## Tasks

- [x] 1. Backend types, schema, and route registration
  - [x] 1.1 Add `CreateManualDpoDto` interface to `daily-prep-orders.types.ts`
    - Define `CreateManualDpoDto` with fields: `branch_id`, `prep_date`, `source_warehouse_id`, `target_warehouse_id`, `station_codes?`, `notes?`, `lines[]` (each with `product_id` and `qty`), `created_by?`
    - _Requirements: 5.1, 5.5_

  - [x] 1.2 Add `createManualDpoSchema` to `daily-prep-orders.schema.ts`
    - Create Zod schema validating body: `branch_id` (uuid), `prep_date` (YYYY-MM-DD regex), `source_warehouse_id` (uuid), `target_warehouse_id` (uuid), `station_codes` (optional array of non-empty strings), `notes` (nullable optional string), `lines` (min 1 item, each with `product_id` uuid and `qty` > 0)
    - _Requirements: 2.6, 3.5, 3.7_

  - [x] 1.3 Add `POST /manual` route to `daily-prep-orders.routes.ts`
    - Register route above the `/:id` dynamic segment
    - Apply `canInsert('daily_prep_orders')` permission middleware
    - Apply `validateSchema(createManualDpoSchema)` middleware
    - Map to `dailyPrepOrdersController.createManual`
    - _Requirements: 1.1, 5.8_

- [x] 2. Backend repository and service implementation
  - [x] 2.1 Add `getStockSnapshots` method to `daily-prep-orders.repository.ts`
    - Accept `client`, `productIds[]`, `sourceWarehouseId`, `targetWarehouseId`
    - Query `warehouse_balances` to get current stock for each product in both warehouses
    - Return a map of `product_id → { current_main_stock, current_ready_stock }`
    - _Requirements: 5.7_

  - [x] 2.2 Add `createManualWithLines` method to `daily-prep-orders.repository.ts`
    - Accept `client`, `companyId`, `dto: CreateManualDpoDto`, `dpoNumber`, `stockSnapshots`
    - INSERT into `daily_prep_orders` with status DRAFT, forecast columns zeroed (weight_7d=0, weight_30d=0, weight_dow=0, coverage_days=0, holiday_factor_applied=0, has_upcoming_holiday=false)
    - INSERT into `daily_prep_order_lines` for each line with confirmed_qty = dto.qty, forecast columns zeroed, stock columns from snapshots
    - Return the created DPO id
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 2.3 Add `createManual` method to `daily-prep-orders.service.ts`
    - Enforce branch access check
    - Get company_id for the branch
    - Open transaction: generate DPO number, get stock snapshots, call `createManualWithLines`
    - Log audit event
    - Return full DPO detail via `fetchDetailAfterGenerate`
    - _Requirements: 5.1, 5.2, 5.8_

  - [x] 2.4 Add `createManual` handler to `daily-prep-orders.controller.ts`
    - Import and type the validated request using `createManualDpoSchema`
    - Extract `branchIds`, `userId` from `dpoScope`
    - Call `dailyPrepOrdersService.createManual(branchIds, { ...body, created_by: userId })`
    - Return 201 with success response
    - _Requirements: 5.1_

- [x] 3. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend API hook and product search component
  - [x] 4.1 Add `useCreateManualDpo` mutation to `dailyPrepOrders.api.ts`
    - POST to `/daily-prep-orders/manual` with body matching `CreateManualDpoDto`
    - Invalidate `['daily-prep-orders']` queries on success
    - Return `DailyPrepOrder` from response
    - _Requirements: 5.1_

  - [x] 4.2 Create `ProductSearchInput.tsx` component
    - Debounced text input that queries existing products API (`GET /api/v1/products`) with `search` and optional `station` filter params
    - Display autocomplete dropdown with product name, code, and station
    - On select, emit the product to the parent via callback
    - Prevent adding duplicate products already in the lines list
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3_

- [x] 5. Frontend CreateManualDpoPage and list page integration
  - [x] 5.1 Create `CreateManualDpoPage.tsx`
    - Full-page form with header fields: branch select, prep_date input, source warehouse select, target warehouse select, notes textarea
    - Product lines section with `ProductSearchInput` and station code filter
    - Lines table showing product name, code, qty input, and remove button
    - Submit button calls `useCreateManualDpo`, navigates to detail page on success
    - Validation: all header fields required, at least 1 line, all qty > 0
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1_

  - [x] 5.2 Add "Manual DPO" button to `DailyPrepOrdersPage.tsx`
    - Add button next to existing "Generate DPO" button, visible only when user has `daily_prep_orders.insert` permission
    - On click, navigate to `/inventory/daily-prep-orders/manual/create`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 5.3 Register route in `App.tsx`
    - Lazy-load `CreateManualDpoPage`
    - Add route `inventory/daily-prep-orders/manual/create` with `RequirePermission` for `daily_prep_orders`
    - Place route ABOVE the `/:id` route to avoid dynamic segment capture
    - _Requirements: 1.2_

- [x] 6. Checkpoint - Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 7. Property-based tests
  - [ ]* 7.1 Write property test for header validation (Property 1)
    - **Property 1: Header validation rejects incomplete submissions**
    - For any subset of required header fields missing at least one, verify the schema rejects with validation error
    - **Validates: Requirements 2.6**

  - [ ]* 7.2 Write property test for line quantity validation (Property 2)
    - **Property 2: Line quantity validation rejects non-positive values**
    - For any numeric value ≤ 0 as line qty, verify the schema rejects
    - **Validates: Requirements 3.5**

  - [ ]* 7.3 Write property test for forecast columns zeroed (Property 5)
    - **Property 5: Manual DPO creation zeroes forecast columns**
    - For any valid CreateManualDpoDto, verify the resulting DPO has all forecast columns set to 0/false
    - **Validates: Requirements 5.3, 5.4, 5.6**

  - [ ]* 7.4 Write property test for quantity preservation (Property 6)
    - **Property 6: Manual DPO preserves user-specified quantities**
    - For any valid dto with N lines, verify the DPO has N lines with confirmed_qty matching input qty
    - **Validates: Requirements 5.5**

  - [ ]* 7.5 Write property test for DPO number format (Property 9)
    - **Property 9: DPO number follows shared sequence format**
    - For any created manual DPO, verify dpo_number matches `DPO-{branchCode}-{YYYYMMDD}-{NNN}` pattern
    - **Validates: Requirements 5.2**

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- No new database tables or migrations needed — Manual DPOs reuse existing `daily_prep_orders` and `daily_prep_order_lines` tables
- The confirm/edit/cancel flow works unchanged for manual DPOs (Requirement 6, 8)
- Manual DPOs appear in the same list view without visual distinction (Requirement 7)
- The `POST /manual` route must be registered above `/:id` to avoid Express dynamic segment capture

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["2.4"] },
    { "id": 5, "tasks": ["4.1", "4.2"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2", "5.3"] },
    { "id": 8, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5"] }
  ]
}
```
