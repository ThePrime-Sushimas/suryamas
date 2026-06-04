# Implementation Plan: Opname Reopen

## Overview

Extend the existing `daily-stock-opname` module with a request–approval workflow enabling PICs to request re-editing of confirmed/flagged sessions. Implementation covers database migration, backend service/repository/controller/routes, notification integration, and frontend components (button, approval panel, status badge).

## Tasks

- [x] 1. Database migration and schema changes
  - [x] 1.1 Create migration file for `opname_reopen_requests` table, status constraint update, and movement types
    - Create `backend/database/migrations/20260619_opname_reopen_requests.sql`
    - Define `opname_reopen_requests` table with columns: id (UUID PK), closing_id (FK), requested_by (FK), requested_at, reason, status (CHECK PENDING/APPROVED/REJECTED), responded_by, responded_at, response_note, created_at, updated_at
    - Add indexes on `closing_id` and `status`
    - ALTER `daily_closing_counts` status CHECK to include `REOPENED`
    - Add `IN_REVERSAL` and `OUT_REVERSAL` to `stock_movements` movement_type constraint
    - _Requirements: 9.1, 10.1_

- [x] 2. Backend repository layer
  - [x] 2.1 Create `daily-stock-opname-reopen.repository.ts`
    - Implement `withTransaction`, `insertRequest`, `findPendingByClosingId`, `findById`, `findByIdWithRelations`, `findByClosingId`, `updateStatus`, `getMovementsByClosingId` methods
    - Use parameterized queries; join `employees`, `daily_closing_counts`, `branches` for relation queries
    - Export singleton `reopenRepository` instance
    - _Requirements: 9.1, 9.2, 5.1_

- [x] 3. Backend service layer
  - [x] 3.1 Create `daily-stock-opname-reopen.service.ts`
    - Implement `createReopenRequest`: validate session status (CONFIRMED/FLAGGED), check no pending request exists, insert request, dispatch notification, audit log
    - Implement `approveReopenRequest`: validate request is PENDING, check approve permission, execute transaction (update status → create counter-movements → update stock balances → delete classifications → set session REOPENED), audit log
    - Implement `rejectReopenRequest`: validate request is PENDING, check approve permission, update status, audit log
    - Implement `getReopenRequests`: return all requests for a session
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1–5.5, 6.1, 6.2, 9.3_

  - [x] 3.2 Modify existing `daily-stock-opname.service.ts` for REOPENED status
    - In `confirmSession`: allow REOPENED status (in addition to DRAFT), skip time restriction and expiry check when status is REOPENED
    - In `updateLine` and `bulkUpdateLines`: allow REOPENED status (in addition to DRAFT), skip time restriction and expiry check when status is REOPENED
    - Ensure DPO blocking still applies for REOPENED re-confirmation
    - _Requirements: 7.1, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4_

- [x] 4. Backend validation schemas and error classes
  - [x] 4.1 Add Zod schemas and error classes for reopen endpoints
    - Add `createReopenRequestSchema`, `respondReopenRequestSchema`, `getReopenRequestsSchema` to `daily-stock-opname.schema.ts`
    - Add `OpnameNotEligibleForReopenError`, `OpnameReopenPendingExistsError`, `OpnameReopenAlreadyRespondedError`, `OpnameReopenNotFoundError` to `daily-stock-opname.errors.ts`
    - _Requirements: 1.2, 1.3, 1.4, 3.3_

- [x] 5. Backend controller and routes
  - [x] 5.1 Add reopen controller methods and route definitions
    - Add `createReopenRequest`, `approveReopenRequest`, `rejectReopenRequest`, `getReopenRequests` handler methods to `daily-stock-opname.controller.ts`
    - Register 4 new routes in `daily-stock-opname.routes.ts`: POST `/:id/reopen-request`, POST `/reopen-requests/:id/approve`, POST `/reopen-requests/:id/reject`, GET `/:id/reopen-requests`
    - Apply `validateSchema` middleware with corresponding schemas
    - Apply auth middleware with appropriate permission checks
    - _Requirements: 1.1, 3.1, 4.1, 9.1_

- [x] 6. Notification event registration
  - [x] 6.1 Register `OPNAME_REOPEN_REQUESTED` notification event
    - Add `OPNAME_REOPEN_REQUESTED` key to `NOTIFICATION_EVENT_KEYS` in `notification-events.ts`
    - Add event catalog entry with label, description, category `inventory`, message template including `pic_name`, `branch_name`, `closing_date`, `reason`
    - Set redirect URL template to `/inventory/daily-stock-opname/{{session_id}}`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 7. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Frontend API hooks
  - [x] 8.1 Add TanStack Query hooks for reopen endpoints
    - Create hooks in `frontend/src/features/daily-stock-opname/api/dailyStockOpname.ts`: `useCreateReopenRequest`, `useApproveReopenRequest`, `useRejectReopenRequest`, `useReopenRequests`
    - Add query key `reopenRequests: (id: string) => ['daily-stock-opname', id, 'reopen-requests']`
    - Invalidate detail and reopen-requests queries on mutation success
    - _Requirements: 1.1, 3.1, 4.1_

- [x] 9. Frontend components
  - [x] 9.1 Create `ReopenRequestButton` component
    - Create `frontend/src/features/daily-stock-opname/components/ReopenRequestButton.tsx`
    - Show "Minta Izin Edit" button when session is CONFIRMED/FLAGGED, current user is PIC, and no PENDING request exists
    - Open dialog with textarea for reason, validate non-empty before submit
    - Call `useCreateReopenRequest` mutation, show toast on success/error
    - _Requirements: 1.1, 1.4_

  - [x] 9.2 Create `ReopenApprovalPanel` component
    - Create `frontend/src/features/daily-stock-opname/components/ReopenApprovalPanel.tsx`
    - Display when PENDING request exists and current user has `approve` permission
    - Show requester name, reason, timestamp
    - Provide Approve/Reject buttons with optional response_note textarea
    - Call `useApproveReopenRequest` / `useRejectReopenRequest` mutations
    - _Requirements: 3.1, 4.1_

  - [x] 9.3 Extend status badge for REOPENED status
    - Update status label mapping to include `REOPENED: 'Sedang Diedit Ulang'`
    - Update status color mapping to include `REOPENED: 'blue'`
    - Ensure badge renders correctly in list and detail pages
    - _Requirements: 10.2_

  - [x] 9.4 Integrate reopen components in `DailyStockOpnameDetailPage`
    - Import and render `ReopenRequestButton` in the detail page action area
    - Import and render `ReopenApprovalPanel` below session header when applicable
    - Show reopen request history (audit trail) section using `useReopenRequests`
    - Ensure REOPENED session shows edit form (same as DRAFT behavior)
    - _Requirements: 7.1, 7.2, 10.2_

- [x] 10. Checkpoint - Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 11. Property-based tests
  - [ ]* 11.1 Write property test for reopen request creation guard
    - **Property 1: Only eligible statuses (CONFIRMED/FLAGGED) allow request creation**
    - **Validates: Requirements 1.2**

  - [ ]* 11.2 Write property test for at-most-one PENDING invariant
    - **Property 2: Sessions with existing PENDING request reject new requests**
    - **Validates: Requirements 1.3**

  - [ ]* 11.3 Write property test for empty reason rejection
    - **Property 3: Whitespace-only or empty reason strings are rejected**
    - **Validates: Requirements 1.4**

  - [ ]* 11.4 Write property test for approval state transitions
    - **Property 4: Approval transitions session to REOPENED**
    - **Property 5: Non-PENDING requests cannot be responded to**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 11.5 Write property test for rejection behavior
    - **Property 6: Rejection preserves session status**
    - **Property 7: Rejection unblocks new request creation**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 11.6 Write property test for counter-movement correctness
    - **Property 8: Counter-movement correctness on reopen (N movements → N counter-movements with correct types/qty/cost)**
    - **Property 9: Stock balance net-zero after reversal**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [ ]* 11.7 Write property test for classification cleanup
    - **Property 10: All classification entries deleted on REOPENED transition**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 11.8 Write property test for REOPENED session editing and re-confirmation
    - **Property 11: REOPENED sessions bypass time restrictions**
    - **Property 12: Reopen preserves actual_qty values**
    - **Property 13: DPO blocking applies to REOPENED re-confirmation**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [ ]* 11.9 Write property test for re-confirmation correctness
    - **Property 14: Re-confirmation produces correct movements**
    - **Property 15: Re-confirmation status determination**
    - **Property 16: Re-confirmation cost total correctness**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 11.10 Write property test for duplicate session prevention
    - **Property 17: REOPENED status blocks duplicate session creation**
    - **Validates: Requirements 10.3**

- [x] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The existing `confirmSession` flow handles re-confirmation — only status/time checks need modification
- Stock movement reversal must run within a single transaction to ensure atomicity
- The existing duplicate session check naturally blocks new sessions when one is REOPENED

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "4.1"] },
    { "id": 2, "tasks": ["3.1", "3.2", "6.1"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["8.1"] },
    { "id": 5, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 6, "tasks": ["9.4"] },
    { "id": 7, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6", "11.7", "11.8", "11.9", "11.10"] }
  ]
}
```
