-- Fixed Assets Module: asset categories, fixed assets, transfers, maintenance, disposals, depreciation runs/entries, movements
-- Supports full asset lifecycle: acquisition → capitalization → depreciation → disposal

BEGIN;

-- ============================================================
-- Table: asset_categories
-- ============================================================
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

-- ============================================================
-- Table: fixed_assets
-- ============================================================
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

-- ============================================================
-- Table: asset_transfers
-- ============================================================
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

-- ============================================================
-- Table: asset_maintenance
-- ============================================================
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

-- ============================================================
-- Table: asset_disposals
-- ============================================================
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

-- ============================================================
-- Table: asset_depreciation_runs
-- ============================================================
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

-- ============================================================
-- Table: asset_depreciation_entries
-- ============================================================
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

-- ============================================================
-- Table: asset_movements
-- ============================================================
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

-- ============================================================
-- Alter products table: add is_asset flag and asset_category_id
-- ============================================================
ALTER TABLE products ADD COLUMN is_asset BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN asset_category_id UUID REFERENCES asset_categories(id);

CREATE INDEX idx_products_is_asset ON products(is_asset) WHERE is_asset = true;

COMMIT;
