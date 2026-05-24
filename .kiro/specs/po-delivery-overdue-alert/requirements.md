# Requirements Document

## Introduction

This feature adds a delivery overdue alert to the Purchase Orders list page. The system calculates whether a PO's expected delivery is overdue based on the shortest lead time among its line items' supplier products. An overdue indicator (warning icon with tooltip) is displayed on the PO list, and the calculation is performed server-side to support future sorting and filtering.

## Glossary

- **PO_System**: The Purchase Orders module backend API responsible for querying and returning purchase order data
- **PO_List_UI**: The Purchase Orders list page frontend component that renders the table/card layout
- **Overdue_Days**: The number of days a purchase order delivery is past its expected arrival, calculated as `current_date - (order_date + minimum_lead_time_days)`
- **Minimum_Lead_Time**: The shortest `lead_time_days` value among all supplier_products linked to a PO's line items, with fallback to the supplier-level `lead_time_days`
- **Eligible_PO**: A purchase order with status SENT, ORDERED, or PARTIAL_RECEIVED that has not been fully received
- **Confirmed_Goods_Receipt**: A goods receipt record linked to a PO with status CONFIRMED

## Requirements

### Requirement 1: Overdue Days Calculation

**User Story:** As a procurement manager, I want to see how many days a PO delivery is overdue, so that I can follow up with suppliers on late deliveries.

#### Acceptance Criteria

1. WHEN the PO list is queried, THE PO_System SHALL calculate overdue_days for each Eligible_PO using the formula: `current_date - (order_date + Minimum_Lead_Time)`
2. WHEN calculating Minimum_Lead_Time, THE PO_System SHALL use the smallest `lead_time_days` value from the supplier_products records linked to the PO's line items via `supplier_product_id`
3. IF all supplier_products for a PO's line items have NULL `lead_time_days`, THEN THE PO_System SHALL fall back to the `lead_time_days` value from the suppliers table for that PO's supplier
4. WHEN overdue_days is zero or negative, THE PO_System SHALL return NULL for the overdue_days field
5. WHEN overdue_days is greater than zero, THE PO_System SHALL return the positive integer value representing days overdue

### Requirement 2: PO Status Eligibility

**User Story:** As a procurement manager, I want overdue alerts only on POs that are awaiting delivery, so that completed or cancelled orders do not show false alerts.

#### Acceptance Criteria

1. THE PO_System SHALL calculate overdue_days only for purchase orders with status SENT, ORDERED, or PARTIAL_RECEIVED
2. THE PO_System SHALL return NULL for overdue_days for purchase orders with status DRAFT, PENDING_APPROVAL, APPROVED, FULLY_RECEIVED, CLOSED, or CANCELLED

### Requirement 3: Goods Receipt Exclusion

**User Story:** As a procurement manager, I want POs that already have confirmed goods receipts to be excluded from overdue calculation (for SENT/ORDERED), so that delivered POs are not flagged incorrectly.

#### Acceptance Criteria

1. WHEN a PO with status SENT or ORDERED has at least one Confirmed_Goods_Receipt, THE PO_System SHALL return NULL for overdue_days
2. WHEN a PO with status PARTIAL_RECEIVED is queried, THE PO_System SHALL still calculate overdue_days based on the original order_date and Minimum_Lead_Time, since unreceived items remain outstanding

### Requirement 4: API Response Field

**User Story:** As a frontend developer, I want the overdue_days value included in the PO list API response, so that I can display the overdue indicator without additional API calls.

#### Acceptance Criteria

1. THE PO_System SHALL include an `overdue_days` field of type `number | null` in each purchase order object within the list API response
2. THE PO_System SHALL compute overdue_days during the list query execution so the field is available for future sorting and filtering

### Requirement 5: Overdue Warning Display

**User Story:** As a procurement manager, I want a visual warning on overdue POs in the list, so that I can quickly identify which orders need attention.

#### Acceptance Criteria

1. WHEN a PO has overdue_days greater than zero, THE PO_List_UI SHALL display a warning icon (⚠️) in the PO list row
2. WHEN the user hovers over or taps the warning icon, THE PO_List_UI SHALL display a tooltip showing the number of overdue days
3. WHEN the user hovers over or taps the warning icon, THE PO_List_UI SHALL display in the tooltip which item (product name) has the shortest lead time that triggered the overdue calculation
4. WHEN a PO has overdue_days as NULL, THE PO_List_UI SHALL not display any warning indicator for that PO

### Requirement 6: Mobile Layout Support

**User Story:** As a procurement manager using a mobile device, I want to see the overdue alert on the mobile card layout, so that I have the same visibility regardless of device.

#### Acceptance Criteria

1. WHEN a PO has overdue_days greater than zero and the PO list is rendered in mobile card layout, THE PO_List_UI SHALL display the warning icon within the card
2. WHEN the warning icon is tapped on mobile, THE PO_List_UI SHALL display the overdue details (days late and triggering item name)
