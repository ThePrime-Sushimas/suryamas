-- ============================================================================
-- DAILY STOCK OPNAME — Database Migration
-- Creates tables for daily closing count (stock opname) feature
-- ============================================================================

-- 1. Create branch_opname_config table
CREATE TABLE IF NOT EXISTS branch_opname_config (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id),
  branch_id              UUID NOT NULL REFERENCES branches(id),
  variance_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  closing_time           TIME NOT NULL DEFAULT '23:59',
  grace_period_minutes   INT NOT NULL DEFAULT 15,
  updated_by             UUID,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id)
);

-- 2. Create daily_closing_counts table
CREATE TABLE IF NOT EXISTS daily_closing_counts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
  opname_number       VARCHAR(50),
  closing_date        DATE NOT NULL,
  pic_user_id         UUID NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'CONFIRMED', 'FLAGGED')),
  total_variance_cost NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_expected_cost NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_actual_cost   NUMERIC(20,4) NOT NULL DEFAULT 0,
  line_count          INT NOT NULL DEFAULT 0,
  completed_count     INT NOT NULL DEFAULT 0,
  resolution_note     TEXT,
  resolved_by         UUID,
  resolved_at         TIMESTAMPTZ,
  confirmed_by        UUID,
  confirmed_at        TIMESTAMPTZ,
  notes               TEXT,
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID
);

-- Unique constraint: one session per branch per date (soft-delete aware)
CREATE UNIQUE INDEX IF NOT EXISTS idx_closing_counts_branch_date
  ON daily_closing_counts(branch_id, closing_date)
  WHERE deleted_at IS NULL;

-- Partial indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_closing_counts_company
  ON daily_closing_counts(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_closing_counts_status
  ON daily_closing_counts(status)
  WHERE deleted_at IS NULL;

-- 3. Create daily_closing_count_lines table
CREATE TABLE IF NOT EXISTS daily_closing_count_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id      UUID NOT NULL REFERENCES daily_closing_counts(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  product_code    VARCHAR(50) NOT NULL,
  product_name    VARCHAR(200) NOT NULL,
  uom             VARCHAR(30) NOT NULL,
  system_qty      NUMERIC(20,4) NOT NULL DEFAULT 0,
  expected_qty    NUMERIC(20,4) NOT NULL DEFAULT 0,
  actual_qty      NUMERIC(20,4),
  variance_qty    NUMERIC(20,4),
  variance_pct    NUMERIC(10,2),
  cost_per_unit   NUMERIC(20,4) NOT NULL DEFAULT 0,
  variance_cost   NUMERIC(20,4),
  main_balance    NUMERIC(20,4) NOT NULL DEFAULT 0,
  dpo_in_qty      NUMERIC(20,4) NOT NULL DEFAULT 0,
  theoretical_out NUMERIC(20,4) NOT NULL DEFAULT 0,
  is_high_risk    BOOLEAN NOT NULL DEFAULT false,
  requires_photo  BOOLEAN NOT NULL DEFAULT false,
  photo_url       TEXT,
  has_recipe      BOOLEAN NOT NULL DEFAULT true,
  has_warning     BOOLEAN NOT NULL DEFAULT false,
  warning_message TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  out_movement_id UUID,
  in_movement_id  UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for line queries
CREATE INDEX IF NOT EXISTS idx_closing_lines_closing
  ON daily_closing_count_lines(closing_id);

CREATE INDEX IF NOT EXISTS idx_closing_lines_product
  ON daily_closing_count_lines(product_id);

-- 4. Seed default opname config for existing active branches
INSERT INTO branch_opname_config (company_id, branch_id, variance_threshold_pct, closing_time, grace_period_minutes)
SELECT
  b.company_id,
  b.id,
  15.00,
  '23:59'::TIME,
  15
FROM branches b
WHERE b.status = 'active'
  AND b.branch_code NOT IN ('CENTRAL_STOCK', 'CENTRAL_KITCHEN')
ON CONFLICT (branch_id) DO NOTHING;
