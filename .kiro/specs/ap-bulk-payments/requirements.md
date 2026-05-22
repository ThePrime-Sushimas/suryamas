# Requirements Document

## Introduction

This feature adds bulk payment capabilities to the AP Payments module of the Sushimas ERP system. It enables finance staff to select multiple outstanding invoices, group them by supplier, assign company bank accounts, and submit a single batch payment request. Supporting features include URL-persisted filters, date filtering, Excel export, and bulk payment badges in the payment list.

## Glossary

- **AP_Payments_Page**: The main list page for accounts payable payments at `/finance/ap-payments`
- **Outstanding_Invoice**: A purchase invoice with status other than PAID or RECONCILED that has a remaining unpaid amount
- **Bulk_Payment_Batch**: A group of AP payments created together in a single operation, tracked by a shared batch record
- **Invoice_Assignment**: The association of a selected invoice to a specific company bank account for payment
- **Supplier_Group**: A visual grouping of invoices belonging to the same supplier within the bulk create page
- **Bank_Account_Selector**: A dropdown component that displays company bank accounts with optional balance information
- **Aging_Badge**: A color-coded indicator showing how close an invoice is to or past its due date
- **Bulk_Create_Page**: The page at `/finance/ap-payments/bulk-create` where users configure and submit bulk payments
- **Summary_Panel**: The right-column panel on the Bulk_Create_Page showing totals, bank account usage, and submit action
- **Filter_State**: The collection of active filter values persisted in URL search parameters
- **Session_Storage**: Browser sessionStorage used to pass selected invoice IDs between pages

## Requirements

### Requirement 1: URL-Persisted Filter State

**User Story:** As a finance user, I want all filter selections on the AP Payments page to persist in the URL, so that I can use the browser back button and share filtered views without losing my selections.

#### Acceptance Criteria

1. THE AP_Payments_Page SHALL store all active filter values (tab, status, supplierId, branchId, paymentMethod, search, page, limit, dateFrom, dateTo) in URL search parameters using snake_case keys (e.g., supplier_id, branch_id, payment_method, date_from, date_to)
2. WHEN the user navigates away and returns via browser back button, THE AP_Payments_Page SHALL restore the exact filter state from the URL search parameters
3. WHEN the user refreshes the browser, THE AP_Payments_Page SHALL restore the filter state from the URL search parameters
4. WHEN a filter value matches its default, THE AP_Payments_Page SHALL omit that parameter from the URL. The defaults are: page=1, limit=25, search="" (empty), status="" (empty), supplierId="" (empty), branchId="" (empty), paymentMethod="" (empty), tab="all", dateFrom="" (empty), dateTo="" (empty)
5. WHEN a filter that affects result set changes (search, status, supplierId, branchId, paymentMethod, tab, dateFrom, dateTo, limit), THE AP_Payments_Page SHALL reset the page parameter to 1
6. IF a URL search parameter contains an invalid value (unrecognized status, non-positive page number, limit outside 1–100, or unrecognized tab), THEN THE AP_Payments_Page SHALL fall back to the default value for that parameter without displaying an error
7. WHEN the search input value changes, THE AP_Payments_Page SHALL debounce the URL update by 400 milliseconds to avoid excessive history entries

### Requirement 2: Date Range Filter

**User Story:** As a finance user, I want to filter AP payments by date range, so that I can view payments within a specific period.

#### Acceptance Criteria

1. THE AP_Payments_Page SHALL display two date input fields (dateFrom and dateTo) using HTML date inputs (type="date") in the existing filter row alongside status, supplier, and branch filters
2. WHEN the user sets a dateFrom value without a dateTo value, THE AP_Payments_Page SHALL send the date_from parameter to the API to return only payments with payment_date on or after the dateFrom value
3. WHEN the user sets a dateTo value without a dateFrom value, THE AP_Payments_Page SHALL send the date_to parameter to the API to return only payments with payment_date on or before the dateTo value
4. WHEN both dateFrom and dateTo are set and dateFrom is on or before dateTo, THE AP_Payments_Page SHALL return only payments with payment_date between the two dates inclusive
5. IF the user sets dateFrom to a date after dateTo, THEN THE AP_Payments_Page SHALL display an inline validation message below the date fields and SHALL NOT send the API request until the range is corrected
6. WHEN the user clears a previously set dateFrom or dateTo field, THE AP_Payments_Page SHALL remove the corresponding date_from or date_to parameter from the API request and refresh the payment list

### Requirement 3: Excel Export

**User Story:** As a finance user, I want to export the current filtered payment list to Excel, so that I can share reports and perform offline analysis.

#### Acceptance Criteria

1. THE AP_Payments_Page SHALL display an "Export" button in the header area aligned with the Dashboard and Create Payment buttons
2. WHEN the user clicks the Export button, THE AP_Payments_Page SHALL fetch all payments matching the currently active filters (not limited to the current page) and generate an Excel file in .xlsx format with filename `ap-payments-{YYYY-MM-DD}.xlsx` where the date is the current date
3. THE exported Excel file SHALL contain columns in this order: No. Pembayaran, Supplier, Cabang, Metode, Bank Account, Total, Status, Tanggal Bayar
4. THE AP_Payments_Page SHALL use the SheetJS (xlsx) library already available in the project for Excel generation
5. WHILE the export is being generated, THE AP_Payments_Page SHALL disable the Export button and display a loading indicator to prevent duplicate requests
6. IF the export fails due to a network or server error, THEN THE AP_Payments_Page SHALL display an error toast notification and re-enable the Export button
7. IF no payments match the currently active filters, THEN THE AP_Payments_Page SHALL disable the Export button or display a notification indicating there are no records to export

### Requirement 4: Outstanding Invoices Tab

**User Story:** As a finance user, I want to see all unpaid invoices in a dedicated tab, so that I can identify and select invoices for bulk payment.

#### Acceptance Criteria

1. THE AP_Payments_Page SHALL display an "Invoice Outstanding" tab in the tab bar alongside existing tabs
2. WHEN the Outstanding tab is active, THE AP_Payments_Page SHALL display a paginated list of all AP invoices with status other than PAID or RECONCILED, sorted by due_date ascending (oldest due first), with a default page size of 10
3. THE Outstanding invoice list SHALL display columns: checkbox, invoice number, supplier name with supplier bank account (bank name and account number), branch, total amount, remaining amount, due date with Aging_Badge, and invoice status
4. THE Aging_Badge SHALL display in red when the invoice due_date is before today, amber when the due_date is today or within the next 7 calendar days (inclusive), and gray when the due_date is more than 7 calendar days from today
5. WHEN the user checks one or more invoice checkboxes, THE AP_Payments_Page SHALL display a sticky action bar fixed at the bottom of the viewport
6. THE sticky action bar SHALL display the count of selected invoices, the total remaining amount of selected invoices formatted as currency, a "Batal" (cancel) button, and a "Proses Pembayaran" button
7. WHEN the user clicks "Batal" on the sticky action bar, THE AP_Payments_Page SHALL deselect all checked invoices and hide the action bar
8. WHEN the user clicks "Proses Pembayaran", THE AP_Payments_Page SHALL store the selected invoice IDs in sessionStorage under the key "bulk_selected_invoices" and navigate to `/finance/ap-payments/bulk-create`
9. WHEN the user navigates between pages of the Outstanding invoice list, THE AP_Payments_Page SHALL preserve previously checked invoice selections and reflect them in the sticky action bar totals
10. IF the user selects more than 50 invoices, THEN THE AP_Payments_Page SHALL disable further checkbox selections and display a message indicating the maximum selection limit has been reached

### Requirement 5: Bulk Create Page Layout and Invoice Grouping

**User Story:** As a finance user, I want to see selected invoices grouped by supplier on the bulk create page, so that I can efficiently assign bank accounts and review payments per supplier.

#### Acceptance Criteria

1. THE Bulk_Create_Page SHALL be accessible at the route `/finance/ap-payments/bulk-create` and protected by the `ap_payments` module permission
2. WHEN the page loads, THE Bulk_Create_Page SHALL read invoice IDs from sessionStorage key "bulk_selected_invoices" and fetch the corresponding invoice data from the API
3. IF no invoice IDs are found in sessionStorage or the stored value is an empty array, THEN THE Bulk_Create_Page SHALL redirect the user back to `/finance/ap-payments`
4. IF the API request to fetch invoice data fails, THEN THE Bulk_Create_Page SHALL display an error message indicating the fetch failure and provide a retry option
5. THE Bulk_Create_Page SHALL display a header with title "Buat Pembayaran Massal" and a Cancel button that navigates back to `/finance/ap-payments`
6. THE Bulk_Create_Page SHALL display invoices grouped by supplier in the left column, with each Supplier_Group rendered as a card, sorted alphabetically by supplier name
7. Each Supplier_Group card SHALL display the supplier name, supplier bank account information (bank name and account number), an "Apply to all" bank account shortcut dropdown, and a table of invoice rows
8. Each invoice row within a Supplier_Group SHALL display a checkbox, invoice number, remaining amount, due date, and a company Bank_Account_Selector dropdown
9. THE Bulk_Create_Page SHALL use a two-column layout on desktop at the md breakpoint (768px) and above (left column flex-1, right column w-80) and a single stacked layout below the md breakpoint

### Requirement 6: Invoice Assignment and Bank Account Selection

**User Story:** As a finance user, I want to assign a company bank account to each invoice, so that the system knows which account to pay from.

#### Acceptance Criteria

1. WHEN an invoice row checkbox is checked, THE Bank_Account_Selector dropdown for that row SHALL become active and selectable
2. WHEN an invoice row checkbox is unchecked, THE Bulk_Create_Page SHALL clear the Bank_Account_Selector selection for that row to no selection and exclude the invoice from the payment
3. THE Bank_Account_Selector SHALL display bank name, account number, and balance (subject to view_balance permission as defined in Requirement 7) for each option
4. WHEN the user selects a bank account in the "Apply to all" dropdown of a Supplier_Group, THE Bulk_Create_Page SHALL set that bank account for all checked invoices within that group while leaving unchecked invoices unmodified
5. IF a checked invoice does not have a bank account selected during validation, THEN THE Bulk_Create_Page SHALL highlight that row with a red border (border-red-300 bg-red-50/50) and scroll the viewport to the first highlighted row
6. WHEN the user selects a bank account on an individual invoice row after "Apply to all" has been used, THE Bulk_Create_Page SHALL override the group-applied value for that row only
7. IF the bank accounts API request fails, THEN THE Bulk_Create_Page SHALL display an error message indicating the accounts could not be loaded and disable all Bank_Account_Selector dropdowns until the data is successfully fetched

### Requirement 7: Balance Visibility Permission Gate

**User Story:** As a system administrator, I want bank account balance visibility to be controlled by permissions, so that sensitive financial information is only shown to authorized users.

#### Acceptance Criteria

1. THE Bulk_Create_Page SHALL use the permission ('bank_accounts', 'view_balance') to determine whether balance information is visible or hidden across all components on the page
2. WHILE the user has view_balance permission, THE Bank_Account_Selector SHALL display the balance amount and a sufficiency indicator (✓ when balance >= total assigned amount, ⚠️ when balance < total assigned amount) for each bank account
3. WHILE the user lacks view_balance permission, THE Bank_Account_Selector SHALL display "🔒 Saldo tidak ditampilkan" instead of the balance amount while still showing bank name, account number, and usage amount
4. WHILE the user lacks view_balance permission, THE submit button SHALL remain enabled regardless of account balance sufficiency
5. WHILE the user lacks view_balance permission, THE Summary_Panel SHALL hide balance amounts and suppress insufficient-balance warnings for all bank accounts

### Requirement 8: Summary Panel

**User Story:** As a finance user, I want to see a summary of the bulk payment including totals and bank account usage, so that I can verify the payment before submitting.

#### Acceptance Criteria

1. THE Summary_Panel SHALL display the total number of distinct suppliers with at least one checked invoice, the total number of checked invoices across all groups, and the grand total payment amount formatted as currency with 2 decimal places
2. THE Summary_Panel SHALL display usage per bank account, showing only accounts that are assigned to at least one checked invoice
3. THE Summary_Panel SHALL display, for each listed bank account, the bank name, account number, and the total amount assigned to that account labeled as "Used"
4. WHILE the user has view_balance permission AND a bank account's used amount exceeds its balance, THE Summary_Panel SHALL display a visual warning indicator (colored icon or highlighted text) next to that account's row
5. WHILE the user has view_balance permission AND any selected bank account has insufficient balance, THE submit button SHALL be disabled
6. THE Summary_Panel SHALL be sticky-positioned (top-4) on viewports at or above the lg breakpoint (1024px) and in normal document flow on smaller viewports
7. THE Summary_Panel SHALL display a submit button with text "Buat X Pembayaran" where X is the number of distinct payment documents to be created, determined by unique supplier_id and bank_account_id combinations among checked invoices
8. IF no invoices are currently checked, THEN THE Summary_Panel SHALL display zero values for all totals and the submit button SHALL be disabled

### Requirement 9: Bulk Payment Submission

**User Story:** As a finance user, I want to submit the bulk payment so that multiple AP payments are created in a single operation.

#### Acceptance Criteria

1. WHEN the user clicks submit, THE Bulk_Create_Page SHALL validate that all checked invoices have a bank account selected and display a validation error indicator on each row missing a bank account selection
2. WHILE the user has view_balance permission, THE Bulk_Create_Page SHALL validate that no selected bank account has a total assigned amount exceeding its available balance before allowing submission
3. WHEN validation passes, THE Bulk_Create_Page SHALL display a confirmation dialog showing the total number of payments to be created and the grand total amount, with "Konfirmasi" and "Batal" actions
4. WHEN the user confirms the submission in the confirmation dialog, THE Bulk_Create_Page SHALL send a POST request to `/ap/payments/bulk` with batch_notes (maximum 500 characters) and a payments array grouped by supplier_id and bank_account_id
5. WHEN the backend receives the bulk payment request, THE backend SHALL validate that all referenced invoice IDs exist and have status other than PAID or RECONCILED, then create one ap_payment_batches record and N ap_payments records (each with status DRAFT) linked via bulk_payment_batch_id within a single database transaction
6. IF the backend validation fails due to invoices not found or already paid, THEN THE backend SHALL reject the request with an error response indicating which invoice IDs are invalid and THE Bulk_Create_Page SHALL display the error message without clearing the form
7. WHEN the bulk payment is created successfully, THE Bulk_Create_Page SHALL clear the sessionStorage key "bulk_selected_invoices", redirect to `/finance/ap-payments`, and display a success toast containing the first 4 characters of the batch ID
8. IF the bulk payment request fails due to a network or server error, THEN THE Bulk_Create_Page SHALL display an error toast indicating the failure reason and retain the current form state

### Requirement 10: Bulk Payment Badge in Payment List

**User Story:** As a finance user, I want to identify which payments were created as part of a bulk batch, so that I can track batch operations.

#### Acceptance Criteria

1. WHEN a payment has a bulk_payment_batch_id, THE AP_Payments_Page SHALL display a badge with text "BULK · Batch #" followed by the first 4 characters of the batch ID, positioned adjacent to the payment number or status indicator within the payment row
2. THE bulk badge SHALL use styling: bg-violet-100 text-violet-700 for light mode and bg-violet-900/30 text-violet-300 for dark mode
3. THE AP_Payments_Page SHALL provide a "Bulk only" filter option that, when active, shows only payments that have a bulk_payment_batch_id, applied additively with any other active filters (status, supplier, branch, date range, search)
4. WHEN the "Bulk only" filter is toggled on or off, THE AP_Payments_Page SHALL persist the filter value in the URL search parameters and reset the page parameter to 1

### Requirement 11: Outstanding Invoices API Endpoint

**User Story:** As a frontend developer, I want a dedicated API endpoint for outstanding invoices with filtering support, so that the Outstanding tab can fetch data efficiently.

#### Acceptance Criteria

1. THE backend SHALL expose a GET endpoint at `/ap/invoices/outstanding` that returns invoices with status in (APPROVED, POSTED) where remaining_amount is greater than zero
2. THE endpoint SHALL support query parameters: supplierId (UUID), branchId (UUID), dateFrom (ISO date string, filters by invoice_date), dateTo (ISO date string, filters by invoice_date), search (string, max 100 characters, matches against invoice_number and supplier_name using case-insensitive partial match), page (integer, default 1, minimum 1), and limit (integer, default 20, minimum 1, maximum 100)
3. THE endpoint response SHALL include for each invoice: id, invoice_number, invoice_date, supplier_id, supplier_name, branch_id, branch_name, total_amount, remaining_amount, due_date, aging_days (integer calculated as current date minus due_date where positive values indicate overdue days and negative values indicate days until due; null when due_date is null), invoice_status, and supplier_bank_accounts (array of objects each containing bank_name and account_number for active bank accounts belonging to that supplier)
4. WHEN the supplierId parameter is provided, THE endpoint SHALL return only invoices for that supplier
5. WHEN the branchId parameter is provided, THE endpoint SHALL return only invoices for that branch
6. THE endpoint response SHALL include pagination metadata containing: page (current page number), limit (items per page), total (total matching invoice count), and totalPages (calculated as ceiling of total divided by limit)

### Requirement 12: Database Schema Changes

**User Story:** As a backend developer, I want the database schema to support bulk payment batches, so that payments can be grouped and tracked.

#### Acceptance Criteria

1. THE database SHALL have a table `ap_payment_batches` with columns: id (UUID primary key, default gen_random_uuid()), created_by (UUID NOT NULL referencing auth_users(id)), created_at (TIMESTAMPTZ NOT NULL default now()), total_payments (INTEGER NOT NULL, CHECK total_payments > 0), total_amount (NUMERIC(15,2) NOT NULL, CHECK total_amount > 0), and notes (TEXT nullable)
2. THE `ap_payments` table SHALL have a nullable column `bulk_payment_batch_id` (UUID) referencing `ap_payment_batches(id)` with ON DELETE SET NULL
3. THE database SHALL have a permission entry ('bank_accounts', 'view_balance') available for role assignment to Finance and Owner roles
4. THE `ap_payment_batches` table SHALL have an index on `created_by` for efficient lookup of batches by creator
5. THE migration file SHALL follow the existing naming convention using a timestamp prefix in format YYYYMMDD (e.g., `20260522_ap_payment_batches.sql`)

### Requirement 13: Supplier Group Notes

**User Story:** As a finance user, I want to add optional notes per supplier group, so that I can include payment references or instructions for each supplier's payment.

#### Acceptance Criteria

1. Each Supplier_Group card SHALL display an optional notes text input with placeholder "Catatan untuk supplier ini (opsional)" at the footer, below the invoice table and subtotal, accepting a maximum of 500 characters
2. WHEN the user enters notes for a Supplier_Group, THE Bulk_Create_Page SHALL include those notes in the "notes" field of every payment object for that supplier in the bulk payment payload, including payments split across multiple bank accounts
3. IF the user leaves the notes field empty for a Supplier_Group, THEN THE Bulk_Create_Page SHALL submit the payment payload for that supplier without a notes value and SHALL NOT block submission
