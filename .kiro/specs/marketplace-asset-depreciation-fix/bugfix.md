# Bugfix Requirements Document

## Introduction

Marketplace-sourced fixed assets (e.g., fridges, stoves, POS tablets purchased via Tokopedia) are silently excluded from depreciation runs. The `capitalizeMarketplaceAssets()` function activates these assets (DRAFT → ACTIVE) but never creates a capitalization journal entry, leaving `journal_id = NULL`. Additionally, a `journal_id IS NOT NULL` gate in the depreciation eligibility query prevents these legitimate fixed assets from being depreciated. This results in understated depreciation expense, overstated asset net book values, and incorrect financial statements.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a marketplace-sourced fixed asset is activated via `capitalizeMarketplaceAssets()` THEN the system sets `journal_id = NULL` because no capitalization journal is created

1.2 WHEN `findDepreciableAssets()` is executed with a `journal_id IS NOT NULL` gate THEN the system excludes all marketplace assets from depreciation runs because their `journal_id` is NULL

1.3 WHEN a marketplace asset is capitalized THEN the system does not create any journal entry (Dr Fixed Asset Account / Cr Cash or Clearing), resulting in an incomplete general ledger for the capitalization event

1.4 WHEN monthly depreciation is run THEN the system produces understated depreciation expense and overstated net book value because marketplace assets are skipped entirely

### Expected Behavior (Correct)

2.1 WHEN a marketplace-sourced fixed asset is activated via `capitalizeMarketplaceAssets()` THEN the system SHALL create a capitalization journal entry: Dr Fixed Asset Account (from category) / Cr Cash/Bank or Marketplace Clearing account (NOT Accounts Payable)

2.2 WHEN `findDepreciableAssets()` determines depreciation eligibility THEN the system SHALL NOT use `journal_id IS NOT NULL` as a prerequisite — eligibility SHALL be based solely on: status IN ('ACTIVE', 'MAINTENANCE') AND (cost - salvage_value) > accumulated_depreciation

2.3 WHEN a marketplace asset has a valid cost, status ACTIVE or MAINTENANCE, and remaining depreciable value > 0 THEN the system SHALL include it in depreciation runs regardless of whether `journal_id` is NULL or populated

2.4 WHEN the capitalization journal for a marketplace asset is successfully posted THEN the system SHALL update the asset's `journal_id` with the created journal header ID

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an asset is capitalized from a Purchase Invoice (AP flow) THEN the system SHALL CONTINUE TO create a capitalization journal with Dr Fixed Asset / Cr Accounts Payable and update `journal_id`

3.2 WHEN a depreciation run is executed for AP-sourced assets (those with `journal_id` populated) THEN the system SHALL CONTINUE TO depreciate them using the same straight-line calculation

3.3 WHEN a depreciation run is executed THEN the system SHALL CONTINUE TO skip fully-depreciated assets where `(cost - salvage_value) <= accumulated_depreciation`

3.4 WHEN a depreciation run is executed THEN the system SHALL CONTINUE TO skip assets in DRAFT or DISPOSED status

3.5 WHEN `activateAsset()` is called for manual activation (without invoice) THEN the system SHALL CONTINUE TO activate the asset without requiring a journal entry (no journal is created for manual activation in the current flow)
