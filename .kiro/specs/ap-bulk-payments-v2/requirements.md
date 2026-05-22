# Requirements Document

## Introduction

This feature enhances the existing AP Bulk Payments module (V1) with an improved workflow that moves bank account selection earlier in the process (into the Outstanding Invoices tab), adds payment proof upload capability, and skips the draft/approval cycle for bulk payments. The rationale is that finance selecting the payment account IS the approval — admin just executes. This V2 modifies the existing implementation at `.kiro/specs/ap-bulk-payments/` while preserving the database schema, outstanding invoices API, bulk badge, URL-persisted filters, date filter, and Excel export.

## Glossary

- **Outstanding_Invoices_Tab**: The "Invoice Outstanding" tab on the AP Payments page displaying unpaid invoices with inline bank account selection
- **Rekening_Bayar_Column**: A new column in the Outstanding Invoices table containing a dropdown for selecting the company bank account per invoice row
- **Bulk_Create_Page**: The review and finalization page at `/finance/ap-payments/bulk-create` where users confirm assignments, upload payment proof, and submit
- **Payment_Group**: A set of invoices sharing the same supplier_id and bank_account_id combination, representing one AP payment record
- **Bukti_Pembayaran**: Payment proof file (image or PDF) uploaded to confirm a payment was executed
- **Session_Payload**: The data passed via sessionStorage from the Outstanding tab to the Bulk Create page, containing invoice IDs and their bank account assignments
- **Bank_Account_Selector**: A dropdown component displaying company bank accounts with bank name, account number, and optionally balance (permission-gated)
- **Supplier_Group_Card**: A card component on the Bulk Create page grouping invoices by supplier and showing pre-filled rekening assignments
- **Payment_Proof_Upload**: A file upload area per Payment_Group or per batch for attaching bukti pembayaran
- **Direct_PAID_Status**: The behavior where bulk payment submission creates payments with status PAID directly, bypassing DRAFT → PENDING_APPROVAL → APPROVED flow

## Requirements

### Requirement 1: Inline Bank Account Selection in Outstanding Invoices Tab

**User Story:** As a finance user, I want to select the payment bank account directly in the Outstanding Invoices tab, so that I can assign accounts while reviewing invoices without navigating to a separate page.

#### Acceptance Criteria

1. THE Outstanding_Invoices_Tab SHALL display a "Rekening Bayar" column after the "Status" column in the outstanding invoices table, containing a Bank_Account_Selector dropdown per row
2. WHILE an invoice row checkbox is unchecked, THE Rekening_Bayar_Column dropdown for that row SHALL be disabled and display placeholder text "Pilih rekening"
3. WHEN an invoice row checkbox is checked, THE Rekening_Bayar_Column dropdown for that row SHALL become active and selectable
4. WHEN an invoice row checkbox is unchecked after a bank account was selected, THE Rekening_Bayar_Column dropdown for that row SHALL reset to no selection (null value)
5. IF the user has the ('bank_accounts', 'view_balance') permission, THEN THE Bank_Account_Selector in the Rekening_Bayar_Column SHALL display each option as: bank name, account number, and balance amount formatted as IDR currency
6. IF the user does not have the ('bank_accounts', 'view_balance') permission, THEN THE Bank_Account_Selector in the Rekening_Bayar_Column SHALL display each option as: bank name and account number only, without balance information
7. WHEN the user checks an invoice row without selecting a bank account in the Rekening_Bayar_Column, THE Outstanding_Invoices_Tab SHALL allow proceeding to the Bulk_Create_Page (bank account selection is optional at this stage)
8. WHEN the user navigates to the Bulk_Create_Page with invoices that have a bank account pre-selected in the Rekening_Bayar_Column, THE Bulk_Create_Page SHALL pre-populate the Bank_Account_Selector for those invoices with the previously selected bank account
9. WHILE the bank accounts data is being fetched, THE Rekening_Bayar_Column dropdowns SHALL display in a loading state with the dropdown disabled until data is available
10. IF the bank accounts API request fails, THEN THE Outstanding_Invoices_Tab SHALL display an inline error indicator in the Rekening_Bayar_Column header and disable all Bank_Account_Selector dropdowns until the data is successfully fetched
11. THE Rekening_Bayar_Column SHALL use the same `useCompanyBankAccounts` hook and data source as the existing Bank_Account_Selector on the Bulk_Create_Page

### Requirement 2: Enhanced Session Payload Between Tab and Bulk Create Page

**User Story:** As a frontend developer, I want the session payload to include bank account assignments alongside invoice IDs, so that the Bulk Create page can pre-fill rekening selections made in the Outstanding tab.

#### Acceptance Criteria

1. WHEN the user clicks "Proses Pembayaran" on the sticky action bar, THE Outstanding_Invoices_Tab SHALL store in sessionStorage under key "bulk_selected_invoices" a JSON-serialized array of objects with structure: `{ invoiceId: string, bankAccountId: number | null }[]`, containing at most 50 entries (matching the existing MAX_SELECTION limit)
2. THE Session_Payload SHALL include all checked invoices regardless of whether a bank account was assigned (bankAccountId may be null)
3. WHEN the Bulk_Create_Page loads, THE Bulk_Create_Page SHALL parse the Session_Payload and set the Bank_Account_Selector dropdown selected value for each invoice that has a non-null bankAccountId value
4. IF the Session_Payload contains an invoice with a bankAccountId that does not exist in the company bank accounts list returned by the API, THEN THE Bulk_Create_Page SHALL treat that assignment as null and leave the Bank_Account_Selector dropdown unselected for that invoice
5. THE Session_Payload format change SHALL maintain backward compatibility: IF the stored value is a plain string array (V1 format containing only invoice ID strings), THEN THE Bulk_Create_Page SHALL treat all bank account assignments as null
6. IF the Session_Payload value is absent, empty, or contains JSON that cannot be parsed, THEN THE Bulk_Create_Page SHALL redirect the user to the AP Payments list page without rendering the bulk create form
7. IF the Session_Payload contains an invoiceId that does not appear in the outstanding invoices returned by the API, THEN THE Bulk_Create_Page SHALL exclude that invoice from the bulk create form without displaying an error

### Requirement 3: Revised Bulk Create Page as Review and Finalization

**User Story:** As a finance user, I want the Bulk Create page to serve as a review and finalization step where I can verify pre-filled bank accounts, override assignments, upload payment proof, and submit, so that the payment creation process is streamlined.

#### Acceptance Criteria

1. WHEN the Bulk_Create_Page loads with pre-filled bank account assignments from the Session_Payload, THE Bulk_Create_Page SHALL display each invoice's Bank_Account_Selector with the pre-filled value and allow the user to override the selection
2. THE Bulk_Create_Page SHALL continue to group invoices by supplier in Supplier_Group_Cards, sorted alphabetically by supplier name, with each invoice row showing its pre-filled or user-selected bank account
3. THE Bulk_Create_Page SHALL retain all existing functionality: "Apply to all" per supplier group, individual bank account override, supplier group notes, validation of missing bank accounts on checked invoices, and the Summary Panel
4. WHEN the user overrides a pre-filled bank account on the Bulk_Create_Page, THE Bulk_Create_Page SHALL use the overridden value for submission (the Session_Payload pre-fill is only an initial default)
5. THE Bulk_Create_Page header SHALL display title "Review & Bayar" instead of "Buat Pembayaran Massal" to reflect the revised purpose of the page
6. IF a bank_account_id value from the Session_Payload does not match any active company bank account returned by the bank accounts API, THEN THE Bulk_Create_Page SHALL treat that invoice's bank account assignment as null (unselected) and require the user to manually select a valid bank account before submission
7. IF the Session_Payload contains bank_account_id values for only a subset of invoices (or null for some entries), THEN THE Bulk_Create_Page SHALL display those invoices without a pre-selected bank account, requiring the user to assign one before submission

### Requirement 4: Payment Proof Upload on Bulk Create Page

**User Story:** As a finance user, I want to upload bukti pembayaran (payment proof) on the Bulk Create page, so that proof of payment execution is attached to the payment record.

#### Acceptance Criteria

1. THE Bulk_Create_Page SHALL display a file upload area for each Payment_Group (unique supplier_id + bank_account_id combination among checked invoices), accepting exactly one file per Payment_Group
2. THE Payment_Proof_Upload SHALL accept files with MIME types image/jpeg, image/png, image/webp, image/heic, image/heif, and application/pdf, with a maximum file size of 10MB per file
3. IF the user uploads a file with an unsupported MIME type or exceeding 10MB, THEN THE Payment_Proof_Upload SHALL display an inline error message below the upload area indicating the validation failure reason (unsupported format or file too large) and reject the file without clearing other uploaded files
4. WHEN the user uploads a valid image file (.jpg, .jpeg, .png, .webp, .heic, .heif), THE Payment_Proof_Upload SHALL display a preview thumbnail (maximum 120px height) of the uploaded image within the upload area
5. WHEN the user uploads a valid PDF file, THE Payment_Proof_Upload SHALL display the filename and file size within the upload area
6. THE Payment_Proof_Upload SHALL display a remove button for each uploaded file that, when clicked, clears the file from that upload area and restores the empty upload state
7. THE Payment_Proof_Upload SHALL be optional — the user can submit bulk payments without uploading proof for any or all Payment_Groups
8. THE Bulk_Create_Page SHALL display a single "Upload untuk semua" option above the Payment_Group list that accepts one proof file to apply to all Payment_Groups in the batch
9. WHEN the user uploads proof via "Upload untuk semua", THE Bulk_Create_Page SHALL apply that file to all Payment_Groups that do not already have an individual proof file uploaded
10. WHEN the user uploads an individual proof for a specific Payment_Group after using "Upload untuk semua", THE individual upload SHALL override the batch-level upload for that Payment_Group only
11. THE uploaded proof file SHALL be sent to the backend as part of the bulk payment submission and stored using the existing S3 upload pattern (documentUploadSingle middleware), with the resulting URL saved in the `proof_url` field of the corresponding ap_payments record

### Requirement 5: Skip Approval Flow for Bulk Payments (Direct PAID Status)

**User Story:** As a finance manager, I want bulk payments to skip the draft and approval cycle and go directly to PAID status, so that the payment process is faster given that finance selecting the rekening IS the approval.

#### Acceptance Criteria

1. WHEN the bulk payment submission is processed by the backend via POST /ap-payments/bulk, THE backend SHALL create each ap_payments record with status "PAID", with `paid_at` set to the current timestamp, and `paid_by` set to the submitting user's ID
2. THE backend SHALL set the `payment_date` field of each created ap_payments record to the current date (YYYY-MM-DD, server time zone) at the time of submission
3. THE backend SHALL NOT trigger any approval workflow, notification, or pending approval state for payments created via the bulk payment endpoint, and SHALL NOT set `requested_by`, `requested_at`, `approved_by`, or `approved_at` fields
4. WHEN a payment is created with status PAID via bulk submission, THE backend SHALL ensure the corresponding purchase invoice outstanding amount is correctly reduced, by virtue of the payment lines being included in the existing computed outstanding calculation (total_amount minus sum of amount_paid from lines linked to PAID or RECONCILED payments)
5. IF any invoice line in the bulk submission has an amount_paid that exceeds the invoice's computed outstanding amount (remaining = total_amount minus sum of existing PAID/RECONCILED payment lines) by more than 0.01, THEN THE backend SHALL reject the entire bulk submission and return an error response indicating which invoice IDs exceeded their outstanding amounts
6. THE single payment creation flow (existing `/ap-payments/new` form and POST /ap-payments endpoint) SHALL continue to use the existing DRAFT → PENDING_APPROVAL → APPROVED → PAID workflow without modification
7. WHEN the AP_Payments_Page displays a bulk-created payment (identified by a non-null bulk_payment_batch_id), THE AP_Payments_Page SHALL show the PAID status badge and the BulkBadge together, indicating it was paid via bulk process
8. IF the bulk payment submission fails mid-transaction (due to validation error or database error), THEN THE backend SHALL roll back the entire transaction so that no ap_payments records, no ap_payment_invoice_lines records, and no ap_payment_batches record are persisted

### Requirement 6: Unified Payment Experience (Single Invoice via Bulk Flow)

**User Story:** As a finance user, I want to use the same bulk payment flow even when paying a single invoice, so that the payment creation experience is consistent regardless of how many invoices are selected.

#### Acceptance Criteria

1. WHEN the user selects exactly 1 invoice in the Outstanding_Invoices_Tab and clicks "Proses Pembayaran", THE Outstanding_Invoices_Tab SHALL store that single invoice in sessionStorage under the key "bulk_selected_invoices" as a JSON array with one element and navigate to `/finance/ap-payments/bulk-create`
2. WHEN the Bulk_Create_Page loads with exactly 1 invoice, THE Bulk_Create_Page SHALL render one Supplier_Group_Card containing one invoice row with a Bank_Account_Selector, and the Summary_Panel displaying supplier count of 1, invoice count of 1, and the grand total equal to that invoice's remaining amount
3. THE existing single payment form at `/finance/ap-payments/new` SHALL remain accessible via direct URL navigation but the Outstanding_Invoices_Tab "Proses Pembayaran" button SHALL always navigate to the Bulk_Create_Page regardless of whether 1 or multiple invoices are selected
4. WHEN a single invoice is submitted via the Bulk_Create_Page, THE backend SHALL create one ap_payment_batches record with total_payments=1 and one ap_payments record with status PAID, following the same Direct_PAID_Status logic as multi-invoice submissions
5. WHEN the Bulk_Create_Page loads with exactly 1 invoice, THE Bulk_Create_Page SHALL not impose any minimum invoice count and SHALL enable the submit button provided the single invoice has a bank account assigned and all other validation rules are satisfied

### Requirement 7: Bulk Payment Submission with Proof and Direct Status

**User Story:** As a finance user, I want the bulk payment submission to include uploaded proof files and create payments as PAID, so that the entire payment process is completed in one step.

#### Acceptance Criteria

1. WHEN the user clicks submit on the Bulk_Create_Page, THE Bulk_Create_Page SHALL validate that all checked invoices have a bank account selected (same validation as V1)
2. WHEN validation passes, THE Bulk_Create_Page SHALL display a confirmation dialog showing: total number of payments, grand total amount formatted as Indonesian Rupiah with 2 decimal places, and the text "Pembayaran akan langsung dibuat dengan status PAID"
3. IF the user cancels the confirmation dialog, THEN THE Bulk_Create_Page SHALL close the dialog and retain the current form state without submitting
4. WHEN the user confirms submission, THE Bulk_Create_Page SHALL send a multipart/form-data POST request to the bulk payment endpoint containing the payment payload JSON and up to 50 uploaded proof files (one per payment group, maximum 10 MB each, accepted formats: JPG, PNG, WEBP, PDF, HEIC)
5. THE bulk payment request payload SHALL include for each payment group: supplier_id, bank_account_id, payment_method (default TRANSFER), invoice_lines array, notes, and a reference to the associated proof file keyed by the payment group index in the array
6. WHEN the backend receives the bulk payment request with proof files, THE backend SHALL upload each proof file to S3 using the existing documentUploadSingle pattern and store the resulting URL in the `proof_url` field of the corresponding ap_payments record, within the same database transaction used to create the payments
7. IF any S3 proof file upload fails during bulk payment creation, THEN THE backend SHALL roll back the entire transaction including all payment records and return an error response indicating which file failed to upload
8. WHEN the bulk payment is created successfully, THE Bulk_Create_Page SHALL clear sessionStorage, redirect to `/finance/ap-payments`, and display a success toast with the message format "X pembayaran berhasil dibuat sebagai PAID (Batch #YYYY)" where X is the payment count and YYYY is the first 4 characters of the batch ID
9. IF the bulk payment request fails due to a validation error, THEN THE Bulk_Create_Page SHALL display an error toast with the error message from the backend and retain the current form state including uploaded files
10. IF the bulk payment request fails due to a network error or timeout (no response received within 30 seconds), THEN THE Bulk_Create_Page SHALL display an error toast indicating a connection failure and retain the current form state including uploaded files

### Requirement 8: Backend Bulk Payment Endpoint Enhancement

**User Story:** As a backend developer, I want the bulk payment endpoint to support proof file uploads and direct PAID status creation, so that the V2 flow is fully supported server-side.

#### Acceptance Criteria

1. THE backend bulk payment endpoint (POST `/ap-payments/bulk`) SHALL accept multipart/form-data requests containing a JSON payload in a field named `payload` and optional file fields for payment proof, with a maximum file size of 10 MB per file and accepted MIME types limited to `image/jpeg`, `image/png`, and `application/pdf`
2. WHEN processing the bulk payment request, THE backend SHALL create each ap_payments record with status "PAID", payment_date set to the current server date (UTC), paid_by set to the authenticated user, and paid_at set to the current timestamp
3. WHEN a proof file is provided for a payment group, THE backend SHALL upload the file to S3 and set the `proof_url`, `proof_uploaded_at`, and `proof_uploaded_by` columns of the corresponding ap_payments record
4. WHEN a batch-level proof file is provided (applied to all groups), THE backend SHALL use that file's S3 URL for all ap_payments records that do not have an individual proof file
5. THE backend SHALL create one ap_payment_batches record and a maximum of 50 ap_payments records within a single database transaction, maintaining atomicity
6. WHEN creating payments with PAID status, THE backend SHALL verify that the sum of amount_paid per purchase_invoice (including existing PAID/RECONCILED payments) does not exceed the invoice's total_amount, since remaining_amount is a computed value derived from total_amount minus the sum of paid lines
7. IF any purchase_invoice's computed remaining_amount would become negative (with a tolerance of 0.01) after including the new payment amounts, THEN THE backend SHALL reject the entire request with error code `AP_BULK_OUTSTANDING_EXCEEDED`, create zero records, and return the list of violating invoice IDs with their outstanding and requested amounts
8. IF any proof file upload to S3 fails during processing, THEN THE backend SHALL roll back the entire transaction and return an error indicating which file failed to upload
9. IF any submitted file exceeds 10 MB or has a MIME type other than `image/jpeg`, `image/png`, or `application/pdf`, THEN THE backend SHALL reject the request before processing and return an error indicating the invalid file
