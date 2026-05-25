# Daily Prep Orders — Requirements

## User Stories

---

### 1. Melihat Daftar DPO

As a **branch admin**,
I want to see a list of Daily Prep Orders filtered by branch, status, and date range,
so that I can monitor the prep workflow for my branch.

**Acceptance Criteria**

- WHEN the user opens the DPO list page
  THEN the system SHALL display a paginated table of DPOs with columns:
  DPO Number, Branch, Prep Date, Status, Line Count, Confirmed By, Created At, and Actions

- WHEN the user applies a filter (branch, status, date range)
  THEN the system SHALL refresh the table to show only matching DPOs

- WHEN a DPO has status DRAFT
  THEN the system SHALL display the status badge in yellow

- WHEN a DPO has status CONFIRMED
  THEN the system SHALL display the status badge in green

- WHEN a DPO has status CANCELLED
  THEN the system SHALL display the status badge in gray

---

### 2. Generate DPO Baru

As a **branch admin**,
I want to generate a new DPO for a specific branch and prep date,
so that the system can calculate the material transfer needs automatically.

**Acceptance Criteria**

- WHEN the user clicks "Generate DPO"
  THEN the system SHALL open a dialog with fields:
  Branch, Prep Date, Source Warehouse, Target Warehouse, Notes

- WHEN the user selects a branch and prep date that already has an existing DRAFT DPO
  THEN the system SHALL display a warning:
  "DPO untuk branch dan tanggal ini sudah ada dan akan di-replace otomatis"

- WHEN the user submits the generate form with valid data
  THEN the system SHALL call POST /generate and redirect to the DPO detail page on success

- WHEN the forecast config for the selected branch has not been set up
  THEN the system SHALL display an error with a link to the Config page

---

### 3. Melihat Detail DPO

As a **branch admin**,
I want to see the full detail of a DPO including all product lines,
so that I can review the system's suggestions before confirming.

**Acceptance Criteria**

- WHEN the user opens a DPO detail page
  THEN the system SHALL display: DPO Number, Branch, Prep Date, Status, Source/Target Warehouse,
  forecast weights (7d/30d/DOW), coverage days, and holiday info

- WHEN `has_upcoming_holiday` is true
  THEN the system SHALL display a holiday warning badge on the header

- WHEN the DPO detail is loaded
  THEN the system SHALL display the lines table with columns:
  Product (code + name), Avg Sales (7d/30d/DOW), Predicted Need,
  Ready Stock, Main Stock, Suggested Qty, Confirmed Qty, Notes, Actions

- WHEN `live_ready_stock` differs from `current_ready_stock`
  THEN the system SHALL display a visual indicator on the Ready Stock cell
  AND show a tooltip: "Stok bergerak sejak DPO di-generate"

- WHEN the DPO status is CONFIRMED
  THEN the system SHALL display confirmed_by_name and confirmed_at in the header

- WHEN the DPO status is CANCELLED
  THEN the system SHALL display cancel_reason and cancelled_at in the header

---

### 4. Edit Lines DPO

As a **branch admin**,
I want to edit the confirmed_qty and notes for each product line in a DRAFT DPO,
so that I can adjust the system suggestion before confirming.

**Acceptance Criteria**

- WHEN the DPO status is DRAFT
  THEN the system SHALL render confirmed_qty and notes as editable inputs in the lines table

- WHEN the user changes any confirmed_qty or notes value
  THEN the system SHALL track the dirty state and display a "Simpan Perubahan" button

- WHEN the user clicks "Simpan Perubahan"
  THEN the system SHALL call PUT /:id/lines with only the modified lines
  AND display a success toast on completion

- WHEN the DPO status is CONFIRMED or CANCELLED
  THEN the system SHALL render all line fields as read-only

- WHEN the user clicks the delete button on a line (DRAFT only)
  THEN the system SHALL show a confirmation prompt
  AND call DELETE /:id/lines/:lineId on confirm

---

### 5. Konfirmasi DPO (Optimistic Lock Flow)

As a **branch admin**,
I want to confirm a DRAFT DPO so that the system transfers stock from MAIN to READY,
so that the kitchen has the correct ingredients ready for the day.

**Acceptance Criteria**

- WHEN the user clicks "Konfirmasi DPO" on a DRAFT DPO
  THEN the system SHALL call POST /:id/acquire-lock first
  AND store the returned lock_token in component state
  AND open the Confirm Dialog

- WHEN the Confirm Dialog is open
  THEN the system SHALL display a countdown timer starting from 5 minutes

- WHEN the timer reaches 0
  THEN the system SHALL disable the confirm button
  AND display: "Sesi konfirmasi expired. Klik Muat Ulang untuk mencoba lagi."
  AND display a "Muat Ulang" button that re-calls acquire-lock

- WHEN the user clicks "Ya, Konfirmasi" in the dialog
  THEN the system SHALL call POST /:id/confirm with the stored lock_token

- WHEN the confirm call returns DpoLockConflictError
  THEN the system SHALL display: "DPO sedang dikonfirmasi oleh pengguna lain"
  AND disable the confirm button

- WHEN the confirm call returns DpoInsufficientMainStockError
  THEN the system SHALL display an error alert in the dialog showing the product name,
  available qty, and requested qty

- WHEN the confirm call returns DpoNoLinesError
  THEN the system SHALL display: "Semua qty = 0, tidak ada yang bisa di-transfer"

- WHEN the confirm call succeeds
  THEN the system SHALL close the dialog, show a success toast,
  and invalidate the DPO detail query

---

### 6. Cancel DPO

As a **branch admin**,
I want to cancel a DRAFT DPO with a reason,
so that the prep plan can be discarded without affecting stock.

**Acceptance Criteria**

- WHEN the user clicks "Cancel DPO" on a DRAFT DPO
  THEN the system SHALL open a Cancel Dialog with a required reason text field

- WHEN the user submits with an empty reason
  THEN the system SHALL display a validation error: "Alasan cancel wajib diisi"

- WHEN the user submits a valid reason
  THEN the system SHALL call POST /:id/cancel
  AND refresh the DPO detail on success

---

### 7. Hapus DPO (Soft Delete)

As a **branch admin**,
I want to permanently remove a DRAFT DPO from the list,
so that erroneous entries do not clutter the list.

**Acceptance Criteria**

- WHEN the user clicks "Hapus" on a DRAFT DPO
  THEN the system SHALL show a confirmation dialog

- WHEN the user confirms deletion
  THEN the system SHALL call DELETE /:id
  AND redirect to the DPO list on success

- WHEN the DPO status is not DRAFT
  THEN the system SHALL NOT display the delete action

---

### 8. Kelola Forecast Config per Branch

As a **superadmin**,
I want to configure the forecast weights and parameters per branch,
so that each branch's DPO generation uses the correct calculation parameters.

**Acceptance Criteria**

- WHEN the user opens the Config page and selects a branch
  THEN the system SHALL load and display the existing config for that branch

- WHEN the user edits weight_7d, weight_30d, or weight_dow
  THEN the system SHALL display a real-time sum indicator
  AND show the indicator in green if sum = 1.00 (tolerance 0.001)
  AND show the indicator in red if sum ≠ 1.00

- WHEN the sum of weights is not equal to 1.00
  THEN the system SHALL disable the Save button

- WHEN the user submits a valid config
  THEN the system SHALL call PUT /config and show a success toast

---

### 9. Kelola Hari Libur

As a **superadmin**,
I want to manage public holidays for the company,
so that the DPO forecast automatically applies a holiday factor on those dates.

**Acceptance Criteria**

- WHEN the user opens the Holidays page
  THEN the system SHALL display a table of holidays filterable by year

- WHEN the user fills in holiday_date and holiday_name and submits
  THEN the system SHALL call PUT /holidays and refresh the table

- WHEN the user clicks "Hapus" on a holiday
  THEN the system SHALL show a confirmation dialog
  AND call DELETE /holidays/:holidayId on confirm
