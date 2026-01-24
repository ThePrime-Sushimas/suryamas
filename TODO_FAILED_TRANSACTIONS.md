# TODO: Failed Transactions Feature Implementation

## Phase 1: Backend - True Batch Insert & Transactions
- [x] 1.1 Update repository - Add `createBatchBulk` method with bulk insert (100/batch)
- [x] 1.2 Update repository - Add `createFailedTransaction` and `createFailedBatch`
- [x] 1.3 Update service - Use batch insert instead of loop one-by-one
- [x] 1.4 Add progress tracking callback for bulk operations

## Phase 2: Backend - Progress Tracking & Failed Storage
- [x] 2.1 Update `generateFromPosImportLinesOptimized` with progress callback
- [x] 2.2 Store failed transactions with FAILED status and error details
- [x] 2.3 Return progress info to caller

## Phase 3: Backend - API Endpoints for Failed Transactions
- [x] 3.1 GET /failed - List failed transactions
- [x] 3.2 GET /failed/:id - Get failed transaction details
- [x] 3.3 POST /failed/:id/fix - Fix and retry
- [x] 3.4 POST /failed/batch-fix - Batch fix
- [x] 3.5 DELETE /failed/:id - Permanently delete

## Phase 4: Frontend - Failed Transactions Page
- [x] 4.1 Create `FailedTransactionsPage.tsx`
- [x] 4.2 Create `FailedTransactionsTable.tsx` component
- [x] 4.3 Create `FailedTransactionDetailModal.tsx` for edit/fix
- [x] 4.4 Create store for failed transactions

## Phase 5: Frontend - Navigation & Integration
- [x] 5.1 Add navigation link in sidebar (Accounting menu > Failed Transactions)
- [x] 5.2 Add route in App.tsx
- [x] 5.3 Update GenerateFromImportModal to show link to failed page

## Phase 6: Testing & Validation
- [x] 6.1 Test lint - PASSED
- [x] 6.2 Test build - PASSED
- [ ] 6.3 Test failed transaction fix flow (requires running server)


