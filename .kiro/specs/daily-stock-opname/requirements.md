# Requirements Document

## Introduction

Stock Opname Harian (Daily Closing Count) is a daily inventory control system for the READY warehouse at each branch. Every night, kitchen staff weigh remaining items in the READY warehouse, the system calculates expected balances based on opening stock + DPO transfers in - theoretical consumption from POS sales, and variances are recorded as stock movements (OUT_WASTE or IN_ADJUSTMENT). This feature is the core mechanism for food cost control, fraud detection, and operational discipline across all 5 branches.

## Glossary

- **Opname_Session**: A single daily closing count record for one branch on one date, containing all counted product lines
- **READY_Warehouse**: The warehouse type where prepared/ready-to-use ingredients are stored for daily kitchen operations (Gudang 2)
- **MAIN_Warehouse**: The primary storage warehouse per branch that holds bulk inventory (Gudang 1)
- **Expected_Balance**: The calculated quantity a product should have in READY warehouse, computed as: current READY stock balance (which already includes DPO transfers) minus theoretical consumption from POS sales. This value is snapshotted at session creation time and does not change after creation.
- **Actual_Quantity**: The physically weighed/counted quantity of a product during the closing count
- **Variance**: The difference between Actual_Quantity and Expected_Balance (actual - expected)
- **PIC**: Person In Charge — the employee assigned responsibility for a specific opname session
- **High_Risk_Product**: A product with risk_category = 'HIGH' (e.g., salmon, wagyu, udang) that requires mandatory photo proof during counting
- **Variance_Threshold**: A configurable percentage limit (default 15%) above which an opname session is automatically flagged for review
- **DPO**: Daily Prep Order — the document that transfers stock from MAIN to READY warehouse
- **Theoretical_Consumption**: The calculated expected usage of ingredients based on POS sales multiplied by recipe quantities
- **Closing_Time**: A configurable time limit by which the daily opname input must be completed and confirmed. A grace period of 15 minutes after Closing_Time is allowed for confirmation only (not new session creation or editing)
- **Stock_Movement**: A record in the stock_movements table representing a quantity change in a warehouse
- **Opname_Service**: The backend service module responsible for stock opname business logic
- **Opname_API**: The backend REST API endpoints for stock opname operations
- **Variance_Report**: A historical analysis view showing variance trends per product, branch, and period
- **Jakarta_Time**: All date and time comparisons in this feature use Asia/Jakarta timezone (UTC+7)
- **useUrlFilters**: The existing frontend library pattern (located at @/lib/urlFilters) for persisting list page filter, pagination, and search state in URL search parameters, enabling shareable links and browser navigation

## Requirements

### Requirement 1: Create Opname Session

**User Story:** As a kitchen PIC, I want to create a daily closing count session for my branch, so that I can record tonight's physical inventory count.

#### Acceptance Criteria

1. WHEN a user initiates a new opname session for a branch and date, THE Opname_Service SHALL create an Opname_Session in DRAFT status with the specified branch, date, READY warehouse, and PIC assignment
2. THE Opname_Service SHALL enforce a unique constraint of one Opname_Session per branch per date using a database-level unique index on (branch_id, closing_date) WHERE deleted_at IS NULL
3. IF an Opname_Session already exists for the same branch and date, THEN THE Opname_API SHALL return an error indicating a duplicate session
4. THE Opname_Service SHALL only allow creation of Opname_Sessions for READY_Warehouse type warehouses
5. WHEN an Opname_Session is created, THE Opname_Service SHALL auto-populate lines for all products that have a positive Expected_Balance or a positive current stock balance in the READY_Warehouse for that branch
6. WHEN populating opname lines, THE Opname_Service SHALL snapshot the MAIN_Warehouse balance for each product at the time of session creation and store it on the line record
7. IF Expected_Balance calculates to a negative value for a product, THEN THE Opname_Service SHALL clamp the Expected_Balance to zero and flag the line with a warning indicating theoretical consumption exceeds available stock

### Requirement 2: Calculate Expected Balance

**User Story:** As a kitchen PIC, I want the system to show me what the expected remaining quantity should be for each product, so that I can compare it against my physical count.

#### Acceptance Criteria

1. WHEN populating opname lines, THE Opname_Service SHALL calculate Expected_Balance for each product as: current READY stock balance from stock_balances table minus theoretical consumption for the opname date. The READY stock balance already includes all DPO IN_TRANSFER movements that have been confirmed for today, so DPO quantities are NOT added separately to the formula.
2. WHEN calculating the READY stock balance, THE Opname_Service SHALL read the current value from the stock_balances table which already reflects all prior stock movements including previous opname confirmations, DPO transfers, and any other movements
3. WHEN populating opname lines, THE Opname_Service SHALL separately query today's DPO IN_TRANSFER quantities to the READY_Warehouse (where movement_date equals the opname date) and store this value on the line record for display purposes only — it is NOT added to the Expected_Balance formula since it is already reflected in stock_balances
4. WHEN calculating theoretical consumption, THE Opname_Service SHALL use the theoretical consumption calculation from POS sales on the opname date multiplied by recipe quantities (reverse BOM explosion including WIP ingredients). This assumes POS data for the day is already synced before opname session creation.
5. IF a product has no recipe data, THEN THE Opname_Service SHALL set theoretical consumption to zero for that product and flag the line as having no recipe coverage
6. THE Opname_Service SHALL snapshot all Expected_Balance values at session creation time and store them on the line records so they remain stable during the counting process regardless of subsequent DPO confirmations or stock changes
7. WHEN determining the current date for calculations, THE Opname_Service SHALL use Jakarta_Time (Asia/Jakarta timezone) for all date boundaries
8. THE Opname_Service SHALL assume that all DPO transfers for the day have been confirmed BEFORE the opname session is created. If a DPO is confirmed after opname creation, the expected balance will not reflect that transfer (by design — snapshot is immutable)

### Requirement 3: Input Actual Quantities

**User Story:** As a kitchen PIC, I want to input the actual weighed quantities for each product in the READY warehouse, so that the system can calculate variances.

#### Acceptance Criteria

1. WHILE an Opname_Session is in DRAFT status and the current Jakarta_Time has not exceeded the configured Closing_Time, THE Opname_API SHALL allow updating actual quantities for individual product lines
2. WHEN an actual quantity is entered for a line, THE Opname_Service SHALL calculate variance as: Actual_Quantity minus Expected_Balance
3. WHEN an actual quantity is entered for a line, THE Opname_Service SHALL calculate variance cost as: variance quantity multiplied by the product cost_per_unit stored on the opname line (snapshotted at session creation)
4. IF a product has an average cost of zero or null in stock_balances at session creation time, THEN THE Opname_Service SHALL use the last known cost_per_unit from the most recent stock_movement for that product in the READY_Warehouse, or zero if no movement exists, and store this resolved cost on the opname line
5. THE Opname_Service SHALL snapshot the cost_per_unit for each product at session creation time and store it on the line record for consistent cost calculations throughout the session
6. THE Opname_Service SHALL display the snapshotted MAIN_Warehouse balance for each product as a reference value during input
7. WHILE an Opname_Session is in DRAFT status, THE Opname_API SHALL allow the PIC to update actual quantities multiple times before confirmation
8. WHEN calculating variance percentage, THE Opname_Service SHALL compute it as: (variance / Expected_Balance) × 100 when Expected_Balance is greater than zero
9. IF Expected_Balance equals zero and Actual_Quantity is greater than zero, THEN THE Opname_Service SHALL set variance percentage to null and skip threshold-based flagging for that line
10. IF Expected_Balance equals zero and Actual_Quantity equals zero, THEN THE Opname_Service SHALL set variance to zero and variance percentage to zero

### Requirement 4: Photo Proof for High-Risk Products

**User Story:** As a branch manager, I want high-risk products (salmon, wagyu, udang) to require photo proof during counting, so that the count cannot be disputed later.

#### Acceptance Criteria

1. WHEN populating opname lines, THE Opname_Service SHALL mark lines for products with risk_category = 'HIGH' as is_high_risk = true
2. WHEN confirming an Opname_Session, THE Opname_Service SHALL require photo proof for any High_Risk_Product line where Expected_Balance is greater than zero OR Actual_Quantity is greater than zero. This check is performed at confirmation time (not creation time) because Actual_Quantity may change after session creation.
3. IF a High_Risk_Product line has both Expected_Balance equal to zero and Actual_Quantity equal to zero at confirmation time, THEN THE Opname_Service SHALL waive the photo requirement for that line
4. WHEN a photo is uploaded for an opname line, THE Opname_Service SHALL store the photo in S3 and save the URL to the line record
5. THE Opname_API SHALL accept image uploads in JPEG and PNG formats with a maximum file size of 10 MB per photo
6. WHILE an Opname_Session is in DRAFT status, THE Opname_API SHALL allow any user with access to the session to upload photos for opname lines

### Requirement 5: Confirm Opname Session

**User Story:** As a kitchen PIC, I want to confirm the opname session after completing all counts, so that variances are recorded as official stock movements.

#### Acceptance Criteria

1. WHEN an Opname_Session is confirmed, THE Opname_Service SHALL validate that all lines have an actual quantity entered (no null values permitted)
2. WHEN an Opname_Session is confirmed, THE Opname_Service SHALL validate that all High_Risk_Product lines meeting the photo requirement (per Requirement 4 AC 4.2) have photo proof uploaded
3. WHEN an Opname_Session is confirmed with negative variance on a line, THE Opname_Service SHALL create an OUT_WASTE stock movement for that product in the READY_Warehouse with the absolute variance quantity
4. WHEN an Opname_Session is confirmed with positive variance on a line, THE Opname_Service SHALL create an IN_ADJUSTMENT stock movement for that product in the READY_Warehouse with the variance quantity
5. WHEN an Opname_Session is confirmed, THE Opname_Service SHALL update the stock_balances for ALL products in the READY_Warehouse to reflect the actual counted quantity. For lines with non-zero variance, this is achieved via the OUT_WASTE or IN_ADJUSTMENT movement. For lines with zero variance where stock_balances differs from actual (due to unrecorded theoretical consumption), THE Opname_Service SHALL create an OUT_ADJUSTMENT movement with the difference to reconcile the balance. No "silent" balance updates without a corresponding movement are permitted.
6. WHEN an Opname_Session is confirmed, THE Opname_Service SHALL calculate total_variance_cost as the sum of absolute values of all line variance costs and store it on the session
7. WHEN an Opname_Session is confirmed and any line (where Expected_Balance is greater than zero) has absolute variance percentage exceeding the configured Variance_Threshold, THE Opname_Service SHALL set the session status to FLAGGED instead of CONFIRMED
8. WHEN an Opname_Session is confirmed and no line exceeds the Variance_Threshold (or all exceeding lines have Expected_Balance of zero), THE Opname_Service SHALL set the session status to CONFIRMED
9. WHEN an Opname_Session is confirmed, THE Opname_Service SHALL record the confirmation timestamp and the confirming user ID
10. WHILE the current Jakarta_Time has exceeded the configured Closing_Time plus the 15-minute grace period for the branch, THE Opname_Service SHALL prevent confirmation of the Opname_Session and return an error indicating the input window has closed

### Requirement 6: Time-Based and Date Restriction

**User Story:** As a branch manager, I want opname input to be restricted to the same day only, so that staff cannot backdate or delay their counts.

#### Acceptance Criteria

1. THE Opname_Service SHALL only allow creation of Opname_Sessions for the current date in Jakarta_Time (no backdating)
2. IF a user attempts to create an Opname_Session for a past date, THEN THE Opname_API SHALL return an error indicating that backdating is not permitted
3. WHILE the current Jakarta_Time is past the configured Closing_Time for the branch, THE Opname_Service SHALL prevent creation of new Opname_Sessions for that date
4. IF the current Jakarta_Time exceeds the Closing_Time, THEN THE Opname_API SHALL prevent both creation and editing (actual quantity updates and photo uploads) of Opname_Sessions for that date
5. WHEN determining the current date, THE Opname_Service SHALL use Asia/Jakarta timezone for all date comparisons throughout the feature

### Requirement 7: Cancel Opname Session

**User Story:** As a kitchen PIC, I want to cancel a draft opname session if it was created by mistake, so that I can start fresh if needed.

#### Acceptance Criteria

1. WHILE an Opname_Session is in DRAFT status, THE Opname_API SHALL allow the PIC or a user with manager permission to cancel (soft-delete) the session
2. WHEN an Opname_Session is cancelled, THE Opname_Service SHALL soft-delete the session by setting deleted_at timestamp
3. THE Opname_Service SHALL not allow cancellation of sessions in CONFIRMED or FLAGGED status

### Requirement 8: Resolve Flagged Session

**User Story:** As a branch manager, I want to review and resolve flagged opname sessions, so that high-variance counts are acknowledged and the dashboard reflects accurate status.

#### Acceptance Criteria

1. WHILE an Opname_Session is in FLAGGED status, THE Opname_API SHALL allow a user with manager permission to resolve the session
2. WHEN resolving a FLAGGED session, THE Opname_Service SHALL require a resolution note explaining the variance
3. WHEN a FLAGGED session is resolved, THE Opname_Service SHALL update the status to CONFIRMED and record the resolving user and timestamp without creating any additional stock movements (stock movements were already created during the original confirmation)
4. THE Opname_Service SHALL not allow resolution of sessions in DRAFT or already CONFIRMED status

### Requirement 9: DPO Blocking After Opname Confirmation

**User Story:** As a system administrator, I want DPO confirmations to be blocked for a date where the opname is already confirmed, so that stock movements remain consistent with the opname record.

#### Acceptance Criteria

1. WHEN a DPO is being confirmed for a target READY_Warehouse, THE Opname_Service SHALL check if a CONFIRMED or FLAGGED Opname_Session exists for that branch and the DPO's movement date (the date the stock transfer applies to)
2. IF a CONFIRMED or FLAGGED Opname_Session exists for the same branch, same READY warehouse, and same date as the DPO movement, THEN THE Opname_Service SHALL block the entire DPO confirmation (all lines) and return an error indicating that the daily opname has already been finalized for that date
3. THE blocking check SHALL match on the DPO's target_warehouse_id against the opname session's warehouse_id to ensure only the relevant READY warehouse is considered

### Requirement 10: Stale Draft Session Handling

**User Story:** As a branch manager, I want to be notified when a draft opname session was never confirmed, so that missed counts are visible and actionable.

#### Acceptance Criteria

1. WHEN the dashboard widget displays opname status, THE Opname_API SHALL show sessions that are still in DRAFT status from previous days as "Missed" status
2. THE Opname_Service SHALL treat DRAFT sessions from previous days as expired and prevent further editing or confirmation
3. WHEN a DRAFT session from a previous day is detected, THE Opname_API SHALL display it distinctly from "Not Started" (no session exists) in the dashboard

### Requirement 11: Opname List Page

**User Story:** As a branch manager, I want to view a list of all daily closing counts with filters, so that I can monitor opname completion and review flagged sessions.

#### Acceptance Criteria

1. THE Opname_API SHALL return a paginated list of Opname_Sessions filtered by the user's accessible branches
2. WHEN listing opname sessions, THE Opname_API SHALL support filtering by date range, branch, and status (DRAFT, CONFIRMED, FLAGGED, MISSED — where MISSED represents DRAFT sessions from previous days that were never confirmed)
3. WHEN listing opname sessions, THE Opname_API SHALL return session date, branch name, PIC name, status, total variance cost, and item count for each session
4. WHEN listing opname sessions, THE Opname_API SHALL support text search by PIC name or opname reference number
5. THE frontend list page SHALL persist filter, pagination, and search state in URL search parameters using the useUrlFilters pattern

### Requirement 12: Opname Detail Page

**User Story:** As a kitchen PIC, I want a detail page showing all products to count with their expected balances, input fields, and variance calculations, so that I can efficiently complete the nightly count.

#### Acceptance Criteria

1. WHEN viewing an opname session detail, THE Opname_API SHALL return all lines with product name, product code, expected balance, actual quantity, variance, variance percentage, variance cost, photo URL, high-risk flag, requires-photo flag, MAIN warehouse balance, and recipe coverage flag
2. WHEN viewing an opname session in DRAFT status, THE Opname_API SHALL present editable input fields for actual quantities and photo uploads
3. WHEN viewing an opname session in CONFIRMED or FLAGGED status, THE Opname_API SHALL present all data in read-only mode
4. THE Opname_API SHALL display a summary section showing total expected cost (sum of expected_balance × snapshotted cost_per_unit per line), total actual cost (sum of actual_quantity × snapshotted cost_per_unit per line), total variance cost, and count completion percentage (lines with actual quantity entered vs total lines)
5. WHEN a line has variance percentage exceeding the Variance_Threshold, THE Opname_API SHALL visually highlight that line with a warning indicator
6. WHEN a line has the recipe coverage flag set to false, THE Opname_API SHALL display a visual indicator that theoretical consumption is unavailable for that product

### Requirement 13: Variance Report

**User Story:** As a branch manager, I want to view historical variance analysis per product and branch over time, so that I can identify patterns of waste or potential fraud.

#### Acceptance Criteria

1. THE Opname_API SHALL provide a variance report endpoint that aggregates variance data across confirmed and flagged opname sessions, restricted to the user's accessible branches
2. WHEN generating a variance report, THE Opname_API SHALL support filtering by date range, branch, product, and risk category
3. WHEN generating a variance report, THE Opname_API SHALL return per-product totals including: total variance quantity, total variance cost, average variance percentage, and count of sessions with variance exceeding threshold
4. WHEN generating a variance report, THE Opname_API SHALL support grouping results by day, week, or month for trend analysis
5. THE Opname_API SHALL support exporting the variance report data in CSV format with UTF-8 BOM encoding and comma delimiter, including columns: date, branch, product code, product name, expected qty, actual qty, variance qty, variance percentage, variance cost

### Requirement 14: Dashboard Widget

**User Story:** As an owner/manager, I want to see today's opname completion status per branch on the dashboard, so that I can quickly identify which branches have not yet completed their nightly count.

#### Acceptance Criteria

1. THE Opname_API SHALL provide a dashboard summary endpoint returning today's opname status for each accessible branch
2. WHEN returning dashboard data, THE Opname_API SHALL include for each branch: whether an opname session exists for today, its status, total variance cost, and completion percentage (lines with actual quantity entered vs total lines)
3. IF no opname session exists for a branch today, THEN THE Opname_API SHALL indicate the branch as "Not Started"
4. IF a DRAFT session exists from a previous day (not today), THEN THE Opname_API SHALL indicate the branch as "Missed" for that date

### Requirement 15: Audit Trail

**User Story:** As an owner, I want a complete audit trail of all opname activities, so that I can investigate discrepancies and hold staff accountable.

#### Acceptance Criteria

1. WHEN an Opname_Session is created, THE Opname_Service SHALL log an audit entry with the creating user, timestamp, and session details using the existing AuditService
2. WHEN an Opname_Session is confirmed or resolved, THE Opname_Service SHALL log an audit entry with the user, timestamp, previous status, and new status using the existing AuditService
3. WHEN an actual quantity is updated on a line, THE Opname_Service SHALL log an audit entry with the user, timestamp, product ID, previous value, and new value using the existing AuditService
4. WHEN a photo is uploaded for a line, THE Opname_Service SHALL log an audit entry with the user, timestamp, product ID, and photo URL using the existing AuditService

### Requirement 16: Integration with Stock Module

**User Story:** As a system administrator, I want opname confirmations to create proper stock movements, so that the stock balance ledger remains accurate and traceable.

#### Acceptance Criteria

1. WHEN creating OUT_WASTE movements from opname confirmation, THE Opname_Service SHALL set reference_type to 'daily_closing_count' and reference_id to the Opname_Session ID
2. WHEN creating IN_ADJUSTMENT movements from opname confirmation, THE Opname_Service SHALL set reference_type to 'daily_closing_count' and reference_id to the Opname_Session ID
3. THE Opname_Service SHALL execute all stock movements and stock_balances updates for a single opname confirmation within a single database transaction, ensuring atomicity of all balance changes
4. IF any stock movement or balance update fails during confirmation, THEN THE Opname_Service SHALL rollback the entire transaction (including all stock_movements and stock_balances changes) and return the session to DRAFT status with an error message
5. THE Opname_Service SHALL add 'daily_closing_count' to the allowed reference_type values in the stock_movements table

### Requirement 17: Variance Threshold Configuration

**User Story:** As a branch manager, I want to configure the variance threshold percentage per branch, so that flagging sensitivity can be adjusted based on branch-specific conditions.

#### Acceptance Criteria

1. THE Opname_API SHALL provide endpoints to read and update variance threshold configuration per branch
2. THE Opname_Service SHALL use a default Variance_Threshold of 15% if no branch-specific configuration exists
3. WHEN the Variance_Threshold is updated, THE Opname_Service SHALL apply the new threshold to subsequent opname confirmations only (no retroactive re-flagging)
4. THE Opname_Service SHALL store configuration in a branch_opname_config table with branch_id, variance_threshold_pct, closing_time, updated_by, and updated_at columns

### Requirement 18: Closing Time Configuration

**User Story:** As a branch manager, I want to configure the closing time deadline per branch, so that the input window matches each branch's actual operating hours.

#### Acceptance Criteria

1. THE Opname_API SHALL provide endpoints to read and update Closing_Time configuration per branch
2. THE Opname_Service SHALL use a default Closing_Time of 23:59 if no branch-specific configuration exists
3. WHEN evaluating time restrictions, THE Opname_Service SHALL use Jakarta_Time (Asia/Jakarta timezone) for all time comparisons
4. THE Opname_Service SHALL store the Closing_Time in the same branch_opname_config table as the variance threshold

### Requirement 19: Correction of Confirmed Session (Phase 2)

**User Story:** As a branch manager, I want to correct a confirmed opname session if a mistake is discovered, so that stock records remain accurate without requiring manual stock adjustments.

#### Acceptance Criteria

1. WHILE an Opname_Session is in CONFIRMED or FLAGGED status, THE Opname_API SHALL allow a user with admin permission to initiate a correction
2. WHEN a correction is initiated, THE Opname_Service SHALL create a new Opname_Session linked to the original session with status DRAFT and type 'CORRECTION', pre-populated with the original actual quantities as the new expected values
3. WHEN a correction session is confirmed, THE Opname_Service SHALL create reversal stock movements for the original session's movements and new movements for the corrected values, all within a single transaction
4. THE Opname_Service SHALL mark the original session as 'CORRECTED' and link it to the correction session for audit trail
5. THIS REQUIREMENT IS DEFERRED TO PHASE 2 — for the initial release, corrections should be handled via the existing Stock Adjustment feature (manual OUT_ADJUSTMENT / IN_ADJUSTMENT with notes referencing the opname session)

### Requirement 20: Assumptions and Operational Prerequisites

**User Story:** As a system administrator, I want the operational prerequisites for stock opname to be clearly documented, so that the feature works correctly within the expected workflow.

#### Acceptance Criteria

1. THE system SHALL assume that POS data for the current day is synced before the opname session is created. If POS sync has not occurred, theoretical consumption will be zero and expected balance will be higher than actual.
2. THE system SHALL assume that all DPO transfers for the day have been confirmed before the opname session is created. Late DPO confirmations after opname creation will not affect the snapshotted expected balance.
3. THE system SHALL assume that the opname is performed AFTER the kitchen closes for the day (no more sales or DPO transfers expected after opname creation).
4. IF notifications are needed for approaching closing time, missed opname, or flagged sessions, THESE SHALL be implemented as a separate enhancement and are not part of the initial release.
