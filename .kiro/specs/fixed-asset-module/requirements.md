# Requirements Document

## Introduction

The Fixed Asset Module manages the full lifecycle of capital assets (buildings, furniture, kitchen equipment, IT equipment, vehicles) across a multi-company, multi-branch ERP system. Phase 1 covers asset categories, asset master records, capitalization from purchase invoices, straight-line depreciation runs, intra-branch transfers, maintenance tracking, disposal with gain/loss recognition, and QR code generation for physical identification. Assets bypass the warehouse/stock system entirely and are tracked in a dedicated `fixed_assets` table.

## Glossary

- **Asset_Module**: The backend module responsible for fixed asset lifecycle management, located at `backend/src/modules/fixed-assets/`
- **Asset_Category**: A classification record defining the COA mapping and default useful life for a group of assets (e.g., BLD, FRN, KTE, ITE, VCL)
- **Fixed_Asset**: A master record representing a single capital asset with cost, salvage value, useful life, depreciation state, and current status
- **Asset_Request**: A dedicated purchase request page for asset-type products, separate from the consumable PR flow
- **Depreciation_Run**: A batch process that calculates and posts monthly straight-line depreciation entries for all active assets in a company for a given fiscal period
- **Asset_Transfer**: An intra-company operation that reassigns an asset from one branch to another without generating a journal entry
- **Asset_Maintenance**: A record of repair or maintenance work performed on an asset, generating an expense journal entry
- **Asset_Disposal**: The process of retiring an asset from service, clearing its cost and accumulated depreciation, and recognizing any gain or loss
- **Asset_Movement**: An audit trail record that logs every state change, transfer, maintenance event, or disposal for a fixed asset
- **Capitalize**: The act of converting a draft asset record to ACTIVE status by posting a journal entry (Dr Asset Cost / Cr AP) when the associated purchase invoice is posted
- **Straight_Line_Depreciation**: Depreciation method calculated as (cost - salvage_value) / useful_life_months per month
- **QR_Code**: A machine-readable code generated per asset for physical identification and quick lookup

## Requirements

### Requirement 1: Asset Category Management

**User Story:** As a finance administrator, I want to manage asset categories with predefined COA mappings and useful life defaults, so that new assets inherit correct accounting configuration.

#### Acceptance Criteria

1. THE Asset_Module SHALL provide CRUD operations for Asset_Category records containing category_code, category_name, asset_coa_code, depreciation_expense_coa_code, accumulated_depreciation_coa_code, default_useful_life_months, and company_id.
2. WHEN an Asset_Category is created, THE Asset_Module SHALL validate that category_code is unique within the same company_id.
3. THE Asset_Module SHALL seed the following default categories per company: BLD (Building, 240 months), FRN (Furniture & Fixture, 60 months), KTE (Kitchen Equipment, 60 months), ITE (IT Equipment, 48 months), VCL (Vehicle, 60 months).
4. WHEN an Asset_Category is referenced by one or more Fixed_Asset records, THE Asset_Module SHALL prevent deletion of that Asset_Category.
5. THE Asset_Module SHALL restrict Asset_Category management to users with `fixed_assets:update` permission.

### Requirement 2: Product Asset Flag

**User Story:** As a purchasing user, I want to mark certain products as assets in the product master, so that the system routes them through the asset acquisition flow instead of the consumable stock flow.

#### Acceptance Criteria

1. THE Asset_Module SHALL add an `is_asset` boolean field (default false) to the products table.
2. WHEN a product has `is_asset` set to true, THE Asset_Module SHALL make that product available for selection in Asset_Request pages and exclude it from regular consumable Purchase Request pages.
3. WHEN a product has `is_asset` set to true AND a Goods Receipt is confirmed for that product, THE Asset_Module SHALL create a Fixed_Asset record with status DRAFT instead of inserting into stock_balance.

### Requirement 3: Asset Request

**User Story:** As a branch manager, I want a dedicated Asset Request page to request capital equipment purchases, so that asset acquisitions follow a separate approval workflow from daily consumable purchases.

#### Acceptance Criteria

1. THE Asset_Module SHALL provide a dedicated Asset Request page that only displays products where `is_asset` is true.
2. WHEN an Asset Request is submitted, THE Asset_Module SHALL follow the existing PR → PO → GR → PI flow for procurement processing.
3. THE Asset_Module SHALL apply the same approval workflow (submit → approve/reject) used by the existing Purchase Request module.
4. THE Asset_Module SHALL restrict Asset Request creation to users with `fixed_assets:insert` permission.
5. WHEN an Asset Request is converted to a Purchase Order, THE Asset_Module SHALL set the PO payment_type to CREDIT.

### Requirement 4: Asset Creation from Goods Receipt

**User Story:** As a finance user, I want assets to be automatically created as DRAFT records when goods are received, so that the asset register stays synchronized with procurement without manual data entry.

#### Acceptance Criteria

1. WHEN a Goods Receipt is confirmed for a product with `is_asset` set to true, THE Asset_Module SHALL create one Fixed_Asset record per unit received with status DRAFT.
2. THE Asset_Module SHALL populate the Fixed_Asset record with: company_id, branch_id (from GR), product_id, asset_category_id (from product or user selection), acquisition_date (GR received_date), cost (unit_price from associated PO line), and default useful_life_months from the Asset_Category.
3. THE Asset_Module SHALL generate a unique asset_code following the pattern: `{category_code}-{branch_code}-{sequence_number}` (e.g., ITE-JKT001-0001).
4. THE Asset_Module SHALL NOT insert asset products into the stock_balance table.
5. WHEN multiple units of the same asset product are received, THE Asset_Module SHALL create one separate Fixed_Asset record per unit.

### Requirement 5: Asset Capitalization

**User Story:** As a finance user, I want assets to be capitalized when the purchase invoice is posted, so that the asset cost is formally recognized in the general ledger.

#### Acceptance Criteria

1. WHEN a Purchase Invoice containing asset items is posted, THE Asset_Module SHALL change the associated Fixed_Asset records from DRAFT to ACTIVE status.
2. WHEN a Fixed_Asset is capitalized, THE Asset_Module SHALL post a journal entry: Debit the Asset_Category asset COA account, Credit Accounts Payable (210101).
3. THE Asset_Module SHALL update the Fixed_Asset cost field with the final invoiced unit_price from the Purchase Invoice line.
4. WHEN a Fixed_Asset is capitalized, THE Asset_Module SHALL set the capitalized_date to the Purchase Invoice posting date.
5. WHEN a Fixed_Asset is capitalized, THE Asset_Module SHALL record an Asset_Movement entry with type CAPITALIZE.
6. IF a Purchase Invoice is posted but the associated Fixed_Asset record does not exist, THEN THE Asset_Module SHALL reject the posting with an error message identifying the missing asset.

### Requirement 6: Depreciation Calculation

**User Story:** As a finance user, I want the system to calculate monthly depreciation using the straight-line method, so that asset values are systematically reduced over their useful life.

#### Acceptance Criteria

1. THE Asset_Module SHALL calculate monthly depreciation using the formula: (cost - salvage_value) / useful_life_months.
2. THE Asset_Module SHALL store `depreciation_method` in the Fixed_Asset record with value STRAIGHT_LINE, while the database field supports DECLINING_BALANCE for future expansion.
3. WHEN the accumulated_depreciation equals (cost - salvage_value), THE Asset_Module SHALL stop calculating further depreciation for that Fixed_Asset.
4. THE Asset_Module SHALL use NUMERIC(20,4) precision for all monetary depreciation calculations.
5. WHEN the remaining depreciable amount for the final month is less than the standard monthly amount, THE Asset_Module SHALL use the remaining amount as the final depreciation entry to prevent over-depreciation.

### Requirement 7: Depreciation Run (Batch Processing)

**User Story:** As a finance manager, I want to run monthly depreciation as a batch process per company per fiscal period, so that all active assets are depreciated consistently and the process is auditable.

#### Acceptance Criteria

1. WHEN a Depreciation_Run is initiated, THE Asset_Module SHALL process all Fixed_Asset records with status ACTIVE belonging to the specified company_id and fiscal_period_id.
2. THE Asset_Module SHALL provide a preview mode that displays calculated depreciation amounts per asset without posting any journal entries.
3. WHEN a Depreciation_Run is confirmed, THE Asset_Module SHALL post one consolidated journal entry per company: Debit Depreciation Expense (620101), Credit Accumulated Depreciation (per category COA), with individual line items per asset.
4. THE Asset_Module SHALL enforce idempotency: running depreciation for the same company and fiscal period a second time SHALL NOT create duplicate entries.
5. WHEN a Depreciation_Run has already been posted for a given company and period, THE Asset_Module SHALL allow reversal by creating a counter-journal that negates the original entry and resets accumulated_depreciation on affected assets.
6. THE Asset_Module SHALL record the Depreciation_Run with: run_date, fiscal_period_id, company_id, total_depreciation_amount, status (PREVIEW, POSTED, REVERSED), and the user who executed the run.
7. THE Asset_Module SHALL restrict Depreciation_Run execution to users with `fixed_assets:approve` permission.
8. IF no active assets exist for the specified company and period, THEN THE Asset_Module SHALL return an informational message without creating any records.

### Requirement 8: Asset Transfer (Intra-Company)

**User Story:** As an operations manager, I want to transfer assets between branches within the same company, so that physical asset relocations are tracked without generating unnecessary journal entries.

#### Acceptance Criteria

1. WHEN an Asset_Transfer is initiated, THE Asset_Module SHALL update the Fixed_Asset branch_id from the source branch to the destination branch.
2. THE Asset_Module SHALL NOT generate a journal entry for intra-company asset transfers.
3. WHEN an Asset_Transfer is completed, THE Asset_Module SHALL record an Asset_Movement entry with type TRANSFER, including source_branch_id and destination_branch_id.
4. THE Asset_Module SHALL restrict transfers to Fixed_Asset records with status ACTIVE.
5. THE Asset_Module SHALL validate that source and destination branches belong to the same company_id.
6. THE Asset_Module SHALL restrict Asset_Transfer operations to users with `fixed_assets:update` permission.

### Requirement 9: Asset Maintenance

**User Story:** As a branch manager, I want to record maintenance activities on assets with associated expense journals, so that repair costs are tracked and properly accounted for.

#### Acceptance Criteria

1. WHEN an Asset_Maintenance record is created, THE Asset_Module SHALL capture: fixed_asset_id, maintenance_date, description, vendor_name, cost, and reference_number.
2. WHEN an Asset_Maintenance record is posted, THE Asset_Module SHALL generate a journal entry: Debit Repair & Maintenance Expense (620201), Credit Accounts Payable (210101).
3. WHEN an Asset_Maintenance is recorded, THE Asset_Module SHALL change the Fixed_Asset status from ACTIVE to MAINTENANCE.
4. WHEN an Asset_Maintenance is completed, THE Asset_Module SHALL change the Fixed_Asset status back to ACTIVE.
5. WHEN an Asset_Maintenance record is created, THE Asset_Module SHALL record an Asset_Movement entry with type MAINTENANCE.
6. THE Asset_Module SHALL restrict Asset_Maintenance recording to users with `fixed_assets:update` permission.
7. WHILE a Fixed_Asset is in MAINTENANCE status, THE Asset_Module SHALL continue including the asset in Depreciation_Run calculations.

### Requirement 10: Asset Disposal

**User Story:** As a finance manager, I want to dispose of assets with automatic gain/loss recognition, so that retired assets are properly removed from the books with correct accounting treatment.

#### Acceptance Criteria

1. WHEN an Asset_Disposal is initiated, THE Asset_Module SHALL capture: fixed_asset_id, disposal_date, disposal_method (SOLD, SCRAPPED, DONATED), and proceeds_amount (0 for scrapped/donated).
2. WHEN an Asset_Disposal is posted, THE Asset_Module SHALL generate a journal entry that: Debits Accumulated Depreciation for the full accumulated amount, Debits Cash/Receivable for proceeds (if sold), Credits the Asset Cost COA for the original cost, and Debits Loss on Disposal (770201) or Credits Gain on Disposal (770101) for the difference.
3. THE Asset_Module SHALL calculate gain or loss as: proceeds_amount - (cost - accumulated_depreciation).
4. WHEN an Asset_Disposal is posted, THE Asset_Module SHALL change the Fixed_Asset status to DISPOSED.
5. WHEN an Asset_Disposal is recorded, THE Asset_Module SHALL record an Asset_Movement entry with type DISPOSAL.
6. THE Asset_Module SHALL restrict disposal to Fixed_Asset records with status ACTIVE or MAINTENANCE.
7. THE Asset_Module SHALL restrict Asset_Disposal operations to users with `fixed_assets:approve` permission.
8. WHILE a Fixed_Asset has status DISPOSED, THE Asset_Module SHALL exclude it from Depreciation_Run calculations.

### Requirement 11: QR Code Generation

**User Story:** As an operations team member, I want each asset to have a unique QR code, so that physical assets can be quickly identified and looked up using a mobile device.

#### Acceptance Criteria

1. WHEN a Fixed_Asset record is created, THE Asset_Module SHALL generate a unique QR code containing the asset_code.
2. THE Asset_Module SHALL store the QR code image as a URL reference in the Fixed_Asset record (qr_code_url field).
3. WHEN a QR code is scanned, THE Asset_Module SHALL resolve to the asset detail page showing current status, location, and depreciation information.
4. THE Asset_Module SHALL provide a bulk QR code print function that generates a downloadable PDF of QR labels for selected assets.
5. THE Asset_Module SHALL encode the QR code data as a URL in the format: `{base_url}/fixed-assets/{asset_id}`.

### Requirement 12: Asset Movement Audit Trail

**User Story:** As an auditor, I want a complete history of all changes to each asset, so that the full lifecycle is traceable for compliance and reporting purposes.

#### Acceptance Criteria

1. THE Asset_Module SHALL record an Asset_Movement entry for every state change including: CAPITALIZE, DEPRECIATION, TRANSFER, MAINTENANCE, MAINTENANCE_COMPLETE, DISPOSAL, and COST_ADJUSTMENT.
2. THE Asset_Module SHALL store in each Asset_Movement: fixed_asset_id, movement_type, movement_date, from_value, to_value, reference_id, reference_type, notes, and created_by.
3. THE Asset_Module SHALL provide a chronological movement history view per asset accessible from the asset detail page.
4. THE Asset_Module SHALL restrict Asset_Movement viewing to users with `fixed_assets:view` permission.
5. THE Asset_Module SHALL make Asset_Movement records immutable after creation (no update or delete operations).

### Requirement 13: Multi-Company Data Isolation

**User Story:** As a system administrator managing multiple companies, I want fixed asset data to be strictly isolated per company, so that each company's asset register is independent.

#### Acceptance Criteria

1. THE Asset_Module SHALL scope all Fixed_Asset queries by company_id from the authenticated user context.
2. THE Asset_Module SHALL scope all Asset_Category records by company_id.
3. THE Asset_Module SHALL scope all Depreciation_Run records by company_id.
4. THE Asset_Module SHALL prevent cross-company asset transfers by validating that source and destination branches share the same company_id.
5. THE Asset_Module SHALL generate asset_code sequences independently per company.

### Requirement 14: Permission and Access Control

**User Story:** As a system administrator, I want granular permissions for the fixed asset module, so that only authorized users can perform sensitive operations like depreciation runs and disposals.

#### Acceptance Criteria

1. THE Asset_Module SHALL register the `fixed_assets` module in the permission system with actions: view, insert, update, delete, and approve.
2. WHEN a user lacks `fixed_assets:view` permission, THE Asset_Module SHALL deny access to all fixed asset pages and API endpoints.
3. WHEN a user lacks `fixed_assets:approve` permission, THE Asset_Module SHALL deny access to Depreciation_Run execution and Asset_Disposal posting.
4. WHEN a user lacks `fixed_assets:insert` permission, THE Asset_Module SHALL deny access to Asset Request creation.
5. WHEN a user lacks `fixed_assets:update` permission, THE Asset_Module SHALL deny access to Asset_Transfer and Asset_Maintenance operations.
