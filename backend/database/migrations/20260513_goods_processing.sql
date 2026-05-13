-- ============================================================================
-- GOODS PROCESSING — Phase 1: Tables + Columns
-- ============================================================================
-- Prerequisite: goods_receipts, goods_receipt_lines, products, stock_movements already exist

-- ─── 1. New column on products ───────────────────────────────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_processing BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN products.requires_processing IS 'true = perlu proses (potong/trim) sebelum masuk gudang (salmon, ayam)';

-- ─── 2. New column on goods_receipt_lines (partial invoice tracking) ─────────

ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS qty_invoiced NUMERIC(20,4) NOT NULL DEFAULT 0;
COMMENT ON COLUMN goods_receipt_lines.qty_invoiced IS 'Qty yang sudah di-cover oleh Purchase Invoice (incremental)';

-- ─── 3. goods_processing (header) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goods_processing (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
  goods_receipt_id    UUID NOT NULL REFERENCES goods_receipts(id),
  processing_number   VARCHAR(50) NOT NULL,
  processing_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  processing_type     VARCHAR(20) NOT NULL DEFAULT 'PASS_THROUGH'
                        CHECK (processing_type IN ('PASS_THROUGH', 'DISASSEMBLY')),
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'PROCESSING', 'QC_REVIEW', 'CONFIRMED', 'REJECTED')),
  notes               TEXT,
  rejection_reason    TEXT,

  -- People
  processed_by        UUID,
  processed_at        TIMESTAMPTZ,
  qc_confirmed_by     UUID,
  qc_confirmed_at     TIMESTAMPTZ,
  rejected_by         UUID,
  rejected_at         TIMESTAMPTZ,

  -- Yield summary (calculated saat QC confirm)
  total_input_qty     NUMERIC(20,4),
  total_output_qty    NUMERIC(20,4),
  total_waste_qty     NUMERIC(20,4),
  yield_percentage    NUMERIC(5,2),

  -- Soft delete & audit
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,

  UNIQUE(company_id, processing_number)
);

CREATE INDEX IF NOT EXISTS idx_goods_processing_company ON goods_processing(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_goods_processing_gr ON goods_processing(goods_receipt_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_goods_processing_status ON goods_processing(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_goods_processing_branch_date ON goods_processing(branch_id, processing_date) WHERE deleted_at IS NULL;

-- ─── 4. goods_processing_inputs ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goods_processing_inputs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_processing_id   UUID NOT NULL REFERENCES goods_processing(id) ON DELETE CASCADE,
  gr_line_id            UUID NOT NULL REFERENCES goods_receipt_lines(id),
  product_id            UUID NOT NULL REFERENCES products(id),
  qty_input             NUMERIC(20,4) NOT NULL,
  uom                   VARCHAR(30) NOT NULL,
  sort_order            INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_gp_inputs_processing ON goods_processing_inputs(goods_processing_id);
CREATE INDEX IF NOT EXISTS idx_gp_inputs_gr_line ON goods_processing_inputs(gr_line_id);

-- ─── 5. goods_processing_outputs ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goods_processing_outputs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_processing_id   UUID NOT NULL REFERENCES goods_processing(id) ON DELETE CASCADE,
  input_id              UUID NOT NULL REFERENCES goods_processing_inputs(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES products(id),
  qty_output            NUMERIC(20,4) NOT NULL,
  uom                   VARCHAR(30) NOT NULL,
  is_waste              BOOLEAN NOT NULL DEFAULT false,
  waste_reason          TEXT,
  photo_urls            TEXT[],

  -- Cost fields (diisi saat Purchase Invoice posted)
  unit_cost             NUMERIC(20,4),
  allocated_cost        NUMERIC(20,4),

  -- Stock movement link (diisi saat QC confirmed)
  stock_movement_id     UUID REFERENCES stock_movements(id),

  -- Warehouse (diisi saat QC confirmed, untuk cost allocation)
  warehouse_id          UUID REFERENCES warehouses(id),

  -- Link balik ke purchase invoice line (diisi saat invoice posted)
  purchase_invoice_line_id UUID,  -- FK ditambah nanti saat tabel purchase_invoice_lines dibuat

  sort_order            INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_gp_outputs_processing ON goods_processing_outputs(goods_processing_id);
CREATE INDEX IF NOT EXISTS idx_gp_outputs_input ON goods_processing_outputs(input_id);
CREATE INDEX IF NOT EXISTS idx_gp_outputs_product ON goods_processing_outputs(product_id);

-- ─── 6. Mark existing products that need processing ─────────────────────────
-- Salmon & Ayam variants — update sesuai data aktual nanti via UI
-- Untuk sekarang set manual beberapa yang diketahui:

UPDATE products SET requires_processing = true
WHERE LOWER(product_name) LIKE '%salmon%'
   OR LOWER(product_name) LIKE '%ayam%'
   OR LOWER(product_name) LIKE '%chicken%';

-- ============================================================================
-- DONE
-- ============================================================================
