# Implementation Plan: Daily Stock Opname (Daily Closing Count)

## Overview

This plan implements the Daily Stock Opname feature — a nightly inventory control system for READY warehouses. Implementation follows the 12-phase dependency order from the design document: database migration → backend types/errors → repository → service (create + calculate) → service (confirm + stock movements) → controller/routes → DPO integration → frontend list → frontend detail → config/photo/resolve → dashboard widget → variance report.

## Tasks

- [x] 1. Database migration, types, and error classes
  - [x] 1.1 Create database migration file
    - Create `backend/database/migrations/20260530000000_daily_stock_opname.sql`
    - Include `branch_opname_config` table with variance_threshold_pct, closing_time, grace_period_minutes
    - Include `daily_closing_counts` table with unique index on (branch_id, closing_date) WHERE deleted_at IS NULL
    - Include `daily_closing_count_lines` table with indexes on closing_id and product_id
    - Seed default config for existing branches (variance_threshold_pct = 15, closing_time = '23:59', grace_period_minutes = 15)
    - _Requirements: 1.2, 17.4, 18.4_

  - [x] 1.2 Create backend types file
    - Create `backend/src/modules/daily-stock-opname/daily-stock-opname.types.ts`
    - Define OpnameStatus, OpnameDisplayStatus, DailyClosingCount, DailyClosingCountLine, DailyClosingCountDetail, OpnameSummary
    - Define DTOs: CreateOpnameDto, UpdateLineDto, BulkUpdateLinesDto, ResolveOpnameDto, UpsertOpnameConfigDto
    - Define BranchOpnameConfig, OpnameDashboardItem, VarianceReportItem, VarianceReportFilter
    - _Requirements: 1.1, 3.2, 8.2, 11.3, 13.2, 14.2, 17.1_

  - [x] 1.3 Create error classes file
    - Create `backend/src/modules/daily-stock-opname/daily-stock-opname.errors.ts`
    - Implement: OpnameNotFoundError, OpnameDuplicateError, OpnameNotDraftError, OpnameNotFlaggedError, OpnameTimeExpiredError, OpnameBackdateError, OpnameIncompleteError, OpnamePhotoRequiredError, OpnameSessionExpiredError, DpoBlockedByOpnameError
    - _Requirements: 1.3, 5.1, 5.10, 6.1, 6.2, 6.3, 7.3, 8.4_

  - [x] 1.4 Add 'daily_closing_count' to ReferenceType in stock module
    - Update `backend/src/modules/stock/stock.types.ts` to add `'daily_closing_count'` to the ReferenceType union
    - _Requirements: 16.5_

- [x] 2. Repository layer
  - [x] 2.1 Create repository file with transaction support and header queries
    - Create `backend/src/modules/daily-stock-opname/daily-stock-opname.repository.ts`
    - Implement `withTransaction()` wrapper (same pattern as stockRepository)
    - Implement `findAll()` with pagination, filtering by date range/branch/status/search, and MISSED status logic (DRAFT from previous days)
    - Implement `findByIdAccessible()` returning full detail with lines and relations (joins to branches, users, warehouses)
    - Implement `findByBranchAndDate()` for duplicate check
    - Implement `hasConfirmedSession()` for DPO blocking check
    - Implement `insertHeader()` and `updateHeaderStatus()`
    - Implement `softDelete()` for cancellation
    - _Requirements: 1.2, 1.3, 7.2, 9.1, 11.1, 11.2, 11.3, 11.4_

  - [x] 2.2 Implement line-related repository methods
    - Implement `insertLines()` for bulk inserting opname lines within a transaction
    - Implement `updateLineActual()` for updating actual_qty and recalculating variance fields
    - Implement `updateLinePhoto()` for storing photo URL
    - Implement `updateLineMovements()` for storing movement IDs after confirmation
    - Implement `getLineById()` for single line retrieval
    - _Requirements: 3.1, 3.7, 4.4, 5.3, 5.4_

  - [x] 2.3 Implement expected balance helper queries
    - Implement `getReadyBalances()` — query stock_balances for READY warehouse
    - Implement `getDpoTransfersForDate()` — sum IN_TRANSFER movements for display
    - Implement `getMainBalances()` — query stock_balances for MAIN warehouse (snapshot)
    - Implement `getProductsWithStock()` — get all products with positive balance or stock in READY warehouse
    - Implement `getLastMovementCost()` — fallback cost lookup from most recent stock_movement
    - _Requirements: 2.1, 2.2, 2.3, 3.4, 3.5_

  - [x] 2.4 Implement config, dashboard, and variance report queries
    - Implement `findConfig()` and `upsertConfig()` for branch_opname_config
    - Implement `getDashboardData()` — today's opname status per branch with MISSED/NOT_STARTED logic
    - Implement `getVarianceReport()` — aggregated variance data with grouping by day/week/month
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 13.1, 13.2, 13.3, 13.4, 17.1, 17.2_

- [x] 3. Service layer — session creation and expected balance calculation
  - [x] 3.1 Implement createSession() with expected balance calculation
    - Create `backend/src/modules/daily-stock-opname/daily-stock-opname.service.ts`
    - Validate current date (Jakarta TZ), not past closing_time, no existing session for branch+date
    - Resolve READY and MAIN warehouse for branch
    - Calculate expected balances: ready_balance - theoretical_consumption (DPO already reflected in stock_balances)
    - Snapshot MAIN warehouse balances, cost_per_unit (from avg_cost or last movement), DPO in quantities
    - Clamp negative expected to 0 with warning flag
    - Mark high-risk products (risk_category = 'HIGH')
    - Insert header and lines within transaction
    - Log audit entry via AuditService
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.4, 3.5, 4.1, 6.1, 6.3, 6.5, 15.1_

  - [x] 3.2 Implement time restriction validation helper
    - Implement `validateTimeRestriction()` — checks closing_time + grace period for create/edit/confirm actions
    - Implement `isSessionExpired()` — checks if DRAFT session is from a previous day
    - Implement Jakarta timezone utility functions: `nowJakarta()`, `todayJakarta()`, `currentTimeJakarta()`, `isWithinClosingTime()`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.2_

  - [x] 3.3 Write property test for snapshot consistency
    - **Property 3: Snapshot Consistency** — Expected balance, cost_per_unit, and MAIN balance stored on line records never change after session creation regardless of subsequent stock movements
    - **Validates: Requirements 2.6, 3.5**

- [x] 4. Service layer — line updates and confirmation with stock movements
  - [x] 4.1 Implement updateLine() and bulkUpdateLines()
    - Validate session is DRAFT and within time window
    - Calculate variance = actual_qty - expected_qty
    - Calculate variance_cost = variance × cost_per_unit
    - Calculate variance_pct = (variance / expected_qty) × 100 when expected > 0
    - Handle edge cases: expected=0 with actual>0 (null pct), expected=0 with actual=0 (zero)
    - Update completed_count on header
    - Log audit entry for each line update
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 3.8, 3.9, 3.10, 6.4, 15.3_

  - [x] 4.2 Implement confirmSession() with stock movement creation
    - Validate: session is DRAFT, within closing_time + grace, all lines have actual_qty, high-risk photo check
    - Within single transaction: for each line create OUT_WASTE (negative variance), IN_ADJUSTMENT (positive variance), or OUT_ADJUSTMENT (zero variance but balance differs from actual)
    - Set reference_type = 'daily_closing_count', reference_id = session ID on all movements
    - Calculate total_variance_cost (sum of absolute line variance costs)
    - Determine status: FLAGGED if any line (with expected > 0) exceeds threshold, else CONFIRMED
    - Update header with status, totals, confirmed_by, confirmed_at
    - Rollback entire transaction on any failure, return session to DRAFT
    - Log audit entry
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 16.1, 16.2, 16.3, 16.4, 15.2_

  - [x] 4.3 Write property test for transaction atomicity
    - **Property 1: Transaction Atomicity** — If any stock movement fails during confirmation, all movements roll back and session remains DRAFT
    - **Validates: Requirements 16.3, 16.4**

  - [x] 4.4 Write property test for balance integrity
    - **Property 5: Balance Integrity** — After confirmation, stock_balances for ALL products in READY warehouse equal the actual counted quantities
    - **Validates: Requirements 5.5**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Controller, routes, and schema validation
  - [x] 6.1 Create Zod validation schemas
    - Create `backend/src/modules/daily-stock-opname/daily-stock-opname.schema.ts`
    - Define: createOpnameSchema, updateLineSchema, bulkUpdateLinesSchema, resolveSchema, configSchema, listSchema, varianceReportSchema
    - _Requirements: 1.1, 3.1, 8.2, 11.2, 13.2, 17.1_

  - [x] 6.2 Create controller with all endpoint handlers
    - Create `backend/src/modules/daily-stock-opname/daily-stock-opname.controller.ts`
    - Implement handlers: list, getById, create, updateLine, bulkUpdateLines, uploadPhoto, confirm, resolve, cancel
    - Implement config handlers: getConfig, updateConfig
    - Implement report handlers: getDashboard, getVarianceReport, exportVarianceReportCsv
    - Use `req.validated.body/params/query`, `handleError`, `sendSuccess`
    - _Requirements: 11.1, 12.1, 1.1, 3.1, 4.5, 5.1, 8.1, 7.1, 17.1, 18.1, 14.1, 13.1, 13.5_

  - [x] 6.3 Create routes file and register in app.ts
    - Create `backend/src/modules/daily-stock-opname/daily-stock-opname.routes.ts`
    - Define all routes per API table in design (CRUD, config, reports, dashboard)
    - Apply authenticate middleware, validateSchema middleware, multer for photo upload
    - Register routes in `backend/src/app.ts` under `/api/v1/daily-stock-opname`
    - _Requirements: 4.5, 4.6, 11.1, 12.1, 13.1, 14.1, 17.1, 18.1_

  - [x] 6.4 Write unit tests for controller endpoints
    - Test validation rejection for invalid inputs
    - Test correct service method delegation
    - Test error response formatting
    - _Requirements: 1.3, 6.2, 8.4_

- [x] 7. Service — cancel, resolve, and remaining actions
  - [x] 7.1 Implement cancel() and resolve() methods
    - `cancel()`: validate DRAFT status, soft-delete session
    - `resolve()`: validate FLAGGED status, require resolution_note, update to CONFIRMED, record resolver info
    - No additional stock movements on resolve (already created during original confirmation)
    - Log audit entries
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 15.2_

  - [x] 7.2 Implement getById(), list(), getConfig(), upsertConfig()
    - `getById()`: return full detail with lines, summary calculations, display status (MISSED for expired DRAFT)
    - `list()`: paginated with filters, compute display status for each session
    - `getConfig()`: return config or defaults (15%, 23:59, 15min)
    - `upsertConfig()`: validate and save config
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 12.1, 12.4, 17.1, 17.2, 17.3, 18.1, 18.2, 18.3_

- [x] 8. DPO blocking integration
  - [x] 8.1 Add opname blocking check to DPO confirm flow
    - In `backend/src/modules/daily-prep-orders2/` service confirm method, add check before processing
    - Call `dailyStockOpnameRepository.hasConfirmedSession(branchId, movementDate)`
    - If confirmed/flagged opname exists for same branch + date + READY warehouse, throw DpoBlockedByOpnameError
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 9. Frontend — API layer and shared types
  - [x] 9.1 Create frontend API service and types
    - Create `frontend/src/features/daily-stock-opname/types/index.ts` with frontend type definitions
    - Create `frontend/src/features/daily-stock-opname/api/dailyStockOpname.ts` with all API functions
    - Implement: listOpname, getOpnameById, createOpname, updateLine, bulkUpdateLines, uploadPhoto, confirmOpname, resolveOpname, cancelOpname, getConfig, updateConfig, getDashboard, getVarianceReport, exportVarianceReportCsv
    - _Requirements: 11.1, 12.1, 13.1, 14.1_

  - [x] 9.2 Create URL filter config for list page
    - Create `frontend/src/features/daily-stock-opname/utils/opnameFilters.url.ts`
    - Define OpnameFilters type, OPNAME_FILTER_DEFAULTS, opnameFilterConfig (parse, stringify, merge)
    - Follow existing pattern from dpoFilters.url.ts
    - _Requirements: 11.5_

- [x] 10. Frontend — List page
  - [x] 10.1 Create Opname List Page
    - Create `frontend/src/features/daily-stock-opname/pages/DailyStockOpnamePage.tsx`
    - Use `useUrlFilters` with opnameFilterConfig for filter/pagination/search state
    - Filter by date range, branch, status (DRAFT, CONFIRMED, FLAGGED, MISSED)
    - Search by PIC name
    - Table columns: Date, Branch, PIC, Status (badge), Items (completed/total), Variance Cost, Actions
    - "Mulai Opname" button to create new session for today
    - Click row navigates to detail page using `useListNavigation`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 10.2 Create OpnameStatusBadge component
    - Create `frontend/src/features/daily-stock-opname/components/OpnameStatusBadge.tsx`
    - Status badges: DRAFT (yellow), CONFIRMED (green), FLAGGED (red), MISSED (gray)
    - _Requirements: 11.2_

- [x] 11. Frontend — Detail/Input page
  - [x] 11.1 Create Opname Detail Page with input functionality
    - Create `frontend/src/features/daily-stock-opname/pages/DailyStockOpnameDetailPage.tsx`
    - Header: Branch, Date, PIC, Status Badge
    - Summary cards: Expected Cost, Actual Cost, Variance Cost, Completion %
    - Progress bar showing completed/total items
    - Product table with: Code, Name, Expected, Actual (input), Variance, Var%, Photo, MAIN balance
    - DRAFT mode: editable inputs, photo upload, confirm/cancel buttons
    - CONFIRMED/FLAGGED mode: read-only, resolve button for FLAGGED (manager only)
    - Client-side variance calculation on input change
    - Highlight rows exceeding threshold in red/orange
    - Show "⚠️ No recipe" indicator for products without recipe coverage
    - Use `useListNavigation` for back navigation preserving list filters
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 11.2 Create OpnameLineRow component
    - Create `frontend/src/features/daily-stock-opname/components/OpnameLineRow.tsx`
    - Render single product line with input field, variance display, photo indicator
    - Handle high-risk visual indicator and photo requirement badge
    - Show MAIN warehouse balance as reference
    - _Requirements: 3.6, 12.1, 12.5, 12.6_

  - [x] 11.3 Create OpnameSummaryCard component
    - Create `frontend/src/features/daily-stock-opname/components/OpnameSummaryCard.tsx`
    - Display total expected cost, total actual cost, total variance cost, completion percentage
    - _Requirements: 12.4_

  - [x] 11.4 Create VarianceIndicator component
    - Create `frontend/src/features/daily-stock-opname/components/VarianceIndicator.tsx`
    - Visual indicator for variance severity (normal, warning, critical based on threshold)
    - _Requirements: 12.5_

  - [x] 11.5 Create OpnamePhotoUpload component
    - Create `frontend/src/features/daily-stock-opname/components/OpnamePhotoUpload.tsx`
    - Upload button with preview, accepts JPEG/PNG, max 10MB
    - Show required indicator for high-risk products
    - Display existing photo thumbnail when uploaded
    - _Requirements: 4.4, 4.5, 4.6_

  - [x] 11.6 Create ResolveModal component
    - Create `frontend/src/features/daily-stock-opname/components/ResolveModal.tsx`
    - Modal with textarea for resolution_note (min 10 chars)
    - Submit calls resolve API endpoint
    - _Requirements: 8.1, 8.2_

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Configuration endpoints and UI
  - [x] 13.1 Create config section in detail page or settings page
    - Add config UI accessible from opname list page (settings icon per branch)
    - Form fields: variance_threshold_pct (number, 1-100), closing_time (time picker HH:mm), grace_period_minutes (number, 0-60)
    - Save calls PUT /api/v1/daily-stock-opname/config/:branchId
    - _Requirements: 17.1, 17.2, 17.3, 18.1, 18.2, 18.3_

- [x] 14. Dashboard widget
  - [x] 14.1 Create DashboardWidget component
    - Create `frontend/src/features/daily-stock-opname/components/DashboardWidget.tsx`
    - Display today's opname status per branch: Confirmed, In Progress, Flagged, Not Started, Missed
    - Show variance cost for confirmed/flagged sessions
    - Show completion percentage for in-progress sessions
    - Integrate into main dashboard page
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 15. Variance report and CSV export
  - [x] 15.1 Implement getDashboard() and getVarianceReport() service methods
    - `getDashboard()`: return today's status per accessible branch with MISSED/NOT_STARTED logic
    - `getVarianceReport()`: aggregate variance data across confirmed/flagged sessions with grouping
    - `exportVarianceReport()`: generate CSV buffer with UTF-8 BOM, columns: date, branch, product code, product name, expected qty, actual qty, variance qty, variance %, variance cost
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.2, 14.3, 14.4_

  - [x] 15.2 Create Variance Report Page
    - Create `frontend/src/features/daily-stock-opname/pages/OpnameVarianceReportPage.tsx`
    - Date range picker, branch filter, risk category filter
    - Group by toggle: day / week / month
    - Table: Product, Total Variance Qty, Total Variance Cost, Avg Variance %, Sessions, Flagged Count
    - Sortable columns
    - Export CSV button (triggers download)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 16. Frontend route registration
  - [x] 16.1 Register routes in App.tsx
    - Add lazy imports for DailyStockOpnamePage, DailyStockOpnameDetailPage, OpnameVarianceReportPage
    - Add Route entries with RequirePermission wrapper (module: daily_stock_opname)
    - Add navigation menu item for "Stock Opname" in sidebar
    - _Requirements: 11.1, 12.1, 13.1_

- [x] 17. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Requirement 19 (Correction of Confirmed Session) is deferred to Phase 2 per requirements
- Requirement 20 (Assumptions) documents operational prerequisites and requires no implementation
- The DPO blocking integration (task 8.1) modifies an existing module — review carefully for side effects
- Photo upload uses the existing storageService pattern (R2/S3)
- All date/time logic must use Asia/Jakarta timezone consistently

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "7.1", "7.2"] },
    { "id": 7, "tasks": ["6.4", "8.1", "9.1", "9.2"] },
    { "id": 8, "tasks": ["10.1", "10.2", "15.1"] },
    { "id": 9, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6", "14.1", "15.2"] },
    { "id": 10, "tasks": ["13.1", "16.1"] }
  ]
}
```
