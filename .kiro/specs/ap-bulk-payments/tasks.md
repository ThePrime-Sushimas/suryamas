# Implementation Plan: AP Bulk Payments

## Overview

This plan implements bulk payment capabilities for the AP Payments module. The implementation proceeds in layers: database schema first, then backend API endpoints, then frontend components (filters, outstanding tab, bulk create page, summary panel), and finally integration wiring. Each task builds incrementally on previous work.

## Tasks

- [x] 1. Database schema and backend foundation
  - [x] 1.1 Create database migration for ap_payment_batches table and ap_payments column
    - Create migration file `backend/database/migrations/20260522_ap_payment_batches.sql`
    - Add `ap_payment_batches` table with id, created_by, created_at, total_payments, total_amount, notes columns
    - Add `bulk_payment_batch_id` nullable UUID column to `ap_payments` with FK reference
    - Add index on `ap_payment_batches(created_by)`
    - Add partial index on `ap_payments(bulk_payment_batch_id) WHERE bulk_payment_batch_id IS NOT NULL`
    - Insert permission entry `('bank_accounts', 'view_balance')`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 1.2 Add bulk payment types and error classes to backend ap-payments module
    - Add `BulkCreateApPaymentDto`, `BulkCreateApPaymentResponse`, `OutstandingInvoicesQuery`, `OutstandingInvoiceRow`, `OutstandingInvoicesResponse` interfaces to `ap-payments.types.ts`
    - Add error classes `ApBulkInvoiceNotFoundError`, `ApBulkInvoiceNotEligibleError`, `ApBulkOutstandingExceededError`, `ApBulkEmptyPaymentsError` to `ap-payments.errors.ts`
    - _Requirements: 9.5, 9.6, 11.3_

  - [x] 1.3 Add Zod validation schemas for bulk payment endpoints
    - Add `bulkCreateApPaymentSchema` validating payments array, batch_notes (max 500), invoice_lines
    - Add `outstandingInvoicesQuerySchema` validating page, limit (1-100), search (max 100), date params, supplier_id, branch_id
    - Add `bulk_only` query param to existing ap-payments list schema
    - _Requirements: 9.4, 11.2, 10.3_

- [x] 2. Backend outstanding invoices endpoint
  - [x] 2.1 Implement repository method for paginated outstanding invoices
    - Add `findOutstandingPaginated` method to `ap-payments.repository.ts`
    - Query purchase_invoices with status IN ('APPROVED', 'POSTED') and remaining_amount > 0
    - Join suppliers for name and bank accounts, join branches for branch_name
    - Calculate `aging_days` as `CURRENT_DATE - due_date` (positive = overdue, null when due_date is null)
    - Support filtering by supplier_id, branch_id, date_from, date_to, search (ILIKE on invoice_number and supplier_name)
    - Return paginated results sorted by due_date ASC NULLS LAST
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 2.2 Implement service method for outstanding invoices
    - Add `getOutstandingInvoicesPaginated` method to `ap-payments.service.ts`
    - Accept companyId, query params, and optional branchIds for branch filtering
    - Call repository method and return data with pagination metadata
    - _Requirements: 11.1, 11.6_

  - [x] 2.3 Add controller and route for GET /ap/invoices/outstanding
    - Add controller method handling request validation and response formatting
    - Register route with auth middleware and validateSchema middleware
    - Return paginated response with `data` array and `pagination` object
    - _Requirements: 11.1, 11.2, 11.6_

  - [ ]* 2.4 Write unit tests for outstanding invoices repository query building
    - Test filtering by supplier_id, branch_id, date range, search
    - Test pagination calculation (page, limit, total, totalPages)
    - Test aging_days calculation for overdue, upcoming, and null due dates
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

- [x] 3. Backend bulk payment creation endpoint
  - [x] 3.1 Implement repository methods for bulk payment creation
    - Add `createBatch` method to insert into `ap_payment_batches`
    - Add `createBulkPayments` method to insert N `ap_payments` records with `bulk_payment_batch_id`
    - Add `validateInvoicesForBulk` method to check invoice existence, eligibility, and remaining amounts
    - Use parameterized queries for all operations
    - _Requirements: 9.5, 12.1, 12.2_

  - [x] 3.2 Implement service method for bulk payment creation
    - Add `createBulk` method to `ap-payments.service.ts`
    - Validate empty payments array → throw `ApBulkEmptyPaymentsError`
    - Validate all invoice IDs exist and are eligible → throw appropriate errors
    - Validate amount_paid does not exceed remaining_amount → throw `ApBulkOutstandingExceededError`
    - Execute within single PostgreSQL transaction: create batch → create N payments (status DRAFT) → create invoice lines
    - Generate payment_number for each payment using existing numbering logic
    - Return `BulkCreateApPaymentResponse` with batch_id, total_payments, total_amount, payments array
    - _Requirements: 9.4, 9.5, 9.6_

  - [x] 3.3 Add controller and route for POST /ap-payments/bulk
    - Add controller method with request validation using `bulkCreateApPaymentSchema`
    - Register route with auth middleware
    - Return 201 with batch response on success, 400 with error codes on validation failure
    - _Requirements: 9.4, 9.5, 9.6_

  - [x] 3.4 Extend GET /ap-payments to support bulk_only filter and return bulk_payment_batch_id
    - Add `bulk_only` query parameter handling to existing list endpoint
    - When `bulk_only=true`, add WHERE clause `bulk_payment_batch_id IS NOT NULL`
    - Include `bulk_payment_batch_id` in response items
    - _Requirements: 10.3, 10.4_

  - [ ] 3.5 Write property test for bulk creation atomicity (Property 12)
    - **Property 12: Bulk creation atomicity**
    - For any valid bulk payment request with N payment groups, verify exactly 1 batch record and N payment records are created in a single transaction; if validation fails, verify zero records are created
    - **Validates: Requirements 9.5**

  - [ ] 3.6 Write property test for bulk submission payload grouping (Property 11)
    - **Property 11: Bulk submission payload grouping**
    - For any valid set of invoice assignments, verify the bulk payment payload groups invoices into payment objects by unique (supplier_id, bank_account_id) pairs, where each payment's total_amount equals the sum of its invoice line amount_paid values
    - **Validates: Requirements 9.4**

- [x] 4. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Frontend URL filter extensions
  - [x] 5.1 Extend ApPaymentFilters type and useApPaymentFilters hook with new fields
    - Add `dateFrom`, `dateTo`, `bulkOnly` fields to the filter type
    - Add `date_from`, `date_to`, `bulk_only` URL param serialization/parsing
    - Ensure defaults: dateFrom="" (empty), dateTo="" (empty), bulkOnly=false
    - Ensure page resets to 1 when dateFrom, dateTo, or bulkOnly changes
    - _Requirements: 1.1, 1.4, 1.5, 2.1_

  - [x] 5.2 Add date range filter inputs to AP Payments page filter row
    - Add two HTML date inputs (type="date") for dateFrom and dateTo
    - Display inline validation message when dateFrom > dateTo
    - Block API request when date range is invalid
    - Wire to useApPaymentFilters hook for URL persistence
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 5.3 Add "Bulk only" toggle filter and bulk badge to payment list
    - Add toggle/checkbox for "Bulk only" filter in filter row
    - Pass `bulk_only` param to API when active
    - Display `BulkBadge` component on payments with `bulk_payment_batch_id`
    - Badge styling: bg-violet-100 text-violet-700 / dark: bg-violet-900/30 text-violet-300
    - Badge text: "BULK · Batch #" + first 4 chars of batch_id
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 5.4 Write property tests for URL filter round-trip (Properties 1-4)
    - **Property 1: URL filter round-trip preservation**
    - **Property 2: Default filter omission**
    - **Property 3: Page reset on filter change**
    - **Property 4: Invalid URL parameter fallback**
    - Use fast-check to generate arbitrary filter combinations and verify serialization/parsing invariants
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

  - [ ]* 5.5 Write property test for date range validation (Property 5)
    - **Property 5: Date range validation**
    - For any pair of date strings where dateFrom > dateTo, verify validation returns error and API query is not constructed
    - **Validates: Requirements 2.5**

- [x] 6. Frontend Excel export
  - [x] 6.1 Implement Excel export functionality on AP Payments page
    - Add "Export" button in header area aligned with Dashboard and Create Payment buttons
    - On click, fetch all payments matching current filters (no pagination limit)
    - Generate .xlsx file using SheetJS with columns: No. Pembayaran, Supplier, Cabang, Metode, Bank Account, Total, Status, Tanggal Bayar
    - Filename format: `ap-payments-{YYYY-MM-DD}.xlsx`
    - Disable Export button and show loading indicator during generation
    - Show error toast on failure, re-enable button
    - Disable Export button when no data matches filters
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 7. Frontend Outstanding Invoices tab
  - [x] 7.1 Create useOutstandingInvoicesPaginated hook
    - Wrap TanStack Query for GET /ap/invoices/outstanding endpoint
    - Accept OutstandingInvoicesQuery params
    - Return paginated data with loading/error states
    - _Requirements: 11.1, 4.2_

  - [x] 7.2 Create AgingBadge component
    - Accept dueDate prop
    - Render red badge when due_date < today (overdue)
    - Render amber badge when due_date is today or within next 7 days inclusive
    - Render gray badge when due_date > 7 days from today
    - _Requirements: 4.4_

  - [x] 7.3 Implement OutstandingInvoicesTab component with selection logic
    - Add "Invoice Outstanding" tab to AP Payments page tab bar
    - Render paginated table with columns: checkbox, invoice number, supplier name + bank accounts, branch, total amount, remaining amount, due date + AgingBadge, status
    - Default page size 10, sorted by due_date ascending
    - Implement checkbox selection with cross-page persistence (React state)
    - Enforce max 50 invoice selection limit with message when reached
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.9, 4.10_

  - [x] 7.4 Implement sticky action bar for invoice selection
    - Show sticky bar fixed at bottom when selections exist
    - Display: selected count, total remaining amount (formatted currency), "Batal" button, "Proses Pembayaran" button
    - "Batal" clears all selections and hides bar
    - "Proses Pembayaran" stores IDs in sessionStorage("bulk_selected_invoices") and navigates to `/finance/ap-payments/bulk-create`
    - _Requirements: 4.5, 4.6, 4.7, 4.8_

  - [ ]* 7.5 Write property tests for aging badge and selection (Properties 6, 7)
    - **Property 6: Aging badge classification**
    - For any due date, verify correct color assignment (red/amber/gray)
    - **Property 7: Selection count invariant**
    - For any set of checked invoices, verify sticky bar total equals sum of remaining_amount and count equals number of checked invoices
    - **Validates: Requirements 4.4, 4.6, 4.9**

- [x] 8. Checkpoint - Filters, export, and outstanding tab complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend Bulk Create page - layout and state
  - [x] 9.1 Create useBulkCreateState hook for page state management
    - Implement with useReducer or Zustand slice
    - Manage: invoices map, assignments (checked, bankAccountId), groupNotes
    - Derive: checkedInvoices, supplierGroups (sorted alphabetically), bankAccountUsage, grandTotal, paymentCount
    - paymentCount = distinct (supplier_id, bank_account_id) combos among checked invoices
    - _Requirements: 5.6, 6.1, 6.2, 8.1, 8.7_

  - [x] 9.2 Create useCompanyBankAccounts hook
    - Fetch company bank accounts from API
    - Optionally include balance based on permission check
    - Return accounts array with loading/error states
    - _Requirements: 6.3, 7.1_

  - [x] 9.3 Create BulkCreatePage shell with routing and session storage handling
    - Register route at `/finance/ap-payments/bulk-create` with ap_payments permission
    - Read invoice IDs from sessionStorage("bulk_selected_invoices")
    - Redirect to `/finance/ap-payments` if no IDs or empty array
    - Fetch invoice data from API using IDs
    - Show error with retry on fetch failure
    - Display header "Buat Pembayaran Massal" with Cancel button
    - Two-column layout at md+ breakpoint (left flex-1, right w-80), stacked below md
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.9_

  - [ ]* 9.4 Write property test for supplier grouping completeness (Property 8)
    - **Property 8: Supplier grouping completeness**
    - For any set of selected invoices, verify grouping by supplier_id produces groups where union equals original set with no duplicates or omissions
    - **Validates: Requirements 5.6**

  - [ ]* 9.5 Write property test for payment count calculation (Property 10)
    - **Property 10: Payment count calculation**
    - For any set of checked invoices with bank accounts assigned, verify payment count equals number of distinct (supplier_id, bank_account_id) combinations
    - **Validates: Requirements 8.7**

- [x] 10. Frontend Bulk Create page - supplier groups and bank account selection
  - [x] 10.1 Create BankAccountSelector component
    - Display bank name, account number per option
    - Show balance + sufficiency indicator (✓/⚠️) when canViewBalance=true
    - Show "🔒 Saldo tidak ditampilkan" when canViewBalance=false
    - Support disabled state, error highlighting (border-red-300 bg-red-50/50)
    - _Requirements: 6.3, 7.2, 7.3_

  - [x] 10.2 Create SupplierGroupCard component
    - Display supplier name, supplier bank account info
    - "Apply to all" dropdown that sets bank account for all checked invoices in group
    - Invoice table with: checkbox, invoice number, remaining amount, due date, BankAccountSelector
    - Notes text input at footer with placeholder "Catatan untuk supplier ini (opsional)", max 500 chars
    - Subtotal display for the group
    - _Requirements: 5.7, 5.8, 6.4, 6.6, 13.1_

  - [x] 10.3 Wire SupplierGroupCard into BulkCreatePage left column
    - Render one SupplierGroupCard per supplier group from useBulkCreateState
    - Connect checkbox toggle, bank account change, apply-all, and notes handlers
    - When checkbox unchecked, clear bank account selection for that row
    - Handle bank accounts API failure: disable all selectors, show error
    - _Requirements: 5.6, 6.1, 6.2, 6.5, 6.7_

  - [ ]* 10.4 Write property test for apply-all propagation (Property 9)
    - **Property 9: Apply-all bank account propagation**
    - For any supplier group with N checked invoices, verify "Apply to all" sets bank account on exactly N checked invoices, leaving unchecked invoices with null
    - **Validates: Requirements 6.4**

- [x] 11. Frontend Summary Panel and submission
  - [x] 11.1 Create SummaryPanel component
    - Display: supplier count, invoice count, grand total (formatted currency, 2 decimals)
    - Display bank account usage: only accounts assigned to checked invoices, showing bank name, account number, used amount
    - When canViewBalance: show balance, show warning when used > balance
    - When !canViewBalance: hide balance, suppress warnings
    - Sticky positioning (top-4) at lg+ breakpoint, normal flow below
    - Submit button: "Buat X Pembayaran" where X = paymentCount
    - Disable submit when: no invoices checked, or (canViewBalance AND insufficient balance)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 7.4, 7.5_

  - [x] 11.2 Implement bulk payment submission flow
    - On submit click: validate all checked invoices have bank account → highlight errors, scroll to first
    - When canViewBalance: validate no account exceeds balance
    - Show confirmation dialog with payment count and grand total, "Konfirmasi" and "Batal" actions
    - On confirm: build payload grouped by (supplier_id, bank_account_id), include group notes per supplier
    - POST to `/ap-payments/bulk` with batch_notes and payments array
    - On success: clear sessionStorage, redirect to `/finance/ap-payments`, show success toast with first 4 chars of batch_id
    - On backend validation error: display error message listing invalid invoices, retain form
    - On network error: show error toast, retain form state
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7, 9.8, 13.2, 13.3_

  - [ ]* 11.3 Write property test for bank account usage aggregation (Property 13)
    - **Property 13: Bank account usage aggregation**
    - For any set of invoice assignments, verify summary panel shows each assigned bank account exactly once with usedAmount equal to sum of remaining_amount for all invoices assigned to that account
    - **Validates: Requirements 8.2, 8.3**

- [x] 12. Final checkpoint - Full feature integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (13 properties total)
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout (React 19 + Vite frontend, Node.js/Express backend)
- fast-check library is used for property-based tests
- SheetJS (xlsx) is used for Excel export (already available in project)
- TanStack Query for server state, Zustand or useReducer for local form state

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["2.3", "3.2"] },
    { "id": 4, "tasks": ["2.4", "3.3", "3.4"] },
    { "id": 5, "tasks": ["3.5", "3.6", "5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "7.1"] },
    { "id": 7, "tasks": ["5.4", "5.5", "6.1", "7.2"] },
    { "id": 8, "tasks": ["7.3", "9.1", "9.2"] },
    { "id": 9, "tasks": ["7.4", "9.3"] },
    { "id": 10, "tasks": ["7.5", "9.4", "9.5", "10.1"] },
    { "id": 11, "tasks": ["10.2"] },
    { "id": 12, "tasks": ["10.3", "10.4"] },
    { "id": 13, "tasks": ["11.1"] },
    { "id": 14, "tasks": ["11.2", "11.3"] }
  ]
}
```
