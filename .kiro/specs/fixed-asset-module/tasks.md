# Implementation Plan: Fixed Asset Module (Phase 1)

## Overview

Implement the Fixed Asset Module following the existing monorepo conventions (backend module in `backend/src/modules/fixed-assets/`, frontend feature in `frontend/src/features/fixed-assets/`). Tasks are ordered by dependency: database migration → backend types/errors/schema → repository → services → controller/routes → integration hooks → frontend pages → permission seeding.

## Tasks

- [ ] 1. Database migration and schema setup
  - [ ] 1.1 Create database migration file for all Phase 1 tables
    - Create `backend/database/migrations/20260625_create_fixed_assets_module.sql`
    - Include: `asset_categories`, `fixed_assets`, `asset_transfers`, `asset_maintenance`, `asset_disposals`, `asset_depreciation_runs`, `asset_depreciation_entries`, `asset_movements` tables
    - Add `ALTER TABLE products ADD COLUMN is_asset BOOLEAN NOT NULL DEFAULT false` with index
    - Add `ALTER TABLE products ADD COLUMN asset_category_id UUID REFERENCES asset_categories(id)`
    - Include all CHECK constraints, indexes, and UNIQUE constraints as defined in design
    - _Requirements: 1.1, 2.1, 4.3, 6.2, 7.6, 8.3, 9.1, 10.1, 12.1, 12.2_

- [ ] 2. Backend types, errors, and validation schemas
  - [ ] 2.1 Create `fixed-assets.types.ts` with all TypeScript interfaces and DTOs
    - Define: `AssetStatus`, `DepreciationMethod`, `DisposalMethod`, `MovementType`, `MaintenanceStatus`, `DepreciationRunStatus` type unions
    - Define interfaces: `FixedAsset`, `AssetCategory`, `AssetTransfer`, `AssetMaintenance`, `AssetDisposal`, `DepreciationRun`, `DepreciationEntry`, `AssetMovement`
    - Define DTOs: `CreateAssetFromGrDto`, `CreateTransferDto`, `CreateMaintenanceDto`, `CreateDisposalDto`, `DepreciationPreviewEntry`, `DepreciationRunResult`
    - _Requirements: 1.1, 4.2, 6.2, 7.6, 8.1, 9.1, 10.1, 12.2_

  - [ ] 2.2 Create `fixed-assets.errors.ts` with custom error classes
    - Define: `AssetCategoryNotFoundError`, `AssetCategoryInUseError`, `AssetCategoryDuplicateError`, `FixedAssetNotFoundError`, `AssetNotActiveError`, `AssetNotFoundForInvoiceError`, `DepreciationAlreadyPostedError`, `CrossCompanyTransferError`, `PeriodNotOpenError`, `DisposalInvalidStatusError`
    - Extend appropriate base error classes (`NotFoundError`, `ConflictError`, `BusinessRuleError`)
    - _Requirements: 1.2, 1.4, 5.6, 7.4, 8.4, 8.5, 10.6_

  - [ ] 2.3 Create `fixed-assets.schema.ts` with Zod validation schemas
    - Define schemas for: create/update category, create transfer, create maintenance, complete maintenance, create disposal, post disposal, preview depreciation, confirm depreciation, reverse depreciation
    - Include query/params schemas for list endpoints with pagination and filter params
    - _Requirements: 1.1, 8.1, 9.1, 10.1, 7.1_

- [ ] 3. Repository layer (database queries)
  - [ ] 3.1 Create `fixed-assets.repository.ts` with all CRUD operations
    - Implement asset category CRUD: `findCategories`, `findCategoryById`, `createCategory`, `updateCategory`, `softDeleteCategory`, `isCategoryInUse`
    - Implement fixed asset queries: `findAssets` (paginated with filters), `findById`, `findByGrLineId`, `findDepreciableAssets`, `capitalize`, `updateBranchId`, `incrementAccumulatedDepreciation`, `decrementAccumulatedDepreciation`, `updateStatus`, `updateJournalId`
    - Implement transfer: `createTransfer`, `findTransfers`
    - Implement maintenance: `createMaintenance`, `completeMaintenance`, `findMaintenance`, `findMaintenanceById`
    - Implement disposal: `createDisposal`, `postDisposal`, `findDisposals`, `findDisposalById`
    - Implement depreciation run: `createRun`, `findPostedRun`, `bulkInsertEntries`, `updateRunJournal`, `findRuns`, `findRunById`, `findRunEntries`
    - Implement movements: `createMovement`, `findMovementsByAsset`
    - Use early-pagination pattern for list queries with joins
    - All queries scoped by `company_id` and `deleted_at IS NULL`
    - _Requirements: 1.1, 1.2, 1.4, 4.1, 7.4, 8.1, 9.1, 10.1, 12.1, 12.5, 13.1, 13.2, 13.3_

- [ ] 4. Core service (categories CRUD, asset CRUD, code generator)
  - [ ] 4.1 Create `asset-code-generator.util.ts` for asset code generation
    - Implement `generateAssetCode(client, companyId, categoryCode, branchCode)` that produces `{category_code}-{branch_code}-{sequence}` format
    - Sequence is per-company, per-category, zero-padded to 4 digits
    - _Requirements: 4.3, 13.5_

  - [ ] 4.2 Create `fixed-assets.service.ts` with core business logic
    - Implement category CRUD with: uniqueness validation (company + code), in-use delete guard, permission checks
    - Implement `createFromGr`: creates DRAFT asset with generated code, QR code, and CAPITALIZE movement placeholder
    - Implement asset list/detail with movement history
    - Implement asset metadata update
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 4.5, 13.1, 13.2, 14.1, 14.5_

  - [ ]* 4.3 Write property tests for asset code generation and category uniqueness
    - **Property 5: Asset Code Format and Uniqueness** — generated codes match `{cat}-{branch}-{seq}` and are unique per company
    - **Property 1: Asset Category Uniqueness per Company** — duplicate category_code rejected within same company, accepted in different company
    - **Property 2: Asset Category Delete Guard** — referenced category deletion is rejected
    - **Validates: Requirements 1.2, 1.4, 4.3, 13.5**

- [ ] 5. Depreciation service
  - [ ] 5.1 Create `depreciation.service.ts` with calculation and batch run logic
    - Implement `calculateMonthlyDepreciation(asset)`: straight-line formula with 4 decimal precision and final-month remainder handling
    - Implement `executeDepreciationRun(companyId, fiscalPeriodId, mode, userId)`: preview mode (read-only) and confirm mode (persist + journal)
    - Implement idempotency check: reject confirm if POSTED run exists for same company+period
    - Implement reversal: create counter-journal and rollback accumulated_depreciation
    - Post consolidated journal: Dr 620101 / Cr per-category accumulated depreciation COA
    - Record DEPRECIATION movement entries per asset
    - Handle edge case: no eligible assets returns informational response
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 9.7, 10.8_

  - [ ]* 5.2 Write property tests for depreciation calculation
    - **Property 8: Depreciation Calculation Formula** — monthly amount = min((C-S)/L, C-S-A) rounded to 4 decimals
    - **Property 9: Depreciation Ceiling** — returns 0 when fully depreciated
    - **Validates: Requirements 6.1, 6.3, 6.5**

  - [ ]* 5.3 Write property tests for depreciation run behavior
    - **Property 10: Depreciation Run Completeness** — run produces exactly N entries for N eligible assets
    - **Property 11: Depreciation Run Idempotency** — duplicate confirm rejected
    - **Property 12: Depreciation Preview Immutability** — preview creates no side effects
    - **Property 13: Depreciation Reversal Correctness** — reversal counter-journal and rollback
    - **Validates: Requirements 7.1, 7.2, 7.4, 7.5, 9.7, 10.8**

- [ ] 6. Asset lifecycle service (capitalization, transfer, maintenance, disposal)
  - [ ] 6.1 Create `asset-lifecycle.service.ts` with lifecycle operations
    - Implement `capitalizeAssetsFromInvoice(client, invoiceId, invoiceDate, userId)`: find DRAFT assets by GR line, update cost/status/date, post Dr Asset COA / Cr AP journal, record CAPITALIZE movement
    - Implement `transferAsset(dto, userId)`: validate ACTIVE status, same-company branches, update branch_id, record TRANSFER movement, NO journal
    - Implement `recordMaintenance(dto, userId)`: validate ACTIVE status, set status to MAINTENANCE, create maintenance record, record MAINTENANCE movement
    - Implement `completeMaintenance(maintenanceId, userId)`: set asset back to ACTIVE, record MAINTENANCE_COMPLETE movement
    - Implement `postMaintenance(maintenanceId, userId)`: post Dr 620201 / Cr 210101 journal
    - Implement `createDisposal(dto, userId)`: validate ACTIVE/MAINTENANCE status, calculate gain/loss
    - Implement `postDisposal(disposalId, userId)`: post disposal journal (Dr Accum Depr + Dr Cash/Loss, Cr Asset Cost + Cr Gain), set status DISPOSED, record DISPOSAL movement
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 6.2 Write property tests for capitalization and transfer
    - **Property 6: Capitalization State Transition** — DRAFT → ACTIVE with correct journal
    - **Property 7: Capitalization Movement Audit** — CAPITALIZE movement recorded with PI reference
    - **Property 14: Transfer Branch Update Without Journal** — branch changes, no journal, TRANSFER movement recorded
    - **Property 15: Transfer Status Guard** — non-ACTIVE asset transfer rejected
    - **Property 16: Transfer Company Isolation** — cross-company transfer rejected
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3, 8.4, 8.5, 13.4**

  - [ ]* 6.3 Write property tests for maintenance, disposal, and movements
    - **Property 17: Maintenance Status Lifecycle** — ACTIVE → MAINTENANCE → ACTIVE
    - **Property 18: Maintenance Journal Correctness** — Dr 620201 / Cr 210101
    - **Property 19: Disposal Gain/Loss Calculation** — gain_loss = proceeds - (cost - accumulated_depreciation)
    - **Property 20: Disposal Journal Balance** — total debits = total credits
    - **Property 21: Disposal Status Transition** — status → DISPOSED, excluded from depreciation
    - **Property 22: Disposal Status Guard** — DRAFT/DISPOSED assets cannot be disposed
    - **Property 24: Movement Immutability** — update/delete on movements rejected
    - **Validates: Requirements 9.2, 9.3, 9.4, 10.2, 10.3, 10.4, 10.6, 10.8, 12.5**

- [ ] 7. QR code utility
  - [ ] 7.1 Create `qr-code.util.ts` for QR code generation
    - Implement `generateQrCode(assetId)`: generate QR as data URL encoding `{FRONTEND_URL}/fixed-assets/{assetId}`
    - Implement `generateBulkQrPdf(assets)`: generate PDF with QR grid (4 cols × 7 rows per A4 page) using pdfkit + qrcode libraries
    - Install `qrcode` and `pdfkit` packages as dependencies
    - _Requirements: 11.1, 11.2, 11.4, 11.5_

  - [ ]* 7.2 Write property test for QR code format
    - **Property 23: QR Code Generation** — qr_code_url non-null, encoded data matches `{base_url}/fixed-assets/{asset_id}`
    - **Validates: Requirements 11.1, 11.5**

- [ ] 8. Controller and routes
  - [ ] 8.1 Create `fixed-assets.controller.ts` with HTTP request handlers
    - Implement handlers for all API endpoints: asset categories CRUD, fixed assets list/detail/update, transfers create/list, maintenance create/complete/post/list, disposals create/post/list, depreciation runs preview/confirm/reverse/list, movements list, QR regenerate, bulk QR PDF
    - Use `validateSchema` middleware for input validation
    - Use `handleError` + `sendSuccess`/`sendError` for responses
    - Use `req.validated.body/params/query` pattern
    - _Requirements: 1.1, 7.1, 8.1, 9.1, 10.1, 11.4, 14.1_

  - [ ] 8.2 Create `fixed-assets.routes.ts` with Express router setup
    - Register all routes with auth middleware and permission checks
    - Map routes to controller methods following the API endpoint design table
    - Register `fixed_assets` module in permission system with actions: view, insert, update, delete, approve
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 8.3 Register fixed-assets routes in `backend/src/app.ts`
    - Import and mount the fixed-assets router at `/api/v1/` prefix
    - Follow existing module registration pattern
    - _Requirements: 14.1_

- [ ] 9. Checkpoint - Backend core complete
  - Ensure all backend files compile without TypeScript errors, ask the user if questions arise.

- [ ] 10. Integration hooks with GR and PI modules
  - [ ] 10.1 Add asset creation hook in Goods Receipt confirmation
    - Modify `backend/src/modules/goods-receipts/goods-receipts.service.ts` → `confirmGoodsReceipt()`
    - For each GR line where product `is_asset = true`: create N Fixed_Asset DRAFT records (one per unit), skip `stock_balance` insert
    - Call `fixedAssetService.createFromGr()` for each unit
    - _Requirements: 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 10.2 Add capitalization hook in Purchase Invoice posting
    - Modify `backend/src/modules/purchase-invoices/purchase-invoices.service.ts` → `postInvoice()`
    - After cost allocation, check if any lines are for asset products
    - If yes, call `assetLifecycleService.capitalizeAssetsFromInvoice(client, invoiceId, invoiceDate, userId)`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 10.3 Write property tests for integration hooks
    - **Property 3: Asset Product Routing** — is_asset product creates DRAFT assets, no stock_balance insert
    - **Property 4: One Asset Record per Unit** — qty N produces exactly N records
    - **Validates: Requirements 2.2, 2.3, 4.1, 4.4, 4.5**

- [ ] 11. Checkpoint - Backend integration complete
  - Ensure GR and PI hooks work end-to-end, all tests pass, ask the user if questions arise.

- [ ] 12. Frontend: API service and types
  - [ ] 12.1 Create `frontend/src/features/fixed-assets/api/fixed-assets.api.ts`
    - Implement Axios API functions for all endpoints: categories CRUD, assets list/detail, transfers, maintenance, disposals, depreciation runs, QR code
    - Define response types matching backend DTOs
    - _Requirements: 1.1, 7.1, 8.1, 9.1, 10.1, 11.1_

  - [ ] 12.2 Create `frontend/src/features/fixed-assets/types/fixed-asset.types.ts`
    - Define frontend TypeScript types mirroring backend interfaces
    - _Requirements: 1.1_

  - [ ] 12.3 Create `frontend/src/features/fixed-assets/utils/fixedAssetFilters.url.ts`
    - Define `FixedAssetFilters` type and filter config using `useUrlFilters` pattern
    - Include: status, category, branch, search, date_from, date_to, page, limit
    - _Requirements: 13.1_

- [ ] 13. Frontend: Asset Categories page
  - [ ] 13.1 Create `AssetCategoriesPage.tsx` with CRUD table
    - List categories with inline create/edit modal
    - Fields: category_code, category_name, asset COA, depreciation expense COA, accumulated depreciation COA, default useful_life_months
    - Use TanStack Query for data fetching
    - Apply `useUrlFilters` for pagination
    - _Requirements: 1.1, 1.5, 14.1_

- [ ] 14. Frontend: Fixed Assets list and detail pages
  - [ ] 14.1 Create `FixedAssetsPage.tsx` with paginated, filterable asset list
    - Show: asset_code, asset_name, category, branch, status badge, book_value, acquisition_date
    - Filters: status, category, branch, search
    - Use `useUrlFilters` with `fixedAssetFilters.url.ts` config
    - Use `useListNavigation` for detail navigation
    - _Requirements: 13.1, 14.1_

  - [ ] 14.2 Create `FixedAssetDetailPage.tsx` with asset info and movement timeline
    - Display full asset details: cost, salvage value, useful life, accumulated depreciation, book value, QR code
    - Show `AssetMovementTimeline` component with chronological history
    - Include action buttons: Transfer, Maintenance, Dispose (based on status and permissions)
    - _Requirements: 11.3, 12.1, 12.3, 14.1_

- [ ] 15. Frontend: Asset Request page
  - [ ] 15.1 Create `AssetRequestPage.tsx` for asset purchase requests
    - Reuse existing PR form pattern but filter products to `is_asset = true` only
    - Set PO payment_type to CREDIT on conversion
    - Apply `fixed_assets:insert` permission guard
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 16. Frontend: Depreciation Run page
  - [ ] 16.1 Create `DepreciationRunPage.tsx` with preview and confirm workflow
    - Fiscal period selector, Preview button showing per-asset depreciation table
    - Confirm button to post batch journal
    - Show run history list with status badges (PREVIEW, POSTED, REVERSED)
    - Reverse button for posted runs
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7_

- [ ] 17. Frontend: Transfer, Maintenance, and Disposal pages
  - [ ] 17.1 Create `AssetTransfersPage.tsx` with transfer list and create form
    - Transfer form: select asset (ACTIVE only), select destination branch (same company), reason
    - List shows transfer history with source/destination
    - _Requirements: 8.1, 8.4, 8.5, 8.6_

  - [ ] 17.2 Create `AssetMaintenancePage.tsx` with maintenance list and actions
    - Create form: select asset, date, description, vendor, cost, reference
    - Complete and Post action buttons
    - Status badges: IN_PROGRESS, COMPLETED, POSTED
    - _Requirements: 9.1, 9.3, 9.4, 9.6_

  - [ ] 17.3 Create `AssetDisposalsPage.tsx` with disposal list and create/post workflow
    - Create form: select asset (ACTIVE/MAINTENANCE), method (SOLD/SCRAPPED/DONATED), proceeds, date
    - Show calculated gain/loss preview before posting
    - Post button with journal confirmation
    - _Requirements: 10.1, 10.3, 10.6, 10.7_

- [ ] 18. Frontend: Menu, routing, and permission registration
  - [ ] 18.1 Register routes in `App.tsx` and sidebar menu configuration
    - Add lazy-loaded routes for all fixed-asset pages in `App.tsx`
    - Add "Aset Tetap" menu group in `frontend/src/components/layout/menu.config.tsx` with sub-items: Daftar Aset, Kategori Aset, Request Aset, Penyusutan, Transfer Aset, Pemeliharaan, Pelepasan
    - Wrap routes with `RequirePermission` using appropriate permission levels
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 19. Permission seeding and default category data
  - [ ] 19.1 Create seed script for fixed_assets permissions and default categories
    - Seed `fixed_assets` module permissions: view, insert, update, delete, approve
    - Seed default asset categories per company: BLD (240mo), FRN (60mo), KTE (60mo), ITE (48mo), VCL (60mo)
    - Add to existing seeder pattern in `backend/src/seeds/`
    - _Requirements: 1.3, 14.1_

- [ ] 20. Data migration from Supabase (1200 existing asset records)
  - [ ] 20.1 Create migration script to download photos from Supabase Storage and upload to S3
    - Batch download 1200 asset photos from Supabase public URLs (bucket: `asset-photos`)
    - Supabase project URL and anon key available in backend `.env` (keys: `SUPABASE_URL`, `SUPABASE_ANON_KEY`)
    - Re-upload to AWS S3 bucket (same bucket used by existing file upload system)
    - Generate new S3 URLs for each photo
    - Create a mapping file: `{ old_supabase_url: new_s3_url }` for use in data migration
    - Handle missing/broken photo URLs gracefully (log and skip)
    - Script location: `backend/src/seeds/migrate-asset-photos.ts`

  - [ ] 20.2 Create data migration script from Supabase asset table to fixed_assets
    - Read 1200 records from Supabase (via direct DB connection or exported JSON)
    - Map `id_branch` (24-34) to `branches.id` (UUID) in our system using `kode_branch` lookup:
      - 24 → JAK729 (Sushimas Condet)
      - 25 → BEK516 (Sushimas Grand Galaxy)
      - 26 → DEP464 (Sushimas Depok)
      - 27 → TAN624 (Sushimas Serpong)
      - 28 → BOG853 (Sushimas Cibinong)
      - 29 → BEK068 (Sushimas Grand Wisata)
      - 30 → BEK458 (Sushimas Harapan Indah)
      - 31 → JAK672 (CENTRAL - CONDET)
      - 32 → BEK261 (CENTRAL - GRANDWIS)
      - 34 → JAK957 (CENTRAL SAUCE KRAMAT JATI)
    - Field mapping:
      - `asset_name` → `asset_name`
      - `purchase_date` → `acquisition_date` (fallback to `created_at` if null)
      - `location` → `location_note`
      - `status` ACTIVE → ACTIVE (skip jurnal, data historis)
      - `photo_url` → new S3 URL from mapping (task 20.1)
      - `cost` = 0, `salvage_value` = 0 (no price data available)
      - `useful_life_months` = 60 (default, can be adjusted later)
      - `asset_category_id` = default KTE (Kitchen Equipment) for all — user can re-categorize later
      - `quantity > 1` → create separate records per unit
      - `condition` → `notes`
      - `serial_number` → preserve if not null
    - Auto-generate `asset_code` per new pattern: `{category_code}-{branch_code}-{seq}`
    - Generate QR code for each migrated asset
    - Record initial CAPITALIZE movement (type: COST_ADJUSTMENT, notes: "Migrated from Supabase")
    - Add `photo_url TEXT` field to `fixed_assets` table in migration (task 1.1) for storing asset photos
    - Script location: `backend/src/seeds/migrate-supabase-assets.ts`

- [ ] 21. Final checkpoint - Full module complete
  - Ensure all tests pass, frontend compiles, routes are accessible, and permissions work end-to-end. Ask the user if questions arise.

- [ ]* 22. Multi-company isolation property test
  - [ ]* 22.1 Write property test for multi-company data isolation
    - **Property 25: Multi-Company Data Isolation** — queries by user in company A return zero records from company B
    - **Validates: Requirements 13.1, 13.2, 13.3**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The module follows existing conventions: controller/service/repository/schema/types/errors/routes
- QR code uses `qrcode` npm package (data URL, no external service)
- Bulk QR PDF uses `pdfkit` npm package
- All monetary fields use NUMERIC(20,4) precision
- Integration hooks in GR and PI services must be added carefully within existing transaction boundaries

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1", "4.1", "7.1"] },
    { "id": 3, "tasks": ["4.2", "5.1", "4.3", "7.2"] },
    { "id": 4, "tasks": ["6.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["8.1", "6.2", "6.3"] },
    { "id": 6, "tasks": ["8.2"] },
    { "id": 7, "tasks": ["8.3"] },
    { "id": 8, "tasks": ["10.1", "10.2"] },
    { "id": 9, "tasks": ["10.3", "12.1", "12.2", "12.3"] },
    { "id": 10, "tasks": ["13.1", "14.1", "15.1", "16.1"] },
    { "id": 11, "tasks": ["14.2", "17.1", "17.2", "17.3"] },
    { "id": 12, "tasks": ["18.1", "19.1"] },
    { "id": 13, "tasks": ["20.1"] },
    { "id": 14, "tasks": ["20.2"] },
    { "id": 15, "tasks": ["22.1"] }
  ]
}
```
