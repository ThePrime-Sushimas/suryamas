# Implementation Plan: AP Bulk Payments V2

## Overview

This plan implements V2 enhancements to the existing AP Bulk Payments module. The implementation modifies existing V1 files to add inline bank account selection in the Outstanding tab, payment proof upload on the Bulk Create page, multipart/form-data submission, and direct PAID status creation. Tasks are organized by layer: frontend types/utilities first, then new components, then modifications to existing components/hooks/pages, then backend changes, and finally integration wiring.

## Tasks

- [x] 1. Frontend types and session payload utilities
  - [x] 1.1 Add V2 types and session payload parser
    - Create new file `frontend/src/features/ap-payments/types/sessionPayload.types.ts`
    - Define `SessionPayloadItem` interface: `{ invoiceId: string; bankAccountId: number | null }`
    - Define `ProofFileState` interface: `{ individualFiles: Map<number, File>; batchFile: File | null }`
    - Define `ResolvedProof` interface: `{ groupIndex: number; file: File; source: 'individual' | 'batch' }`
    - Create new file `frontend/src/features/ap-payments/utils/sessionPayload.utils.ts`
    - Implement `getStoredSessionPayload(): SessionPayloadItem[] | null` with V1/V2 backward-compatible parsing
    - V2 format: `{ invoiceId, bankAccountId }[]` — V1 format: `string[]` mapped to `{ invoiceId, bankAccountId: null }`
    - Return null for absent, empty, or unparseable values
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [x]* 1.2 Write property tests for session payload parsing
    - **Property 3: Session payload serialization round-trip**
    - **Property 4: Invalid bankAccountId fallback to null**
    - **Property 5: Stale invoice exclusion**
    - **Validates: Requirements 1.8, 2.1, 2.2, 2.3, 2.4, 2.7**

- [x] 2. New frontend components (PaymentProofUpload and BatchProofUpload)
  - [x] 2.1 Create PaymentProofUpload component
    - Create new file `frontend/src/features/ap-payments/components/PaymentProofUpload.tsx`
    - Props: `{ groupIndex, file, batchFile, onFileChange, error }`
    - Accept MIME types: image/jpeg, image/png, image/webp, image/heic, image/heif, application/pdf (max 10MB)
    - Show image preview thumbnail (max 120px height) for image files
    - Show filename + file size for PDF files
    - Show remove button to clear uploaded file
    - Show batch file info when no individual file but batch file exists
    - Display inline error message for invalid files
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 2.2 Create BatchProofUpload component
    - Create new file `frontend/src/features/ap-payments/components/BatchProofUpload.tsx`
    - Props: `{ file, onFileChange, error }`
    - Single file upload area with label "Upload untuk semua"
    - Same file validation rules as PaymentProofUpload (MIME types + 10MB limit)
    - Preview/filename display and remove button
    - _Requirements: 4.8, 4.9_

  - [x]* 2.3 Write unit tests for PaymentProofUpload and BatchProofUpload
    - Test file validation (accepted MIME types, size limit rejection)
    - Test image preview rendering vs PDF filename display
    - Test remove button clears file state
    - Test batch file fallback display
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 3. Modify Outstanding Invoices Tab (inline Rekening Bayar)
  - [x] 3.1 Add bankAccountAssignments state and Rekening Bayar column to OutstandingInvoicesTab
    - Modify existing file `frontend/src/features/ap-payments/components/OutstandingInvoicesTab.tsx`
    - Add `bankAccountAssignments` state: `Map<string, number | null>`
    - Add "Rekening Bayar" column after "Status" column in table header
    - Render `BankAccountSelector` per row: disabled when checkbox unchecked, enabled when checked
    - Reset bankAccountId to null when row checkbox is unchecked
    - Use existing `useCompanyBankAccounts` hook for data
    - Show loading state while bank accounts are being fetched (dropdowns disabled)
    - Show inline error in column header if bank accounts API fails
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.9, 1.10, 1.11_

  - [x] 3.2 Modify BulkSelectionBar to pass V2 session payload format
    - Modify existing file `frontend/src/features/ap-payments/components/BulkSelectionBar.tsx`
    - Add `bankAccountAssignments: Map<string, number | null>` prop
    - Change `handleProcessPayment` to serialize `{ invoiceId, bankAccountId }[]` to sessionStorage
    - _Requirements: 2.1, 2.2, 6.1_

  - [x]* 3.3 Write property tests for Outstanding tab state logic
    - **Property 1: Dropdown enabled iff checkbox checked**
    - **Property 2: Uncheck resets bank account to null**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Modify useBulkCreateState hook (accept initial assignments)
  - [x] 5.1 Update initializeState to accept pre-filled bank account assignments
    - Modify existing file `frontend/src/features/ap-payments/hooks/useBulkCreateState.ts`
    - Change `initializeState` signature to accept `initialAssignments: Map<string, number | null>` and `validBankAccountIds: Set<number>`
    - Validate pre-filled bankAccountId exists in active accounts set; fallback to null if invalid
    - Update `useBulkCreateState` hook signature to accept `initialAssignments` and `validBankAccountIds` parameters
    - _Requirements: 2.3, 2.4, 3.1, 3.6, 3.7_

  - [x]* 5.2 Write property tests for useBulkCreateState initialization
    - **Property 4: Invalid bankAccountId fallback to null**
    - **Property 6: Supplier grouping completeness**
    - **Validates: Requirements 2.4, 3.2, 3.6**

- [x] 6. Modify BulkCreatePage (V2 enhancements)
  - [x] 6.1 Update session payload parsing and page title
    - Modify existing file `frontend/src/features/ap-payments/pages/BulkCreatePage.tsx`
    - Replace `getStoredInvoiceIds()` with `getStoredSessionPayload()` from new utility
    - Change page title from "Buat Pembayaran Massal" to "Review & Bayar"
    - Pass initial bank account assignments from session payload to `useBulkCreateState`
    - Validate bankAccountIds against active company bank accounts list
    - Handle V1 backward compatibility (string[] → all null assignments)
    - Redirect to `/finance/ap-payments` if payload absent/empty/unparseable
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 3.1, 3.5_

  - [x] 6.2 Add proof upload state and render PaymentProofUpload per payment group
    - Modify existing file `frontend/src/features/ap-payments/pages/BulkCreatePage.tsx`
    - Add `ProofFileState` state: `{ individualFiles: Map<number, File>, batchFile: File | null }`
    - Render `BatchProofUpload` above payment group list
    - Render `PaymentProofUpload` per payment group (unique supplier_id + bank_account_id combo)
    - Individual upload overrides batch upload for that group
    - _Requirements: 4.1, 4.8, 4.9, 4.10_

  - [x] 6.3 Update submission to multipart/form-data with proof files
    - Modify existing file `frontend/src/features/ap-payments/pages/BulkCreatePage.tsx`
    - Implement `buildBulkPaymentFormData(payload, proofState)` utility function
    - Append JSON payload as `payload` field in FormData
    - Append proof files as `proof_0`, `proof_1`, ... fields (individual overrides batch)
    - Update confirmation dialog text: "Pembayaran akan langsung dibuat dengan status PAID"
    - Update success toast: "X pembayaran berhasil dibuat sebagai PAID (Batch #YYYY)"
    - Handle network error/timeout (30s) with error toast, retain form state
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 7.9, 7.10_

  - [x]* 6.4 Write property tests for proof resolution and submission payload
    - **Property 7: Submission payload reflects latest state**
    - **Property 8: Upload area count equals payment group count**
    - **Property 10: Proof file resolution (individual overrides batch)**
    - **Validates: Requirements 3.4, 4.1, 4.9, 4.10, 7.4, 7.5**

- [x] 7. Modify frontend API layer (multipart mutation hook)
  - [x] 7.1 Add useCreateBulkPaymentV2 mutation hook
    - Modify existing file `frontend/src/features/ap-payments/api/apPayments.api.ts`
    - Add `useCreateBulkPaymentV2` hook that sends FormData with `Content-Type: multipart/form-data`
    - Set 30-second timeout on the request
    - Invalidate `['ap-payments']` query on success
    - Keep existing `useCreateBulkPayment` for backward compatibility (can be deprecated later)
    - _Requirements: 7.4, 7.9, 7.10_

- [x] 8. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Backend endpoint modification (multipart + PAID status)
  - [x] 9.1 Add multer.any() middleware to POST /ap-payments/bulk route
    - Modify existing file `backend/src/modules/ap-payments/ap-payments.routes.ts`
    - Replace `validateSchema(bulkCreateApPaymentSchema)` with `documentUpload.any()` middleware on the `/bulk` route
    - Move payload validation into the controller (parse JSON from `payload` field, then validate with Zod)
    - _Requirements: 8.1_

  - [x] 9.2 Update createBulk controller to handle multipart/form-data
    - Modify existing file `backend/src/modules/ap-payments/ap-payments.controller.ts`
    - Parse JSON payload from `req.body.payload` string field
    - Validate parsed payload with existing Zod schema
    - Extract proof files from `req.files` array by field name pattern `proof_\d+`
    - Build `proofFileMap: Map<number, Express.Multer.File>` from matched files
    - Validate file MIME types (image/jpeg, image/png, application/pdf) and size (≤10MB)
    - Reject request with `FILE_INVALID_TYPE` or `FILE_TOO_LARGE` error if validation fails
    - Pass proofFileMap to service method
    - _Requirements: 8.1, 8.9_

  - [x] 9.3 Update createBulk service to create PAID payments with proof upload
    - Modify existing file `backend/src/modules/ap-payments/ap-payments.service.ts`
    - Change payment status from `'DRAFT'` to `'PAID'` in bulk creation
    - Set `paid_at = NOW()`, `paid_by = userId`, `payment_date = CURRENT_DATE`
    - Do NOT set `requested_by`, `requested_at`, `approved_by`, `approved_at`
    - Upload proof files to S3 within the transaction (use existing S3 upload pattern)
    - Set `proof_url`, `proof_uploaded_at`, `proof_uploaded_by` on payments with proof
    - Handle batch-level proof: apply to all payments without individual proof
    - Validate outstanding amounts: reject if any invoice's remaining would go negative (tolerance 0.01)
    - Return error code `AP_BULK_OUTSTANDING_EXCEEDED` with violating invoice IDs
    - Roll back entire transaction (including S3 cleanup) if any step fails
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 9.4 Add V2 error class for proof upload failure
    - Modify existing file `backend/src/modules/ap-payments/ap-payments.errors.ts`
    - Add `ApBulkProofUploadFailedError` class with `fileIndex` and `originalError` properties
    - _Requirements: 8.8_

  - [x]* 9.5 Write property tests for backend bulk payment logic
    - **Property 11: Direct PAID status creation**
    - **Property 12: Outstanding amount correctly reduced**
    - **Property 13: Overpayment rejection**
    - **Property 14: Transaction atomicity**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.8, 8.2, 8.5, 8.6, 8.7**

- [x] 10. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Integration wiring and final validation
  - [x] 11.1 Wire OutstandingInvoicesTab bankAccountAssignments to BulkSelectionBar
    - Modify existing file `frontend/src/features/ap-payments/components/OutstandingInvoicesTab.tsx`
    - Pass `bankAccountAssignments` state to `BulkSelectionBar` component
    - Ensure "Proses Pembayaran" always navigates to `/finance/ap-payments/bulk-create` (even for 1 invoice)
    - _Requirements: 6.1, 6.3_

  - [x] 11.2 Wire BulkCreatePage to use useCreateBulkPaymentV2 mutation
    - Modify existing file `frontend/src/features/ap-payments/pages/BulkCreatePage.tsx`
    - Replace `useCreateBulkPayment` with `useCreateBulkPaymentV2` for submission
    - Build FormData with `buildBulkPaymentFormData` before calling mutation
    - Clear sessionStorage on success, redirect to `/finance/ap-payments`
    - _Requirements: 7.4, 7.8_

  - [x] 11.3 Handle permission-gated balance display in BankAccountSelector
    - Modify existing file `frontend/src/features/ap-payments/components/BankAccountSelector.tsx`
    - Ensure balance is shown only when user has `('bank_accounts', 'view_balance')` permission
    - Display format: bank name + account number + balance (IDR) when permitted, bank name + account number only otherwise
    - _Requirements: 1.5, 1.6_

  - [x]* 11.4 Write integration tests for full V2 flow
    - Test multipart endpoint: multer parses payload + files correctly
    - Test S3 upload within transaction: proof_url stored, rollback on failure
    - Test PAID status creation: verify status=PAID, paid_at, paid_by fields set
    - Test outstanding calculation: remaining_amount reduced after PAID payment
    - Test backward compat: V1 session payload format handled gracefully
    - _Requirements: 5.1, 5.4, 5.8, 8.2, 8.5, 8.8_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- **Modified files** are clearly indicated with "Modify existing file" prefix
- **New files** are clearly indicated with "Create new file" prefix
- The V1 `useCreateBulkPayment` hook is kept for backward compatibility during rollout

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.2"] },
    { "id": 1, "tasks": ["1.2", "2.3", "3.1", "9.4"] },
    { "id": 2, "tasks": ["3.2", "3.3", "5.1"] },
    { "id": 3, "tasks": ["5.2", "6.1", "9.1"] },
    { "id": 4, "tasks": ["6.2", "9.2", "7.1"] },
    { "id": 5, "tasks": ["6.3", "9.3"] },
    { "id": 6, "tasks": ["6.4", "9.5"] },
    { "id": 7, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 8, "tasks": ["11.4"] }
  ]
}
```
