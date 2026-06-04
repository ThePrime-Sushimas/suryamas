# Implementation Plan: Daily Stock Opname Enhancement (Phase 1)

## Overview

Implements three new requirements for the existing Daily Stock Opname system: (1) UI label rename with formula tooltips, (2) Real Consumption Analysis backend endpoint + "Analisis" tab, and (3) Variance Classification with migration, backend service, frontend modal, and notifications. Tasks ordered by complexity: Req 19 first, then Req 20, then Req 21.

## Tasks

- [x] 1. Requirement 19: UI Label Rename and Tooltips (Frontend Only)
  - [x] 1.1 Rename "MAIN Bal." column header to "Stok Main" and add formula tooltips
    - In `frontend/src/features/daily-stock-opname/pages/DailyStockOpnameDetailPage.tsx`, change the last `<th>` column header text from `"MAIN Bal."` to `"Stok Main"`
    - Add `title` attribute to the "Sisa Expected" `<th>`: `title="Sisa Expected = Stok Awal − Pemakaian POS"`
    - Add `title` attribute to the "Var" `<th>`: `title="Variance = Actual − Sisa Expected"`
    - Ensure all other column headers (Code, Produk, Stok Awal, Pemakaian POS, Sisa Expected, Actual, Var, Var %, Foto) remain unchanged
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 2. Checkpoint - Verify Requirement 19 changes
  - Ensure the frontend compiles without errors, ask the user if questions arise.

- [x] 3. Requirement 20: Real Consumption Analysis — Backend
  - [x] 3.1 Add repository method for conversion movements query
    - In `backend/src/modules/daily-stock-opname/daily-stock-opname.repository.ts`, add `getConversionMovementsForDate(warehouseId, date, productIds)` method
    - Query `stock_movements` for `OUT_CONVERSION` and `IN_CONVERSION` types grouped by product_id
    - Return `Map<string, number>` with net conversion (IN minus OUT) per product
    - _Requirements: 20.7_

  - [x] 3.2 Create the Analysis Service
    - Create new file `backend/src/modules/daily-stock-opname/daily-stock-opname-analysis.service.ts`
    - Implement `getAnalysis(sessionId, branchIds)` method
    - Validate session exists and is in CONFIRMED or FLAGGED status (return error for DRAFT)
    - Load session lines and compute per-line analysis using the formula: `pemakaian_riil = stok_kemarin − (stok_hari_ini + waste) + total_konversi`
    - **IMPORTANT:** `barang_masuk` (dpo_in_qty) is included in the response DTO for display/transparency but is NOT used in the pemakaian_riil formula — system_qty already includes DPO transfers via stock_balances, so adding barang_masuk would double-count
    - Map fields: `system_qty → stok_kemarin`, `dpo_in_qty → barang_masuk` (display only), `actual_qty → stok_hari_ini`
    - Calculate waste as `abs(variance_qty)` when negative, otherwise 0
    - Set `pemakaian_pos = theoretical_out` (0 if `has_recipe = false`)
    - Compute `gap = pemakaian_riil - pemakaian_pos`
    - Return `AnalysisResponse` with lines array and summary totals
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.14_

  - [x] 3.3 Add Zod schemas for analysis endpoint
    - In `backend/src/modules/daily-stock-opname/daily-stock-opname.schema.ts`, add `analysisParamsSchema` (id param validation)
    - Define TypeScript types for `AnalysisLineItem` and `AnalysisResponse` in `daily-stock-opname.types.ts`
    - _Requirements: 20.1_

  - [x] 3.4 Add controller method and route for GET /:id/analysis
    - In `daily-stock-opname.controller.ts`, add `getAnalysis` handler calling AnalysisService
    - Enforce view permission on `daily_stock_opname` module and branch access
    - In `daily-stock-opname.routes.ts`, register `GET /:id/analysis` route
    - _Requirements: 20.1, 20.10, 20.14_

  - [ ]* 3.5 Write property test for Real Consumption Formula (Property 1)
    - **Property 1: Real Consumption Formula Invariant**
    - Generate random valid numeric tuples (system_qty, actual_qty, variance_qty, total_konversi, theoretical_out)
    - Verify `computeAnalysisLine` produces correct `pemakaian_riil = stok_kemarin − (stok_hari_ini + waste) + total_konversi`, correct `waste`, and correct `gap` values
    - Verify that `barang_masuk` (dpo_in_qty) is present in the output DTO but NOT included in the pemakaian_riil calculation
    - **Validates: Requirements 20.2, 20.4, 20.6, 20.8**

  - [ ]* 3.6 Write unit tests for Analysis Service
    - Test returns 400 error for DRAFT sessions
    - Test correctly maps `system_qty → stok_kemarin`, `dpo_in_qty → barang_masuk` (display only), `actual_qty → stok_hari_ini`
    - Test that barang_masuk is NOT used in pemakaian_riil formula (changing dpo_in_qty should not affect pemakaian_riil)
    - Test waste = 0 when variance is positive
    - Test `pemakaian_pos = 0` when `has_recipe = false`
    - Test summary totals are computed correctly
    - _Requirements: 20.2, 20.3, 20.4, 20.5, 20.6, 20.9, 20.14_

- [x] 4. Requirement 20: Real Consumption Analysis — Frontend
  - [x] 4.1 Add TanStack Query hook for analysis endpoint
    - In `frontend/src/features/daily-stock-opname/api/dailyStockOpname.ts`, add `useOpnameAnalysis(id, enabled)` hook
    - Query key: `['daily-stock-opname', id, 'analysis']`
    - Calls `GET /daily-stock-opname/${id}/analysis`
    - Only enabled when `id` is truthy and `enabled` is true
    - _Requirements: 20.1, 20.11_

  - [x] 4.2 Create the AnalysisTab component
    - Create `frontend/src/features/daily-stock-opname/components/AnalysisTab.tsx`
    - Render a read-only table with columns: Produk, Stok Kemarin, Barang Masuk, Stok Hari Ini, Waste, Konversi, Pemakaian Riil, Pemakaian POS, Gap
    - Highlight positive gap cells with `text-amber-600 bg-amber-50` styling
    - Show summary row with total_pemakaian_riil, total_pemakaian_pos, total_gap
    - Handle loading and error states
    - _Requirements: 20.11, 20.12, 20.13_

  - [x] 4.3 Add tab navigation to DailyStockOpnameDetailPage
    - Add `activeTab` state: `useState<'opname' | 'analisis'>('opname')`
    - Show tab bar with "Opname" and "Analisis" tabs using `border-b-2` active styling
    - "Analisis" tab only visible when session status is CONFIRMED or FLAGGED
    - Conditionally render existing table (opname tab) or `<AnalysisTab>` component
    - Pass session id and enabled flag to `useOpnameAnalysis`
    - _Requirements: 20.11, 20.12, 20.13_

- [x] 5. Checkpoint - Verify Requirement 20
  - Ensure all tests pass and both frontend and backend compile without errors, ask the user if questions arise.

- [x] 6. Requirement 21: Variance Classification — Database Migration
  - [x] 6.1 Create migration for variance_classification_lines table and classification_version column
    - Create `backend/database/migrations/2026XXXX_variance_classification_lines.sql`
    - Create table `variance_classification_lines` with columns: id (UUID PK), closing_id (FK → daily_closing_counts), line_id (FK → daily_closing_count_lines), variance_category (VARCHAR(20) CHECK IN 'WASTE','SHORTAGE'), qty (NUMERIC(20,4) CHECK > 0), shortage_assigned_to (UUID FK → employees(user_id) nullable), shortage_note (TEXT nullable), classified_by (UUID NOT NULL), classified_at (TIMESTAMPTZ DEFAULT now()), company_id (UUID FK NOT NULL), branch_id (UUID FK NOT NULL), created_at (TIMESTAMPTZ DEFAULT now())
    - Add indexes: `idx_vcl_closing` on closing_id, `idx_vcl_line` on line_id, partial `idx_vcl_assigned` on shortage_assigned_to WHERE variance_category = 'SHORTAGE'
    - Add `classification_version` column to `daily_closing_counts` table: `ALTER TABLE daily_closing_counts ADD COLUMN IF NOT EXISTS classification_version INTEGER NOT NULL DEFAULT 0;`
    - _Requirements: 21.8, 21.12, 21.17_

- [x] 7. Requirement 21: Variance Classification — Backend
  - [x] 7.1 Create Classification Repository
    - Create `backend/src/modules/daily-stock-opname/daily-stock-opname-classification.repository.ts`
    - Implement `deleteByClosingId(client, closingId)` for replace strategy
    - Implement `insertEntries(client, entries[])` for batch insert
    - Implement `findByClosingId(closingId, branchIds)` for fetching classification entries with employee names joined
    - Implement `getSummary(closingId)` returning waste_total, shortage_total, entry_count, is_complete flag, classification_version
    - **is_complete definition:** Query ALL lines WHERE `variance_qty < 0` for the session, then for each such line check `SUM(vcl.qty WHERE vcl.line_id = line.id) = ABS(line.variance_qty)`. Use `BOOL_AND(COALESCE(c.classified_qty, 0) = nl.abs_variance)` — if any negative-variance line has remaining unclassified qty, is_complete = false
    - Read `classification_version` from `daily_closing_counts` table and include in summary response
    - _Requirements: 21.8, 21.13, 21.14, 21.17_

  - [x] 7.2 Create Classification Service
    - Create `backend/src/modules/daily-stock-opname/daily-stock-opname-classification.service.ts`
    - Implement `classify(sessionId, branchIds, dto, userId)`:
      - Validate session is CONFIRMED or FLAGGED (error for DRAFT)
      - Validate caller is PIC (pic_user_id) or has 'approve' permission
      - Validate company_id and branch_id scoping
      - Fetch lines with negative variance for the session
      - Validate sum of classified quantities per line equals abs(variance_qty)
      - Validate shortage entries have `shortage_assigned_to` set
      - **Active Employee Validation:** For each SHORTAGE entry, validate that `shortage_assigned_to` references an active employee by querying `employees` table with conditions `is_active = true AND deleted_at IS NULL AND company_id = companyId`. If any referenced employee is inactive or deleted, return error `SHORTAGE_EMPLOYEE_INACTIVE` (HTTP 400) with message "Karyawan tidak aktif atau sudah dihapus tidak dapat di-assign shortage"
      - **Classification Audit Trail:** If existing classifications exist (re-submission), log previous classification state to AuditService (action: 'CLASSIFICATION_REPLACED', entity_type: 'daily_closing_count', including all entry details: line_id, variance_category, qty, shortage_assigned_to, classified_by, classified_at, and previous_version) BEFORE deletion
      - Increment `classification_version` on `daily_closing_counts` table in the same transaction
      - Delete existing classifications (replace strategy) and insert new ones in transaction
      - For each SHORTAGE entry: dispatch notification via notificationDispatcher
      - Return classification summary (includes updated classification_version)
    - Implement `getClassifications(sessionId, branchIds)`:
      - Fetch all entries with employee names
      - Compute and return summary (including is_complete and classification_version)
    - _Requirements: 21.6, 21.7, 21.8, 21.9, 21.10, 21.11, 21.12, 21.13, 21.14, 21.16, 21.17, 21.18_

  - [x] 7.3 Register notification event for opname shortage
    - In `backend/src/modules/notifications/notification-events.ts`, add `OPNAME_SHORTAGE_ASSIGNED: 'opname.shortage_assigned'` to `NOTIFICATION_EVENT_KEYS`
    - Add event definition to `NOTIFICATION_EVENT_CATALOG` with category 'inventory', type 'warning', title 'Shortage Opname', message template with product_name, qty, uom, pic_name, note variables, redirect to `/inventory/daily-stock-opname/{{session_id}}`
    - _Requirements: 21.9_

  - [x] 7.4 Add Zod schemas for classification endpoints
    - In `daily-stock-opname.schema.ts`, add `classifyBodySchema` validating entries array with line_id, variance_category, qty, shortage_assigned_to, shortage_note
    - Add response types for `ClassificationEntry`, `ClassificationSummary`, `ClassificationsResponse` in `daily-stock-opname.types.ts`
    - _Requirements: 21.6_

  - [x] 7.5 Add controller methods and routes for classify and classifications
    - In `daily-stock-opname.controller.ts`, add `classify` handler (POST /:id/classify) and `getClassifications` handler (GET /:id/classifications)
    - POST: Validate body with classifyBodySchema, call ClassificationService.classify
    - GET: Call ClassificationService.getClassifications
    - In `daily-stock-opname.routes.ts`, register both routes
    - _Requirements: 21.6, 21.10, 21.14_

  - [ ]* 7.6 Write property test for Classification Sum Invariant (Property 2)
    - **Property 2: Classification Sum Invariant**
    - Generate random negative variances and random splits into waste/shortage portions
    - Verify the validator accepts valid splits (sum equals abs variance) and rejects invalid ones
    - **Validates: Requirements 21.4, 21.7**

  - [ ]* 7.7 Write unit tests for Classification Service
    - Test requires CONFIRMED/FLAGGED status
    - Test rejects non-PIC user without approve permission
    - Test validates sum constraint per line (returns CLASSIFICATION_SUM_MISMATCH error)
    - Test requires shortage_assigned_to for SHORTAGE entries
    - Test rejects inactive employee (is_active=false) for shortage assignment with SHORTAGE_EMPLOYEE_INACTIVE error
    - Test rejects deleted employee (deleted_at IS NOT NULL) for shortage assignment with SHORTAGE_EMPLOYEE_INACTIVE error
    - Test accepts active non-deleted employee for shortage assignment
    - Test notification dispatched for SHORTAGE entries
    - Test replace strategy (delete old + insert new)
    - Test AuditService.log called with previous classification state before delete-all on re-submission
    - Test classification_version increments on each re-submission
    - Test is_complete = true when ALL negative-variance lines have SUM(vcl.qty) = ABS(line.variance_qty)
    - Test is_complete = false when any negative-variance line has unclassified qty remaining
    - _Requirements: 21.7, 21.9, 21.10, 21.11, 21.13, 21.16, 21.17, 21.18_

- [x] 8. Requirement 21: Variance Classification — Frontend
  - [x] 8.1 Add TanStack Query hooks for classification endpoints
    - In `frontend/src/features/daily-stock-opname/api/dailyStockOpname.ts`, add:
      - `useClassifyOpname()` mutation hook (POST /daily-stock-opname/:id/classify) with query invalidation
      - `useOpnameClassifications(id, enabled)` query hook (GET /daily-stock-opname/:id/classifications)
    - _Requirements: 21.6, 21.14_

  - [x] 8.2 Create the ClassificationModal component
    - Create `frontend/src/features/daily-stock-opname/components/ClassificationModal.tsx`
    - Full-screen modal (`fixed inset-0 z-50`) with header, table, and footer
    - Table columns: Produk, Variance Qty, Qty Waste, Qty Shortage, Assigned To, Note
    - Each row shows abs(variance_qty) and allows splitting into waste_qty + shortage_qty
    - Client-side validation: `waste_qty + shortage_qty === abs(variance_qty)` per row
    - **Employee Picker:** Use existing `employeesApi.search()` from `@/features/employees` to call `GET /employees/search?branch_name={branchName}&is_active=true` for the shortage_assigned_to picker — shows only active employees from the same branch as the opname session
    - If `shortage_qty > 0`, require selecting an employee from the filtered employee list
    - Footer shows summary totals and submit button
    - On submit, call `useClassifyOpname` mutation and show success toast
    - _Requirements: 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.18, 21.19_

  - [x] 8.3 Create ClassificationSummary component and integrate into detail page
    - Create `frontend/src/features/daily-stock-opname/components/ClassificationSummary.tsx`
    - Shows "Classified" badge when `is_complete = true` (for ALL lines WHERE variance_qty < 0, SUM(vcl.qty) = ABS(line.variance_qty))
    - Shows summary: total waste qty, total shortage qty, number of assigned employees
    - In `DailyStockOpnameDetailPage.tsx`:
      - Add "Klasifikasi Variance" button visible when: status is CONFIRMED/FLAGGED, user is PIC or has approve permission, session has negative-variance lines
      - Render ClassificationModal when button is clicked
      - Render ClassificationSummary badge in header when classification is complete
    - _Requirements: 21.1, 21.13, 21.15_

- [x] 9. Final Checkpoint
  - Ensure all tests pass, frontend and backend compile without errors, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The programming language for all tasks is TypeScript (matching existing codebase)
- Existing patterns to follow: notification dispatcher pattern from purchase-invoices, TanStack Query hooks from dailyStockOpname.ts, tab navigation with useState + border-b-2 styling
- **Formula clarification:** `pemakaian_riil = stok_kemarin − (stok_hari_ini + waste) + total_konversi` — barang_masuk is displayed but NOT used in the formula
- **Employee picker:** Uses `GET /employees/search?branch_name={branchName}&is_active=true` via existing `employeesApi.search()` from `@/features/employees`
- **is_complete:** For ALL lines WHERE variance_qty < 0, SUM(vcl.qty) = ABS(line.variance_qty). If any line has remaining unclassified qty, is_complete = false
- **Classification audit trail:** Previous state logged to AuditService before delete-all on re-submission; classification_version column on daily_closing_counts increments on each re-submission

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["3.1", "3.3", "6.1"] },
    { "id": 2, "tasks": ["3.2", "4.1", "7.1", "7.3", "7.4"] },
    { "id": 3, "tasks": ["3.4", "3.5", "3.6", "4.2", "7.2"] },
    { "id": 4, "tasks": ["4.3", "7.5", "7.6", "7.7"] },
    { "id": 5, "tasks": ["8.1"] },
    { "id": 6, "tasks": ["8.2"] },
    { "id": 7, "tasks": ["8.3"] }
  ]
}
```
