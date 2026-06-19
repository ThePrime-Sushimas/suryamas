# Design Document: Fixed Asset Module

## Overview

The Fixed Asset Module manages the full lifecycle of capital assets across a multi-company, multi-branch ERP system. It covers asset categories, master records, capitalization from purchase invoices, straight-line depreciation runs, intra-branch transfers, maintenance tracking, disposal with gain/loss recognition, and QR code generation for physical identification.

## Architecture

The Fixed Asset Module is a standalone backend module (`backend/src/modules/fixed-assets/`) with a corresponding frontend feature (`frontend/src/features/fixed-assets/`). It integrates with existing procurement (GR, PI), accounting (journals), and permission systems without touching the warehouse/stock subsystem.

**Key Design Decisions:**
- Assets bypass `stock_balance` and `stock_movements` entirely
- One Fixed_Asset record per physical unit (qty=3 on GR → 3 records)
- Depreciation runs are batch-per-period with idempotency guard
- Intra-company transfers have no journal impact
- QR codes generated server-side as data URLs (no external service dependency)

## Components and Interfaces

See the Backend Module Structure and API Endpoint Design sections below for component breakdown, and the Integration Points section for interface details with existing modules.

## Data Models

See Database Schema section below for complete table definitions.

---

## Database Schema

### Table: `asset_categories`

```sql
CREATE TABLE asset_categories (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                      UUID NOT NULL REFERENCES companies(id),
  category_code                   VARCHAR(10) NOT NULL,
  category_name                   VARCHAR(100) NOT NULL,
  asset_coa_id                    UUID NOT NULL REFERENCES chart_of_accounts(id),
  depreciation_expense_coa_id     UUID NOT NULL REFERENCES chart_of_accounts(id),
  accumulated_depreciation_coa_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  default_useful_life_months      INT NOT NULL DEFAULT 60,
  is_active                       BOOLEAN NOT NULL DEFAULT true,
  is_deleted                      BOOLEAN NOT NULL DEFAULT false,
  deleted_at                      TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                      UUID REFERENCES auth_users(id),
  updated_by                      UUID REFERENCES auth_users(id),
  UNIQUE(company_id, category_code)
);

CREATE INDEX idx_asset_categories_company ON asset_categories(company_id) WHERE deleted_at IS NULL;
```

### Table: `fixed_assets`

```sql
CREATE TABLE fixed_assets (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL REFERENCES companies(id),
  branch_id                 UUID NOT NULL REFERENCES branches(id),
  asset_code                VARCHAR(50) NOT NULL,
  asset_name                VARCHAR(200) NOT NULL,
  asset_category_id         UUID NOT NULL REFERENCES asset_categories(id),
  product_id                UUID REFERENCES products(id),
  status                    VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                              CHECK (status IN ('DRAFT', 'ACTIVE', 'MAINTENANCE', 'DISPOSED')),
  -- Acquisition
  acquisition_date          DATE NOT NULL,
  capitalized_date          DATE,
  cost                      NUMERIC(20,4) NOT NULL DEFAULT 0,
  salvage_value             NUMERIC(20,4) NOT NULL DEFAULT 0,
  useful_life_months        INT NOT NULL,
  -- Depreciation
  depreciation_method       VARCHAR(20) NOT NULL DEFAULT 'STRAIGHT_LINE'
                              CHECK (depreciation_method IN ('STRAIGHT_LINE', 'DECLINING_BALANCE')),
  accumulated_depreciation  NUMERIC(20,4) NOT NULL DEFAULT 0,
  book_value                NUMERIC(20,4) GENERATED ALWAYS AS (cost - accumulated_depreciation) STORED,
  -- References
  gr_line_id                UUID REFERENCES goods_receipt_lines(id),
  purchase_invoice_id       UUID REFERENCES purchase_invoices(id),
  journal_id                UUID REFERENCES journal_headers(id),
  -- QR Code
  qr_code_url              TEXT,
  -- Photo (migrated or uploaded)
  photo_url                TEXT,
  -- Metadata
  description               TEXT,
  serial_number             VARCHAR(100),
  location_note             VARCHAR(200),
  -- Soft delete & audit
  is_deleted                BOOLEAN NOT NULL DEFAULT false,
  deleted_at                TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                UUID REFERENCES auth_users(id),
  updated_by                UUID REFERENCES auth_users(id),
  UNIQUE(company_id, asset_code)
);

CREATE INDEX idx_fixed_assets_company ON fixed_assets(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fixed_assets_branch ON fixed_assets(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fixed_assets_category ON fixed_assets(asset_category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fixed_assets_status ON fixed_assets(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_fixed_assets_product ON fixed_assets(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fixed_assets_gr_line ON fixed_assets(gr_line_id) WHERE deleted_at IS NULL;
```


### Table: `asset_transfers`

```sql
CREATE TABLE asset_transfers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  fixed_asset_id        UUID NOT NULL REFERENCES fixed_assets(id),
  transfer_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  source_branch_id      UUID NOT NULL REFERENCES branches(id),
  destination_branch_id UUID NOT NULL REFERENCES branches(id),
  reason                TEXT,
  transferred_by        UUID REFERENCES auth_users(id),
  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID REFERENCES auth_users(id)
);

CREATE INDEX idx_asset_transfers_company ON asset_transfers(company_id);
CREATE INDEX idx_asset_transfers_asset ON asset_transfers(fixed_asset_id);
```

### Table: `asset_maintenance`

```sql
CREATE TABLE asset_maintenance (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  fixed_asset_id        UUID NOT NULL REFERENCES fixed_assets(id),
  maintenance_date      DATE NOT NULL,
  completion_date       DATE,
  description           TEXT NOT NULL,
  vendor_name           VARCHAR(200),
  cost                  NUMERIC(20,4) NOT NULL DEFAULT 0,
  reference_number      VARCHAR(100),
  status                VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
                          CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'POSTED')),
  journal_id            UUID REFERENCES journal_headers(id),
  -- Audit
  is_deleted            BOOLEAN NOT NULL DEFAULT false,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID REFERENCES auth_users(id),
  updated_by            UUID REFERENCES auth_users(id)
);

CREATE INDEX idx_asset_maintenance_company ON asset_maintenance(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_asset_maintenance_asset ON asset_maintenance(fixed_asset_id) WHERE deleted_at IS NULL;
```

### Table: `asset_disposals`

```sql
CREATE TABLE asset_disposals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  fixed_asset_id        UUID NOT NULL REFERENCES fixed_assets(id),
  disposal_date         DATE NOT NULL,
  disposal_method       VARCHAR(20) NOT NULL
                          CHECK (disposal_method IN ('SOLD', 'SCRAPPED', 'DONATED')),
  proceeds_amount       NUMERIC(20,4) NOT NULL DEFAULT 0,
  book_value_at_disposal NUMERIC(20,4) NOT NULL DEFAULT 0,
  gain_loss_amount      NUMERIC(20,4) NOT NULL DEFAULT 0,
  status                VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN ('DRAFT', 'POSTED')),
  journal_id            UUID REFERENCES journal_headers(id),
  notes                 TEXT,
  -- Audit
  posted_by             UUID REFERENCES auth_users(id),
  posted_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID REFERENCES auth_users(id),
  updated_by            UUID REFERENCES auth_users(id)
);

CREATE INDEX idx_asset_disposals_company ON asset_disposals(company_id);
CREATE INDEX idx_asset_disposals_asset ON asset_disposals(fixed_asset_id);
```

### Table: `asset_depreciation_runs`

```sql
CREATE TABLE asset_depreciation_runs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL REFERENCES companies(id),
  fiscal_period_id          UUID NOT NULL REFERENCES fiscal_periods(id),
  run_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  status                    VARCHAR(20) NOT NULL DEFAULT 'PREVIEW'
                              CHECK (status IN ('PREVIEW', 'POSTED', 'REVERSED')),
  total_depreciation_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  asset_count               INT NOT NULL DEFAULT 0,
  journal_id                UUID REFERENCES journal_headers(id),
  reversal_journal_id       UUID REFERENCES journal_headers(id),
  reversed_at               TIMESTAMPTZ,
  reversed_by               UUID REFERENCES auth_users(id),
  -- Audit
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                UUID REFERENCES auth_users(id),
  UNIQUE(company_id, fiscal_period_id, status)
);

CREATE INDEX idx_asset_depr_runs_company ON asset_depreciation_runs(company_id);
CREATE INDEX idx_asset_depr_runs_period ON asset_depreciation_runs(fiscal_period_id);
```

### Table: `asset_depreciation_entries`

```sql
CREATE TABLE asset_depreciation_entries (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  depreciation_run_id       UUID NOT NULL REFERENCES asset_depreciation_runs(id) ON DELETE CASCADE,
  fixed_asset_id            UUID NOT NULL REFERENCES fixed_assets(id),
  depreciation_amount       NUMERIC(20,4) NOT NULL,
  accumulated_before        NUMERIC(20,4) NOT NULL,
  accumulated_after         NUMERIC(20,4) NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_depr_entries_run ON asset_depreciation_entries(depreciation_run_id);
CREATE INDEX idx_asset_depr_entries_asset ON asset_depreciation_entries(fixed_asset_id);
```


### Table: `asset_movements`

```sql
CREATE TABLE asset_movements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  fixed_asset_id        UUID NOT NULL REFERENCES fixed_assets(id),
  movement_type         VARCHAR(30) NOT NULL
                          CHECK (movement_type IN (
                            'CAPITALIZE', 'DEPRECIATION', 'TRANSFER',
                            'MAINTENANCE', 'MAINTENANCE_COMPLETE',
                            'DISPOSAL', 'COST_ADJUSTMENT'
                          )),
  movement_date         DATE NOT NULL,
  from_value            TEXT,
  to_value              TEXT,
  reference_id          UUID,
  reference_type        VARCHAR(50),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID REFERENCES auth_users(id)
);

CREATE INDEX idx_asset_movements_company ON asset_movements(company_id);
CREATE INDEX idx_asset_movements_asset ON asset_movements(fixed_asset_id);
CREATE INDEX idx_asset_movements_type ON asset_movements(movement_type);
```

### Migration: Add `is_asset` to `products`

```sql
ALTER TABLE products ADD COLUMN is_asset BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_products_is_asset ON products(is_asset) WHERE is_asset = true;
```

---

## API Endpoint Design

### Asset Categories

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/v1/asset-categories` | List categories (paginated) | `fixed_assets:view` |
| POST | `/api/v1/asset-categories` | Create category | `fixed_assets:update` |
| GET | `/api/v1/asset-categories/:id` | Get category detail | `fixed_assets:view` |
| PUT | `/api/v1/asset-categories/:id` | Update category | `fixed_assets:update` |
| DELETE | `/api/v1/asset-categories/:id` | Soft delete category | `fixed_assets:delete` |

### Fixed Assets

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/v1/fixed-assets` | List assets (paginated, filterable) | `fixed_assets:view` |
| GET | `/api/v1/fixed-assets/:id` | Asset detail with movements | `fixed_assets:view` |
| PUT | `/api/v1/fixed-assets/:id` | Update asset metadata | `fixed_assets:update` |
| GET | `/api/v1/fixed-assets/:id/movements` | Get movement history | `fixed_assets:view` |
| POST | `/api/v1/fixed-assets/:id/qr-code` | Regenerate QR code | `fixed_assets:update` |
| POST | `/api/v1/fixed-assets/bulk-qr` | Generate bulk QR PDF | `fixed_assets:view` |

### Asset Transfers

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/v1/asset-transfers` | List transfers | `fixed_assets:view` |
| POST | `/api/v1/asset-transfers` | Create transfer | `fixed_assets:update` |

### Asset Maintenance

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/v1/asset-maintenance` | List maintenance records | `fixed_assets:view` |
| POST | `/api/v1/asset-maintenance` | Record maintenance (asset → MAINTENANCE) | `fixed_assets:update` |
| POST | `/api/v1/asset-maintenance/:id/complete` | Complete maintenance (asset → ACTIVE) | `fixed_assets:update` |
| POST | `/api/v1/asset-maintenance/:id/post` | Post journal entry | `fixed_assets:approve` |

### Asset Disposals

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/v1/asset-disposals` | List disposals | `fixed_assets:view` |
| POST | `/api/v1/asset-disposals` | Create disposal draft | `fixed_assets:approve` |
| POST | `/api/v1/asset-disposals/:id/post` | Post disposal + journal | `fixed_assets:approve` |

### Depreciation Runs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/v1/depreciation-runs` | List runs | `fixed_assets:view` |
| POST | `/api/v1/depreciation-runs/preview` | Preview depreciation | `fixed_assets:approve` |
| POST | `/api/v1/depreciation-runs/confirm` | Confirm & post journal | `fixed_assets:approve` |
| POST | `/api/v1/depreciation-runs/:id/reverse` | Reverse posted run | `fixed_assets:approve` |


---

## Backend Module Structure

```
backend/src/modules/fixed-assets/
├── fixed-assets.types.ts            # All TypeScript interfaces & DTOs
├── fixed-assets.errors.ts           # Custom error classes
├── fixed-assets.schema.ts           # Zod validation schemas
├── fixed-assets.repository.ts       # Database queries (all tables)
├── fixed-assets.service.ts          # Core business logic
├── fixed-assets.controller.ts       # HTTP request handlers
├── fixed-assets.routes.ts           # Express router
├── depreciation.service.ts          # Depreciation calculation & run logic
├── asset-lifecycle.service.ts       # Capitalization, transfer, disposal logic
├── qr-code.util.ts                  # QR code generation utility
└── asset-code-generator.util.ts     # Asset code sequence generator
```

### Key Types (`fixed-assets.types.ts`)

```typescript
export type AssetStatus = 'DRAFT' | 'ACTIVE' | 'MAINTENANCE' | 'DISPOSED'
export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE'
export type DisposalMethod = 'SOLD' | 'SCRAPPED' | 'DONATED'
export type MovementType =
  | 'CAPITALIZE' | 'DEPRECIATION' | 'TRANSFER'
  | 'MAINTENANCE' | 'MAINTENANCE_COMPLETE'
  | 'DISPOSAL' | 'COST_ADJUSTMENT'
export type MaintenanceStatus = 'IN_PROGRESS' | 'COMPLETED' | 'POSTED'
export type DepreciationRunStatus = 'PREVIEW' | 'POSTED' | 'REVERSED'

export interface FixedAsset {
  id: string
  company_id: string
  branch_id: string
  asset_code: string
  asset_name: string
  asset_category_id: string
  product_id: string | null
  status: AssetStatus
  acquisition_date: string
  capitalized_date: string | null
  cost: number
  salvage_value: number
  useful_life_months: number
  depreciation_method: DepreciationMethod
  accumulated_depreciation: number
  book_value: number
  gr_line_id: string | null
  purchase_invoice_id: string | null
  journal_id: string | null
  qr_code_url: string | null
  description: string | null
  serial_number: string | null
  location_note: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface AssetCategory {
  id: string
  company_id: string
  category_code: string
  category_name: string
  asset_coa_id: string
  depreciation_expense_coa_id: string
  accumulated_depreciation_coa_id: string
  default_useful_life_months: number
  is_active: boolean
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface CreateAssetFromGrDto {
  company_id: string
  branch_id: string
  product_id: string
  asset_category_id: string
  acquisition_date: string
  cost: number
  useful_life_months: number
  gr_line_id: string
  asset_name: string
  created_by: string
}

export interface CreateTransferDto {
  fixed_asset_id: string
  destination_branch_id: string
  transfer_date?: string
  reason?: string
}

export interface CreateMaintenanceDto {
  fixed_asset_id: string
  maintenance_date: string
  description: string
  vendor_name?: string
  cost: number
  reference_number?: string
}

export interface CreateDisposalDto {
  fixed_asset_id: string
  disposal_date: string
  disposal_method: DisposalMethod
  proceeds_amount: number
  notes?: string
}

export interface DepreciationPreviewEntry {
  fixed_asset_id: string
  asset_code: string
  asset_name: string
  cost: number
  salvage_value: number
  useful_life_months: number
  accumulated_before: number
  depreciation_amount: number
  accumulated_after: number
  book_value_after: number
}

export interface DepreciationRunResult {
  run_id: string
  status: DepreciationRunStatus
  fiscal_period_id: string
  total_depreciation_amount: number
  asset_count: number
  entries: DepreciationPreviewEntry[]
  journal_id?: string
}
```


### Depreciation Calculation Algorithm (`depreciation.service.ts`)

```typescript
/**
 * Calculate monthly depreciation for a single asset.
 * Uses straight-line method: (cost - salvage_value) / useful_life_months
 * Handles final-month remainder to prevent over-depreciation.
 */
function calculateMonthlyDepreciation(asset: FixedAsset): number {
  const totalDepreciable = asset.cost - asset.salvage_value
  const remaining = totalDepreciable - asset.accumulated_depreciation

  // Already fully depreciated
  if (remaining <= 0) return 0

  const standardMonthly = totalDepreciable / asset.useful_life_months

  // Final month: use remaining amount (prevents over-depreciation)
  if (remaining < standardMonthly) return remaining

  return Math.round(standardMonthly * 10000) / 10000 // 4 decimal precision
}

/**
 * Execute depreciation run for a company + fiscal period.
 * Steps:
 * 1. Validate fiscal period is open
 * 2. Check idempotency (no existing POSTED run for same company+period)
 * 3. Fetch all ACTIVE + MAINTENANCE assets for company
 * 4. Calculate depreciation per asset
 * 5. If preview: return entries without persisting
 * 6. If confirm: persist entries, update accumulated_depreciation, post journal
 */
async function executeDepreciationRun(
  companyId: string,
  fiscalPeriodId: string,
  mode: 'PREVIEW' | 'CONFIRM',
  userId: string
): Promise<DepreciationRunResult> {
  // 1. Validate period
  const period = await fiscalPeriodRepo.findOpenById(fiscalPeriodId, companyId)
  if (!period) throw new PeriodNotOpenError()

  // 2. Idempotency check
  if (mode === 'CONFIRM') {
    const existing = await repository.findPostedRun(companyId, fiscalPeriodId)
    if (existing) throw new DepreciationAlreadyPostedError(period.period_name)
  }

  // 3. Fetch eligible assets (ACTIVE or MAINTENANCE, not fully depreciated)
  const assets = await repository.findDepreciableAssets(companyId)
  if (assets.length === 0) {
    return { run_id: '', status: 'PREVIEW', fiscal_period_id: fiscalPeriodId,
             total_depreciation_amount: 0, asset_count: 0, entries: [] }
  }

  // 4. Calculate entries
  const entries: DepreciationPreviewEntry[] = assets.map(asset => {
    const amount = calculateMonthlyDepreciation(asset)
    return {
      fixed_asset_id: asset.id,
      asset_code: asset.asset_code,
      asset_name: asset.asset_name,
      cost: asset.cost,
      salvage_value: asset.salvage_value,
      useful_life_months: asset.useful_life_months,
      accumulated_before: asset.accumulated_depreciation,
      depreciation_amount: amount,
      accumulated_after: asset.accumulated_depreciation + amount,
      book_value_after: asset.cost - (asset.accumulated_depreciation + amount),
    }
  }).filter(e => e.depreciation_amount > 0)

  const totalAmount = entries.reduce((sum, e) => sum + e.depreciation_amount, 0)

  if (mode === 'PREVIEW') {
    return { run_id: '', status: 'PREVIEW', fiscal_period_id: fiscalPeriodId,
             total_depreciation_amount: totalAmount, asset_count: entries.length, entries }
  }

  // 5. Confirm: persist in transaction
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Create run record
    const run = await repository.createRun(client, {
      company_id: companyId, fiscal_period_id: fiscalPeriodId,
      status: 'POSTED', total_depreciation_amount: totalAmount,
      asset_count: entries.length, created_by: userId,
    })

    // Insert entries
    await repository.bulkInsertEntries(client, run.id, entries)

    // Update accumulated_depreciation on each asset
    for (const entry of entries) {
      await repository.incrementAccumulatedDepreciation(
        client, entry.fixed_asset_id, entry.depreciation_amount
      )
      // Record movement
      await repository.createMovement(client, {
        company_id: companyId, fixed_asset_id: entry.fixed_asset_id,
        movement_type: 'DEPRECIATION', movement_date: period.period_end,
        from_value: String(entry.accumulated_before),
        to_value: String(entry.accumulated_after),
        reference_id: run.id, reference_type: 'depreciation_run',
        created_by: userId,
      })
    }

    // Post consolidated journal
    const journalId = await postDepreciationJournal(
      client, companyId, period, entries, userId
    )
    await repository.updateRunJournal(client, run.id, journalId)

    await client.query('COMMIT')
    return { run_id: run.id, status: 'POSTED', fiscal_period_id: fiscalPeriodId,
             total_depreciation_amount: totalAmount, asset_count: entries.length,
             entries, journal_id: journalId }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
```


### Depreciation Journal Structure

```typescript
/**
 * Journal for depreciation run:
 *   Dr 620101 Depreciation Expense          = total_depreciation
 *   Cr {category.accumulated_depr_coa}      = per-category subtotal
 *
 * Lines are grouped by category COA for the credit side.
 */
async function postDepreciationJournal(
  client: PoolClient,
  companyId: string,
  period: FiscalPeriod,
  entries: DepreciationPreviewEntry[],
  userId: string
): Promise<string> {
  const totalDepr = entries.reduce((s, e) => s + e.depreciation_amount, 0)

  // Group by category for credit lines
  const categoryTotals = new Map<string, number>() // coa_id → total
  for (const entry of entries) {
    const asset = await repository.findById(client, entry.fixed_asset_id)
    const category = await repository.findCategoryById(client, asset.asset_category_id)
    const current = categoryTotals.get(category.accumulated_depreciation_coa_id) || 0
    categoryTotals.set(category.accumulated_depreciation_coa_id, current + entry.depreciation_amount)
  }

  const lines: CreateJournalLineDto[] = [
    // Debit: Depreciation Expense (620101)
    { line_number: 1, account_id: DEPRECIATION_EXPENSE_COA_ID, description: 'Beban Penyusutan Aset Tetap', debit_amount: totalDepr, credit_amount: 0 },
  ]

  let lineNum = 2
  for (const [coaId, amount] of categoryTotals) {
    lines.push({ line_number: lineNum++, account_id: coaId, description: 'Akumulasi Penyusutan', debit_amount: 0, credit_amount: amount })
  }

  return await journalService.createAutoJournal(client, {
    company_id: companyId,
    journal_date: period.period_end,
    journal_type: 'ASSET',
    source_module: 'fixed_assets',
    reference_type: 'depreciation_run',
    description: `Penyusutan Aset Tetap - ${period.period_name}`,
    lines,
    created_by: userId,
  })
}
```

### Capitalization Logic (`asset-lifecycle.service.ts`)

```typescript
/**
 * Called when Purchase Invoice containing asset items is posted.
 * For each asset line in the PI:
 * 1. Find linked Fixed_Asset records (via gr_line_id)
 * 2. Update cost with final invoiced price
 * 3. Change status DRAFT → ACTIVE
 * 4. Set capitalized_date
 * 5. Post capitalization journal
 * 6. Record CAPITALIZE movement
 */
async function capitalizeAssetsFromInvoice(
  client: PoolClient,
  invoiceId: string,
  invoiceDate: string,
  userId: string
): Promise<void> {
  const assetLines = await repository.findAssetLinesByInvoice(client, invoiceId)

  for (const line of assetLines) {
    const assets = await repository.findByGrLineId(client, line.gr_line_id)
    if (assets.length === 0) {
      throw new AssetNotFoundForInvoiceError(line.product_name, line.gr_line_id)
    }

    // Distribute cost equally across units from same GR line
    const unitCost = line.unit_price // already per-unit from PI line

    for (const asset of assets) {
      if (asset.status !== 'DRAFT') continue

      // Update asset
      await repository.capitalize(client, asset.id, {
        cost: unitCost,
        capitalized_date: invoiceDate,
        purchase_invoice_id: invoiceId,
        status: 'ACTIVE',
        updated_by: userId,
      })

      // Post journal: Dr Asset COA, Cr AP
      const category = await repository.findCategoryById(client, asset.asset_category_id)
      const journalId = await journalService.createAutoJournal(client, {
        company_id: asset.company_id,
        branch_id: asset.branch_id,
        journal_date: invoiceDate,
        journal_type: 'ASSET',
        source_module: 'fixed_assets',
        reference_type: 'fixed_asset',
        reference_id: asset.id,
        reference_number: asset.asset_code,
        description: `Kapitalisasi Aset ${asset.asset_code} - ${asset.asset_name}`,
        lines: [
          { line_number: 1, account_id: category.asset_coa_id, description: asset.asset_name, debit_amount: unitCost, credit_amount: 0 },
          { line_number: 2, account_id: ACCOUNTS_PAYABLE_COA_ID, description: 'Hutang Dagang', debit_amount: 0, credit_amount: unitCost },
        ],
        created_by: userId,
      })

      await repository.updateJournalId(client, asset.id, journalId)

      // Record movement
      await repository.createMovement(client, {
        company_id: asset.company_id,
        fixed_asset_id: asset.id,
        movement_type: 'CAPITALIZE',
        movement_date: invoiceDate,
        from_value: 'DRAFT',
        to_value: 'ACTIVE',
        reference_id: invoiceId,
        reference_type: 'purchase_invoice',
        notes: `Cost: ${unitCost}`,
        created_by: userId,
      })
    }
  }
}
```


### Disposal Journal Logic

```typescript
/**
 * Disposal journal entry:
 *   Dr  Accumulated Depreciation     = accumulated_depreciation
 *   Dr  Cash/Receivable              = proceeds_amount (if sold)
 *   Dr  Loss on Disposal (770201)    = loss amount (if loss)
 *   Cr  Asset Cost COA               = original cost
 *   Cr  Gain on Disposal (770101)    = gain amount (if gain)
 *
 * gain_loss = proceeds - (cost - accumulated_depreciation)
 * gain_loss > 0: Gain (Cr 770101)
 * gain_loss < 0: Loss (Dr 770201)
 */
async function postDisposal(
  client: PoolClient,
  disposal: AssetDisposal,
  asset: FixedAsset,
  userId: string
): Promise<string> {
  const bookValue = asset.cost - asset.accumulated_depreciation
  const gainLoss = disposal.proceeds_amount - bookValue

  const category = await repository.findCategoryById(client, asset.asset_category_id)
  const lines: CreateJournalLineDto[] = []
  let lineNum = 1

  // Dr Accumulated Depreciation
  lines.push({
    line_number: lineNum++,
    account_id: category.accumulated_depreciation_coa_id,
    description: `Akumulasi Penyusutan - ${asset.asset_code}`,
    debit_amount: asset.accumulated_depreciation,
    credit_amount: 0,
  })

  // Dr Cash (if proceeds > 0)
  if (disposal.proceeds_amount > 0) {
    lines.push({
      line_number: lineNum++,
      account_id: CASH_RECEIVABLE_COA_ID,
      description: `Hasil Penjualan Aset - ${asset.asset_code}`,
      debit_amount: disposal.proceeds_amount,
      credit_amount: 0,
    })
  }

  // Dr Loss on Disposal (if loss)
  if (gainLoss < 0) {
    lines.push({
      line_number: lineNum++,
      account_id: LOSS_ON_DISPOSAL_COA_ID, // 770201
      description: `Rugi Pelepasan Aset - ${asset.asset_code}`,
      debit_amount: Math.abs(gainLoss),
      credit_amount: 0,
    })
  }

  // Cr Asset Cost
  lines.push({
    line_number: lineNum++,
    account_id: category.asset_coa_id,
    description: `Pelepasan Aset - ${asset.asset_code}`,
    debit_amount: 0,
    credit_amount: asset.cost,
  })

  // Cr Gain on Disposal (if gain)
  if (gainLoss > 0) {
    lines.push({
      line_number: lineNum++,
      account_id: GAIN_ON_DISPOSAL_COA_ID, // 770101
      description: `Laba Pelepasan Aset - ${asset.asset_code}`,
      debit_amount: 0,
      credit_amount: gainLoss,
    })
  }

  return await journalService.createAutoJournal(client, {
    company_id: asset.company_id,
    branch_id: asset.branch_id,
    journal_date: disposal.disposal_date,
    journal_type: 'ASSET',
    source_module: 'fixed_assets',
    reference_type: 'asset_disposal',
    reference_id: disposal.id,
    description: `Pelepasan Aset ${asset.asset_code} - ${asset.asset_name}`,
    lines,
    created_by: userId,
  })
}
```

### Asset Code Generator (`asset-code-generator.util.ts`)

```typescript
/**
 * Generates asset code: {category_code}-{branch_code}-{sequence}
 * Example: ITE-JKT001-0001
 * Sequence is per-company, per-category, auto-incrementing.
 */
async function generateAssetCode(
  client: PoolClient,
  companyId: string,
  categoryCode: string,
  branchCode: string
): Promise<string> {
  // Get next sequence for this company + category
  const { rows } = await client.query(
    `SELECT COUNT(*)::int + 1 AS next_seq
     FROM fixed_assets
     WHERE company_id = $1
       AND asset_code LIKE $2
       AND deleted_at IS NULL`,
    [companyId, `${categoryCode}-%`]
  )
  const seq = String(rows[0].next_seq).padStart(4, '0')
  return `${categoryCode}-${branchCode}-${seq}`
}
```

### QR Code Generation (`qr-code.util.ts`)

```typescript
import QRCode from 'qrcode'

const BASE_URL = process.env.FRONTEND_URL || 'https://app.suryamas.id'

/**
 * Generate QR code as data URL (base64 PNG).
 * Encodes URL: {base_url}/fixed-assets/{asset_id}
 * No external service dependency.
 */
async function generateQrCode(assetId: string): Promise<string> {
  const url = `${BASE_URL}/fixed-assets/${assetId}`
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    width: 200,
    margin: 2,
  })
  return dataUrl
}

/**
 * Generate bulk QR labels as PDF buffer.
 * Uses PDFKit to create A4 sheets with QR grids.
 */
async function generateBulkQrPdf(
  assets: Array<{ id: string; asset_code: string; asset_name: string }>
): Promise<Buffer> {
  // Implementation uses pdfkit + qrcode libraries
  // 4 columns × 7 rows per A4 page
  // Each cell: QR image + asset_code text below
}
```

---

## Integration Points

### 1. Goods Receipt → Asset Creation

**Hook point:** Inside `goods-receipts.service.ts` at GR confirmation.

```typescript
// In goods-receipts.service.ts → confirmGoodsReceipt()
for (const line of grLines) {
  const product = await productRepo.findById(line.product_id)
  if (product.is_asset) {
    // Create Fixed_Asset DRAFT records (one per unit)
    const qty = Math.floor(line.qty_received) // assets are whole units
    for (let i = 0; i < qty; i++) {
      await fixedAssetService.createFromGr(client, {
        company_id: gr.company_id,
        branch_id: gr.branch_id,
        product_id: line.product_id,
        asset_category_id: product.asset_category_id, // from product master
        acquisition_date: gr.received_date,
        cost: line.unit_price_po, // preliminary cost from PO
        useful_life_months: category.default_useful_life_months,
        gr_line_id: line.id,
        asset_name: product.product_name,
        created_by: userId,
      })
    }
    // SKIP stock_balance insert for asset products
    continue
  }
  // ... existing stock logic for consumables
}
```

### 2. Purchase Invoice → Capitalization

**Hook point:** Inside `purchase-invoices.service.ts` at PI posting.

```typescript
// In purchase-invoices.service.ts → postInvoice()
// After cost allocation for consumables...

// Check if any lines are for asset products
const hasAssetLines = invoiceLines.some(l => l.is_asset)
if (hasAssetLines) {
  await assetLifecycleService.capitalizeAssetsFromInvoice(
    client, invoice.id, invoice.invoice_date, userId
  )
}
```

### 3. Product Master

**Change:** Add `is_asset` boolean and optional `asset_category_id` FK to `products` table.

```sql
ALTER TABLE products
  ADD COLUMN is_asset BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN asset_category_id UUID REFERENCES asset_categories(id);
```

### 4. Purchase Request Filter

**Change:** Asset Request reuses the existing PR module but filters products where `is_asset = true`. The frontend Asset Request page sends `is_asset=true` query param; the backend filters accordingly.

### 5. Journal System

All journal entries use `journal_type: 'ASSET'` and `source_module: 'fixed_assets'` to enable filtering and reporting. The existing `createAutoJournal` utility handles status = POSTED directly.

---

## Frontend Feature Structure

```
frontend/src/features/fixed-assets/
├── api/
│   └── fixed-assets.api.ts           # Axios API functions
├── components/
│   ├── AssetCategoryForm.tsx          # Category CRUD form
│   ├── AssetDetailCard.tsx            # Asset info card
│   ├── AssetMovementTimeline.tsx      # Movement audit timeline
│   ├── AssetStatusBadge.tsx           # Status color badges
│   ├── DepreciationPreviewTable.tsx   # Preview table for depr run
│   ├── DisposalForm.tsx               # Disposal form with gain/loss calc
│   ├── MaintenanceForm.tsx            # Maintenance record form
│   ├── TransferForm.tsx               # Transfer form
│   └── QrCodeDisplay.tsx              # QR code image display
├── pages/
│   ├── FixedAssetsPage.tsx            # Asset list (paginated)
│   ├── FixedAssetDetailPage.tsx       # Asset detail + movements
│   ├── AssetCategoriesPage.tsx        # Category list
│   ├── AssetRequestPage.tsx           # Asset PR creation
│   ├── DepreciationRunPage.tsx        # Preview + confirm depreciation
│   ├── AssetTransfersPage.tsx         # Transfer list
│   ├── AssetMaintenancePage.tsx       # Maintenance list
│   └── AssetDisposalsPage.tsx         # Disposal list
├── utils/
│   └── fixedAssetFilters.url.ts       # URL filter config
└── types/
    └── fixed-asset.types.ts           # Frontend type definitions
```

### Frontend Routing

| Path | Page | Permission |
|------|------|------------|
| `/fixed-assets` | FixedAssetsPage | `fixed_assets:view` |
| `/fixed-assets/:id` | FixedAssetDetailPage | `fixed_assets:view` |
| `/fixed-assets/categories` | AssetCategoriesPage | `fixed_assets:view` |
| `/fixed-assets/request` | AssetRequestPage | `fixed_assets:insert` |
| `/fixed-assets/depreciation` | DepreciationRunPage | `fixed_assets:approve` |
| `/fixed-assets/transfers` | AssetTransfersPage | `fixed_assets:view` |
| `/fixed-assets/maintenance` | AssetMaintenancePage | `fixed_assets:view` |
| `/fixed-assets/disposals` | AssetDisposalsPage | `fixed_assets:view` |


---

## Error Handling

```typescript
// fixed-assets.errors.ts
import { NotFoundError, ConflictError, BusinessRuleError } from '../../utils/errors.base'

export class AssetCategoryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Asset category not found: ${id}`)
  }
}

export class AssetCategoryInUseError extends BusinessRuleError {
  constructor(code: string) {
    super(`Asset category "${code}" cannot be deleted: referenced by active assets`)
  }
}

export class AssetCategoryDuplicateError extends ConflictError {
  constructor(code: string) {
    super(`Asset category code "${code}" already exists in this company`)
  }
}

export class FixedAssetNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Fixed asset not found: ${id}`)
  }
}

export class AssetNotActiveError extends BusinessRuleError {
  constructor(assetCode: string, operation: string) {
    super(`Asset "${assetCode}" must be ACTIVE to perform ${operation}. Current status prevents this operation.`)
  }
}

export class AssetNotFoundForInvoiceError extends BusinessRuleError {
  constructor(productName: string, grLineId: string) {
    super(`No Fixed Asset record found for product "${productName}" (GR line: ${grLineId}). Cannot post invoice.`)
  }
}

export class DepreciationAlreadyPostedError extends BusinessRuleError {
  constructor(periodName: string) {
    super(`Depreciation already posted for period "${periodName}". Use reversal if correction needed.`)
  }
}

export class CrossCompanyTransferError extends BusinessRuleError {
  constructor() {
    super('Source and destination branches must belong to the same company')
  }
}

export class PeriodNotOpenError extends BusinessRuleError {
  constructor() {
    super('Fiscal period is not open. Cannot post journal entries.')
  }
}

export class DisposalInvalidStatusError extends BusinessRuleError {
  constructor(assetCode: string, status: string) {
    super(`Asset "${assetCode}" cannot be disposed with status "${status}". Must be ACTIVE or MAINTENANCE.`)
  }
}
```

---

## COA Mapping Constants

```typescript
// Configurable per company, but defaults:
const DEPRECIATION_EXPENSE_COA_CODE = '620101'    // Beban Penyusutan
const REPAIR_MAINTENANCE_COA_CODE = '620201'      // Beban Perbaikan & Pemeliharaan
const GAIN_ON_DISPOSAL_COA_CODE = '710101' // Laba/Rugi Penjualan Aset / Revaluasi
const LOSS_ON_DISPOSAL_COA_CODE = '710101' // sama — satu akun untuk laba & rugi
const ACCOUNTS_PAYABLE_COA_CODE = '210101'        // Hutang Dagang

// Asset cost COA per category (from asset_categories table):
// BLD: 160101 - Bangunan
// FRN: 160201 - Peralatan & Perlengkapan
// KTE: 160301 - Peralatan Dapur
// ITE: 160401 - Peralatan IT
// VCL: 160501 - Kendaraan
```

---

## Data Flow Diagrams

### Asset Acquisition Flow

```
Product (is_asset=true) → Asset Request (PR) → PO (payment_type=CREDIT)
    → GR Confirmed → Fixed_Asset (DRAFT, cost from PO price)
    → Purchase Invoice Posted → Fixed_Asset (ACTIVE, cost from PI price)
                                → Journal: Dr Asset Cost / Cr AP
```

### Depreciation Monthly Flow

```
Finance opens Depreciation Run page
    → Selects fiscal period
    → Clicks "Preview"
    → System shows: each ACTIVE/MAINTENANCE asset + calculated amount
    → Finance clicks "Confirm"
    → System:
       1. Creates depreciation_run record (POSTED)
       2. Creates depreciation_entries per asset
       3. Updates fixed_assets.accumulated_depreciation
       4. Posts journal: Dr 620101 / Cr Accumulated Depr (per category)
       5. Creates asset_movements (DEPRECIATION) per asset
```

### Disposal Flow

```
Finance initiates disposal
    → Selects asset (ACTIVE or MAINTENANCE)
    → Enters: method (SOLD/SCRAPPED/DONATED), proceeds, date
    → System calculates: gain/loss = proceeds - book_value
    → Finance posts disposal
    → System:
       1. Posts journal (Dr Accum Depr + Dr Cash/Loss, Cr Asset Cost + Cr Gain)
       2. Updates asset status → DISPOSED
       3. Creates asset_movement (DISPOSAL)
```

---

## Permission Registration

```typescript
// In fixed-assets.routes.ts
PermissionService.registerModule('fixed_assets', 'Aset Tetap')

// Permission mapping:
// fixed_assets:view    → view asset list, detail, movements, categories
// fixed_assets:insert  → create asset requests
// fixed_assets:update  → manage categories, transfer, maintenance
// fixed_assets:delete  → soft delete categories
// fixed_assets:approve → depreciation run, disposal, maintenance posting
```

---

## Sidebar Menu

```
Aset Tetap
├── Daftar Aset            → /fixed-assets
├── Kategori Aset          → /fixed-assets/categories
├── Request Aset           → /fixed-assets/request
├── Penyusutan             → /fixed-assets/depreciation
├── Transfer Aset          → /fixed-assets/transfers
├── Pemeliharaan           → /fixed-assets/maintenance
└── Pelepasan              → /fixed-assets/disposals
```

---

## Testing Strategy

**Unit Tests (example-based):**
- Permission checks: verify access denied for each protected operation
- Seed verification: confirm default categories exist after seeding
- QR code URL format validation
- Movement chronological ordering
- Edge cases: PI posting with missing asset record, disposal of DRAFT asset

**Property-Based Tests:**
- Depreciation calculation correctness (formula validation across random inputs)
- Depreciation ceiling (no over-depreciation)
- Gain/loss calculation for disposals
- Asset code uniqueness and format
- Multi-company isolation
- Idempotency of depreciation runs

**Integration Tests:**
- GR confirmation → asset creation flow
- PI posting → capitalization + journal flow
- Full depreciation run cycle (preview → confirm → reversal)
- Transfer → branch update without journal
- Maintenance lifecycle (create → complete → post)
- Disposal → journal correctness

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Asset Category Uniqueness per Company

*For any* company_id and category_code pair, creating a second asset category with the same category_code within the same company SHALL be rejected, while the same code in a different company SHALL succeed.

**Validates: Requirements 1.2, 13.2**

### Property 2: Asset Category Delete Guard

*For any* asset category that is referenced by at least one non-deleted Fixed_Asset record, deletion of that category SHALL be rejected with a BusinessRuleError.

**Validates: Requirements 1.4**

### Property 3: Asset Product Routing

*For any* product with `is_asset = true`, confirming a Goods Receipt line for that product SHALL create Fixed_Asset DRAFT records and SHALL NOT insert any row into stock_balance for that product.

**Validates: Requirements 2.2, 2.3, 4.4**

### Property 4: One Asset Record per Unit

*For any* Goods Receipt line with an asset product and qty_received = N (where N is a positive integer), GR confirmation SHALL produce exactly N Fixed_Asset records, each with status DRAFT.

**Validates: Requirements 4.1, 4.5**

### Property 5: Asset Code Format and Uniqueness

*For any* generated asset_code, it SHALL match the pattern `{category_code}-{branch_code}-{sequence_number}` and SHALL be unique within the company.

**Validates: Requirements 4.3, 13.5**

### Property 6: Capitalization State Transition

*For any* Purchase Invoice containing asset items that is posted, all associated Fixed_Asset records with status DRAFT SHALL transition to ACTIVE with: cost updated to PI line unit_price, capitalized_date set to PI posting date, and a corresponding journal entry (Dr Asset COA, Cr 210101).

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 7: Capitalization Movement Audit

*For any* asset that transitions from DRAFT to ACTIVE via capitalization, an Asset_Movement record with type CAPITALIZE SHALL be created containing the reference to the Purchase Invoice.

**Validates: Requirements 5.5, 12.1**

### Property 8: Depreciation Calculation Formula

*For any* Fixed_Asset with cost C, salvage_value S, useful_life_months L, and accumulated_depreciation A where A < (C - S), the monthly depreciation amount SHALL equal min((C - S) / L, C - S - A) rounded to 4 decimal places.

**Validates: Requirements 6.1, 6.5**

### Property 9: Depreciation Ceiling

*For any* Fixed_Asset where accumulated_depreciation equals (cost - salvage_value), the depreciation calculation SHALL return 0.

**Validates: Requirements 6.3**

### Property 10: Depreciation Run Completeness

*For any* depreciation run on a company with N assets having status ACTIVE or MAINTENANCE (and not fully depreciated), the run SHALL produce exactly N depreciation entries, one per eligible asset.

**Validates: Requirements 7.1, 9.7, 10.8**

### Property 11: Depreciation Run Idempotency

*For any* company and fiscal_period where a POSTED depreciation run already exists, attempting to confirm another run for the same company and period SHALL be rejected without creating duplicate records.

**Validates: Requirements 7.4**

### Property 12: Depreciation Preview Immutability

*For any* depreciation run executed in PREVIEW mode, no journal SHALL be created, no asset accumulated_depreciation SHALL change, and no Asset_Movement records SHALL be created.

**Validates: Requirements 7.2**

### Property 13: Depreciation Reversal Correctness

*For any* reversed depreciation run with total T and N entries, a counter-journal SHALL be created with total T in opposite direction, and each affected asset's accumulated_depreciation SHALL decrease by its original entry amount.

**Validates: Requirements 7.5**

### Property 14: Transfer Branch Update Without Journal

*For any* valid asset transfer from branch A to branch B (same company), the asset's branch_id SHALL change from A to B, no journal entry SHALL be created, and an Asset_Movement with type TRANSFER SHALL be recorded.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 15: Transfer Status Guard

*For any* Fixed_Asset with status other than ACTIVE, initiating a transfer SHALL be rejected with a BusinessRuleError.

**Validates: Requirements 8.4**

### Property 16: Transfer Company Isolation

*For any* transfer where source_branch and destination_branch belong to different companies, the transfer SHALL be rejected.

**Validates: Requirements 8.5, 13.4**

### Property 17: Maintenance Status Lifecycle

*For any* maintenance record created on an ACTIVE asset, the asset status SHALL change to MAINTENANCE; and when that maintenance is completed, the status SHALL return to ACTIVE.

**Validates: Requirements 9.3, 9.4**

### Property 18: Maintenance Journal Correctness

*For any* posted maintenance with cost X, a journal entry SHALL exist with Debit to 620201 (Repair & Maintenance) = X and Credit to 210101 (Accounts Payable) = X.

**Validates: Requirements 9.2**

### Property 19: Disposal Gain/Loss Calculation

*For any* asset disposal with proceeds P, asset cost C, and accumulated_depreciation A, the gain_loss_amount SHALL equal P - (C - A).

**Validates: Requirements 10.3**

### Property 20: Disposal Journal Balance

*For any* posted disposal, the journal entry total debits SHALL equal total credits, specifically: (accumulated_depreciation + proceeds + loss) on debit side SHALL equal (cost + gain) on credit side.

**Validates: Requirements 10.2**

### Property 21: Disposal Status Transition

*For any* posted disposal, the asset status SHALL change to DISPOSED, and the asset SHALL be excluded from all subsequent depreciation runs.

**Validates: Requirements 10.4, 10.8**

### Property 22: Disposal Status Guard

*For any* asset with status DRAFT or DISPOSED, initiating a disposal SHALL be rejected.

**Validates: Requirements 10.6**

### Property 23: QR Code Generation

*For any* created Fixed_Asset, the qr_code_url field SHALL be non-null and the encoded data SHALL match the format `{base_url}/fixed-assets/{asset_id}`.

**Validates: Requirements 11.1, 11.5**

### Property 24: Movement Immutability

*For any* existing Asset_Movement record, update and delete operations SHALL be rejected. Asset_Movement records are append-only.

**Validates: Requirements 12.5**

### Property 25: Multi-Company Data Isolation

*For any* query executed by a user in company A, the results SHALL contain zero records belonging to company B. This applies to fixed_assets, asset_categories, depreciation_runs, and all related tables.

**Validates: Requirements 13.1, 13.2, 13.3**
