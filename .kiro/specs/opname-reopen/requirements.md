# Requirements Document

## Introduction

This feature adds the ability for a PIC (Person In Charge) to request re-editing of a confirmed or flagged daily stock opname session. The reopen flow involves an approval workflow where authorized approvers can approve or reject the request. Upon approval, the system reverses stock movements, clears variance classifications, and allows the PIC to re-enter actual quantities and re-confirm the session.

## Glossary

- **System**: The Suryamas ERP backend application
- **PIC**: Person In Charge — the user assigned to a daily stock opname session
- **Approver**: A user who holds the `approve` permission on the `daily_stock_opname` module for the relevant branch
- **Reopen_Request**: A record in the `opname_reopen_requests` table representing a request to reopen a confirmed/flagged session
- **Session**: A `daily_closing_counts` record representing one daily stock opname session
- **Stock_Movement**: A record in the `stock_movements` table representing an inventory quantity change
- **Counter_Movement**: A stock movement that reverses a previously created movement (IN_REVERSAL reverses OUT_WASTE, OUT_REVERSAL reverses IN_ADJUSTMENT)
- **Variance_Classification**: Entries in the classification table categorizing variance lines as WASTE or SHORTAGE
- **DPO_Blocking**: The existing rule that prevents opname confirmation while an active Daily Prep Order exists for the same branch and date
- **Notification_Dispatcher**: The existing notification system that dispatches events to target users

## Requirements

### Requirement 1: Reopen Request Creation

**User Story:** As a PIC, I want to request permission to edit a confirmed or flagged opname session, so that I can correct mistakes in actual quantities.

#### Acceptance Criteria

1. WHEN the PIC clicks "Minta Izin Edit" on a session with status CONFIRMED or FLAGGED, THE System SHALL create a Reopen_Request with status PENDING, storing the closing_id, requested_by (current user), requested_at (current timestamp), and the provided reason.
2. IF the session status is not CONFIRMED or FLAGGED, THEN THE System SHALL reject the request and return an error indicating the session is not eligible for reopening.
3. IF a PENDING Reopen_Request already exists for the same session, THEN THE System SHALL reject the request and return an error indicating a pending request already exists.
4. THE System SHALL require the reason field to be non-empty when creating a Reopen_Request.

### Requirement 2: Reopen Request Notification

**User Story:** As an approver, I want to be notified when a PIC requests to reopen an opname session, so that I can review and respond promptly.

#### Acceptance Criteria

1. WHEN a Reopen_Request is created with status PENDING, THE System SHALL dispatch a notification with event key OPNAME_REOPEN_REQUESTED to all users who hold the `approve` permission on `daily_stock_opname` for the session's branch.
2. THE System SHALL include the branch name, closing date, and PIC name in the notification message.
3. THE System SHALL set the notification redirect URL to the session detail page.

### Requirement 3: Reopen Request Approval

**User Story:** As an approver, I want to approve a reopen request, so that the PIC can correct the opname data.

#### Acceptance Criteria

1. WHEN an Approver approves a PENDING Reopen_Request, THE System SHALL update the request status to APPROVED, set responded_by to the approver's user ID, responded_at to the current timestamp, and store the optional response_note.
2. WHEN a Reopen_Request status changes to APPROVED, THE System SHALL change the associated session status to REOPENED.
3. IF the Reopen_Request status is not PENDING, THEN THE System SHALL reject the approval action and return an error indicating the request has already been responded to.
4. IF the user does not hold the `approve` permission on `daily_stock_opname` for the session's branch, THEN THE System SHALL reject the action with a permission denied error.

### Requirement 4: Reopen Request Rejection

**User Story:** As an approver, I want to reject a reopen request when the reason is not justified, so that unnecessary edits are prevented.

#### Acceptance Criteria

1. WHEN an Approver rejects a PENDING Reopen_Request, THE System SHALL update the request status to REJECTED, set responded_by to the approver's user ID, responded_at to the current timestamp, and store the optional response_note.
2. WHEN a Reopen_Request is rejected, THE System SHALL keep the session status unchanged (CONFIRMED or FLAGGED).
3. WHEN a Reopen_Request is rejected, THE System SHALL allow the PIC to create a new Reopen_Request for the same session.
4. THE System SHALL not send a notification back to the PIC upon rejection.

### Requirement 5: Stock Movement Reversal on Approval

**User Story:** As a system operator, I want stock movements to be reversed when a session is reopened, so that inventory balances are correct during the re-edit period.

#### Acceptance Criteria

1. WHEN a session status changes to REOPENED, THE System SHALL create counter-movements for all stock movements associated with the session: an IN_REVERSAL movement for each existing OUT_WASTE movement, and an OUT_REVERSAL movement for each existing IN_ADJUSTMENT movement.
2. THE System SHALL set each counter-movement quantity equal to the absolute quantity of the original movement being reversed.
3. THE System SHALL set each counter-movement's cost_per_unit equal to the original movement's cost_per_unit.
4. THE System SHALL set the reference_type to `daily_closing_count` and reference_id to the session ID for all counter-movements.
5. THE System SHALL update the stock balance for each affected product in the session's warehouse after creating counter-movements.

### Requirement 6: Classification Deletion on Approval

**User Story:** As a system operator, I want variance classifications to be cleared when a session is reopened, so that fresh classifications can be applied after re-confirmation.

#### Acceptance Criteria

1. WHEN a session status changes to REOPENED, THE System SHALL delete all variance classification entries associated with the session.
2. THE System SHALL reset the classification summary (waste_total, shortage_total, entry_count) for the session.

### Requirement 7: Reopened Session Editing

**User Story:** As a PIC, I want to edit actual quantities on a reopened session without time restrictions, so that I can correct inaccurate counts.

#### Acceptance Criteria

1. WHILE a session has status REOPENED, THE System SHALL allow the PIC to update actual_qty on all lines of the session.
2. WHILE a session has status REOPENED, THE System SHALL pre-fill the actual_qty fields with previously confirmed values (not reset to NULL).
3. WHILE a session has status REOPENED, THE System SHALL not enforce closing_time restrictions on line edits.
4. WHILE a session has status REOPENED, THE System SHALL continue to enforce DPO_Blocking rules when the PIC attempts to re-confirm.

### Requirement 8: Re-Confirmation of Reopened Session

**User Story:** As a PIC, I want to re-confirm a reopened session after corrections, so that the updated quantities become the official record.

#### Acceptance Criteria

1. WHEN the PIC confirms a session with status REOPENED, THE System SHALL create new stock movements based on the updated actual quantities (OUT_WASTE for negative variance, IN_ADJUSTMENT for positive variance).
2. WHEN the PIC confirms a session with status REOPENED, THE System SHALL re-evaluate the variance threshold and set the session status to CONFIRMED or FLAGGED accordingly.
3. WHEN the PIC confirms a session with status REOPENED, THE System SHALL recalculate total_variance_cost, total_expected_cost, and total_actual_cost based on the updated line values.
4. WHEN the PIC confirms a session with status REOPENED, THE System SHALL update confirmed_by and confirmed_at with the current user and timestamp.

### Requirement 9: Reopen Request Data Storage

**User Story:** As a system administrator, I want reopen requests stored in a dedicated table, so that there is a complete audit trail of all reopen activities.

#### Acceptance Criteria

1. THE System SHALL store Reopen_Requests in a separate `opname_reopen_requests` table with columns: id (UUID), closing_id (FK), requested_by (FK), requested_at (timestamp), reason (text), status (PENDING/APPROVED/REJECTED), responded_by (FK nullable), responded_at (timestamp nullable), response_note (text nullable).
2. THE System SHALL retain all Reopen_Request records regardless of status for audit purposes.
3. WHEN a Reopen_Request is created or updated, THE System SHALL log the action via AuditService with entity_type `opname_reopen_request`, the request ID as entity_id, and the acting user as changed_by.

### Requirement 10: Session Status Enum Extension

**User Story:** As a developer, I want the session status enum to include REOPENED, so that the system can distinguish sessions currently being re-edited.

#### Acceptance Criteria

1. THE System SHALL support the REOPENED status value in the session status field alongside existing DRAFT, CONFIRMED, and FLAGGED values.
2. WHILE a session has status REOPENED, THE System SHALL display the session as "Sedang Diedit Ulang" in the frontend interface.
3. WHILE a session has status REOPENED, THE System SHALL prevent other users from creating a new opname session for the same branch, warehouse, position, and closing_date.
