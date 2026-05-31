# Requirements Document

## Introduction

This feature adds a mandatory multi-select station filter to the DPO (Daily Prep Order) generation flow. Products are assigned to stations (positions) via the `station` field (stored as `position_code` referencing the `positions` table). When generating a DPO, the user must select one or more stations, and only products belonging to those stations are included in the forecast calculation and resulting DPO lines. The filter is applied at the backend/SQL level to ensure data consistency.

## Glossary

- **DPO_System**: The Daily Prep Order module responsible for generating, displaying, and confirming prep orders
- **Generate_Modal**: The frontend modal dialog used to configure and trigger DPO generation
- **Station**: A production position/area (e.g., "Grill", "Fryer", "Pastry") stored in the `positions` table with `position_code` and `position_name`
- **Station_Filter**: The multi-select dropdown in the Generate Modal that allows selecting one or more stations
- **GenerateDpoDto**: The data transfer object sent from frontend to backend containing DPO generation parameters
- **calcForecastLines**: The backend SQL query that calculates forecast lines based on historical sales data

## Requirements

### Requirement 1: Station Selection UI

**User Story:** As a branch operator, I want to select one or more stations when generating a DPO, so that only products relevant to those stations are included in the forecast.

#### Acceptance Criteria

1. WHEN the Generate_Modal is opened, THE DPO_System SHALL display a multi-select Station_Filter dropdown populated with all active stations from the positions API.
2. THE DPO_System SHALL label the Station_Filter field as mandatory with a required indicator.
3. WHEN the user selects one or more stations, THE Station_Filter SHALL display the selected station names as tags or chips within the dropdown.
4. WHEN the user attempts to deselect all stations leaving zero selected, THE Station_Filter SHALL retain at least one station selected.

### Requirement 2: Station Selection Validation

**User Story:** As a branch operator, I want the system to prevent DPO generation without station selection, so that incomplete orders are never created.

#### Acceptance Criteria

1. WHEN the user clicks the Generate button with no stations selected, THE DPO_System SHALL display a validation error message indicating that at least one station is required.
2. WHEN the user clicks the Generate button with no stations selected, THE DPO_System SHALL prevent the API request from being sent.
3. WHEN at least one station is selected and all other required fields are filled, THE DPO_System SHALL enable the Generate button for submission.

### Requirement 3: Backend DTO Extension

**User Story:** As a developer, I want the GenerateDpoDto to include station identifiers, so that the backend can filter products by station during forecast calculation.

#### Acceptance Criteria

1. THE DPO_System SHALL accept a `station_codes` field in the GenerateDpoDto containing an array of position_code strings.
2. WHEN the `station_codes` field is empty or missing, THE DPO_System SHALL reject the request with a 400 validation error.
3. THE DPO_System SHALL validate that each value in `station_codes` is a non-empty string.

### Requirement 4: Backend Forecast Filtering

**User Story:** As a branch operator, I want only products from selected stations included in the DPO forecast, so that the prep order is focused on the relevant production areas.

#### Acceptance Criteria

1. WHEN generating forecast lines, THE DPO_System SHALL filter products to include only those whose `station` field (position_code) matches one of the provided station_codes.
2. WHEN a product has a NULL or empty station value, THE DPO_System SHALL exclude that product from the forecast results when station filtering is applied.
3. THE DPO_System SHALL apply the station filter at the SQL query level within the calcForecastLines method.

### Requirement 5: Station Data Persistence

**User Story:** As a branch operator, I want to see which stations were selected when viewing a DPO, so that I can understand the scope of the prep order.

#### Acceptance Criteria

1. WHEN a DPO is generated with selected stations, THE DPO_System SHALL store the selected station_codes in the DPO header record.
2. WHEN viewing a DPO detail, THE DPO_System SHALL display the stations that were used during generation.

### Requirement 6: Multi-Station DPO Lines

**User Story:** As a branch operator, I want a single DPO to contain lines from multiple stations, so that I can prepare a combined order for several production areas at once.

#### Acceptance Criteria

1. WHEN multiple stations are selected, THE DPO_System SHALL include products from all selected stations in a single DPO.
2. WHEN viewing DPO lines, THE DPO_System SHALL display the station name for each line item as already provided by the existing `station` field in DailyPrepOrderLineWithRelations.
