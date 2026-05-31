# Requirements Document

## Introduction

Manual DPO (Daily Prep Order) allows users to create stock transfer orders from MAIN warehouse to READY warehouse without relying on forecast calculations. Users manually select products and specify transfer quantities directly. Manual DPOs reuse the same `daily_prep_orders` table and follow the same confirm flow (lock → confirm → stock movements) and opname blocking rules as forecast-generated DPOs.

## Glossary

- **DPO_System**: The Daily Prep Order module responsible for creating, managing, and confirming stock transfer orders between warehouses
- **Manual_DPO**: A Daily Prep Order created by the user without forecast calculation, where the user directly specifies products and transfer quantities
- **Forecast_DPO**: A Daily Prep Order generated automatically using sales forecast algorithms
- **MAIN_Warehouse**: The source warehouse from which stock is transferred out
- **READY_Warehouse**: The target warehouse into which stock is transferred in
- **Confirmed_Qty**: The final transfer quantity per line that becomes the stock movement amount upon confirmation
- **DPO_Creation_Form**: The full-page form where users configure a Manual DPO header and add product lines
- **Product_Search**: The interface allowing users to search and select products from the product list
- **Station_Code**: A position code used to optionally filter products by preparation station

## Requirements

### Requirement 1: Manual DPO Entry Point

**User Story:** As a warehouse operator, I want a dedicated "Manual DPO" button on the DPO list page, so that I can create a transfer order without running the forecast calculation.

#### Acceptance Criteria

1. WHEN the user has `daily_prep_orders.insert` permission, THE DPO_System SHALL display a "Manual DPO" button on the DPO list page alongside the existing "Generate DPO" button.
2. WHEN the user clicks the "Manual DPO" button, THE DPO_System SHALL navigate to a full-page DPO creation form.
3. IF the user does not have `daily_prep_orders.insert` permission, THEN THE DPO_System SHALL hide the "Manual DPO" button.

### Requirement 2: Manual DPO Header Configuration

**User Story:** As a warehouse operator, I want to specify the branch, warehouses, and date for my manual transfer order, so that the system knows where and when to move stock.

#### Acceptance Criteria

1. THE DPO_Creation_Form SHALL require the user to select a branch from the list of branches the user has access to.
2. THE DPO_Creation_Form SHALL require the user to select a source warehouse (MAIN_Warehouse).
3. THE DPO_Creation_Form SHALL require the user to select a target warehouse (READY_Warehouse).
4. THE DPO_Creation_Form SHALL require the user to select a prep_date (operational date).
5. THE DPO_Creation_Form SHALL allow the user to optionally enter notes.
6. IF the user submits the form without selecting branch, source warehouse, target warehouse, or prep_date, THEN THE DPO_System SHALL display a validation error indicating the missing fields.

### Requirement 3: Product Line Management

**User Story:** As a warehouse operator, I want to search and add products to my manual DPO with a transfer quantity, so that I can specify exactly what to transfer.

#### Acceptance Criteria

1. THE DPO_Creation_Form SHALL provide a Product_Search interface to find products from the product list.
2. WHEN the user searches for a product, THE Product_Search SHALL return matching products by product name or product code.
3. WHEN the user selects a product from search results, THE DPO_System SHALL add the product as a new line on the form.
4. THE DPO_Creation_Form SHALL require the user to enter a transfer quantity (confirmed_qty) for each product line.
5. IF the user enters a transfer quantity less than or equal to zero, THEN THE DPO_System SHALL display a validation error for that line.
6. THE DPO_Creation_Form SHALL allow the user to remove a product line before submission.
7. IF the user submits the form with zero product lines, THEN THE DPO_System SHALL display a validation error indicating at least one product line is required.

### Requirement 4: Station Code Filtering

**User Story:** As a warehouse operator, I want to optionally filter the product search by station codes, so that I can narrow down products relevant to a specific preparation station.

#### Acceptance Criteria

1. THE DPO_Creation_Form SHALL allow the user to optionally select one or more station_codes before searching for products.
2. WHEN station_codes are selected, THE Product_Search SHALL return only products assigned to the selected station_codes.
3. WHEN no station_codes are selected, THE Product_Search SHALL return products from all stations.

### Requirement 5: Manual DPO Creation (Backend)

**User Story:** As a warehouse operator, I want the system to persist my manual DPO with the correct data structure, so that it integrates seamlessly with the existing DPO workflow.

#### Acceptance Criteria

1. WHEN the user submits a valid Manual DPO form, THE DPO_System SHALL create a record in the `daily_prep_orders` table with status DRAFT.
2. WHEN creating a Manual DPO, THE DPO_System SHALL generate a DPO number using the same numbering sequence as Forecast_DPOs.
3. WHEN creating a Manual DPO, THE DPO_System SHALL set forecast-related columns (weight_7d, weight_30d, weight_dow, coverage_days, holiday_factor_applied) to 0 or default values.
4. WHEN creating a Manual DPO, THE DPO_System SHALL set has_upcoming_holiday to false.
5. WHEN creating a Manual DPO, THE DPO_System SHALL store each product line in `daily_prep_order_lines` with the user-specified quantity as confirmed_qty.
6. WHEN creating a Manual DPO line, THE DPO_System SHALL set forecast-related line columns (avg_sales_7d, avg_sales_30d, avg_sales_dow, predicted_need, suggested_qty) to 0.
7. WHEN creating a Manual DPO line, THE DPO_System SHALL set current_ready_stock and current_main_stock to the live stock values at creation time.
8. THE DPO_System SHALL enforce branch access checks — the user can only create a Manual DPO for branches the user has access to.

### Requirement 6: Manual DPO Confirm Flow

**User Story:** As a warehouse operator, I want manual DPOs to follow the same confirmation process as forecast DPOs, so that stock movements are created consistently.

#### Acceptance Criteria

1. WHEN a Manual DPO is in DRAFT status, THE DPO_System SHALL allow the user to acquire a lock before confirming.
2. WHEN the user confirms a Manual DPO, THE DPO_System SHALL create OUT_TRANSFER stock movements from MAIN_Warehouse and IN_TRANSFER stock movements to READY_Warehouse for each line with confirmed_qty greater than 0.
3. WHEN the user confirms a Manual DPO, THE DPO_System SHALL update warehouse balances using weighted average cost.
4. IF the MAIN_Warehouse stock for a product is less than the confirmed_qty, THEN THE DPO_System SHALL reject the confirmation with an insufficient stock error.
5. WHILE a daily stock opname session is confirmed for the same branch and prep_date, THE DPO_System SHALL block confirmation of the Manual DPO.

### Requirement 7: Manual DPO in List View

**User Story:** As a warehouse operator, I want manual DPOs to appear in the same list as forecast DPOs, so that I have a unified view of all transfer orders.

#### Acceptance Criteria

1. THE DPO_System SHALL display Manual DPOs in the same list page as Forecast_DPOs without visual distinction.
2. THE DPO_System SHALL apply the same filters (branch, status, date range) to Manual DPOs as to Forecast_DPOs.
3. WHEN the user clicks a Manual DPO in the list, THE DPO_System SHALL navigate to the same detail page used for Forecast_DPOs.

### Requirement 8: Manual DPO Edit and Cancel

**User Story:** As a warehouse operator, I want to edit line quantities or cancel a manual DPO while it is still in draft, so that I can correct mistakes before confirming.

#### Acceptance Criteria

1. WHILE a Manual DPO is in DRAFT status, THE DPO_System SHALL allow the user to update confirmed_qty on existing lines.
2. WHILE a Manual DPO is in DRAFT status, THE DPO_System SHALL allow the user to delete individual lines.
3. WHILE a Manual DPO is in DRAFT status, THE DPO_System SHALL allow the user to cancel (soft delete) the entire DPO.
4. IF the Manual DPO status is CONFIRMED, THEN THE DPO_System SHALL reject any edit or cancel operations.
