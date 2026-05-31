-- Stock Adjustments: waste recording and product breakdown
-- WASTE: multi-product (multiple lines per document)
-- BREAKDOWN: 1 input product → multiple output products

CREATE TABLE stock_adjustments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
  adjustment_number   VARCHAR(30) NOT NULL,
  adjustment_type     VARCHAR(20) NOT NULL DEFAULT 'WASTE'
                        CHECK (adjustment_type IN ('WASTE', 'BREAKDOWN')),
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),

  adjustment_date     DATE NOT NULL,
  reason              VARCHAR(30) CHECK (reason IN ('EXPIRED','DAMAGED','CONTAMINATED','OVERSTOCK','PROCESSING_LOSS','OTHER')),
  notes               TEXT,

  -- BREAKDOWN only: single input product
  input_product_id    UUID REFERENCES products(id),
  input_qty           NUMERIC(20,4) CHECK (input_qty > 0),
  input_cost_per_unit NUMERIC(20,4) NOT NULL DEFAULT 0,
  input_movement_id   UUID,
  waste_qty           NUMERIC(20,4) NOT NULL DEFAULT 0 CHECK (waste_qty >= 0),

  -- Journal reference
  journal_id          UUID,

  -- Confirm
  confirmed_at        TIMESTAMPTZ,
  confirmed_by        UUID,

  -- Cancel
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        UUID,

  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,

  UNIQUE(company_id, adjustment_number)
);

CREATE INDEX idx_stock_adjustments_company ON stock_adjustments(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_adjustments_branch ON stock_adjustments(branch_id, adjustment_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_adjustments_type ON stock_adjustments(adjustment_type) WHERE deleted_at IS NULL;

-- WASTE lines: multiple products being disposed in one document
CREATE TABLE stock_adjustment_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  qty                 NUMERIC(20,4) NOT NULL CHECK (qty > 0),
  cost_per_unit       NUMERIC(20,4) NOT NULL DEFAULT 0,
  movement_id         UUID,
  notes               TEXT,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_adjustment_lines_adj ON stock_adjustment_lines(stock_adjustment_id);

-- BREAKDOWN outputs: products resulting from breakdown of input
CREATE TABLE stock_adjustment_outputs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  qty                 NUMERIC(20,4) NOT NULL CHECK (qty > 0),
  cost_per_unit       NUMERIC(20,4) NOT NULL DEFAULT 0,
  movement_id         UUID,
  notes               TEXT,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_adjustment_outputs_adj ON stock_adjustment_outputs(stock_adjustment_id);
