-- ============================================================================
-- Audit columns for goods processing child tables + related stock/GR lines
-- Aligns schema with purchase-invoice posting & future queries
-- ============================================================================

-- goods_processing_inputs: track line workflow changes
ALTER TABLE goods_processing_inputs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- goods_processing_outputs: track cost allocation on invoice post
ALTER TABLE goods_processing_outputs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- stock_movements: cost backfilled when purchase invoice is posted
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- goods_receipt_lines: qty_invoiced updated on invoice post
ALTER TABLE goods_receipt_lines
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Auto-update updated_at (uses existing set_updated_at() from rpc migrations)
DROP TRIGGER IF EXISTS trg_gp_inputs_updated_at ON goods_processing_inputs;
CREATE TRIGGER trg_gp_inputs_updated_at
  BEFORE UPDATE ON goods_processing_inputs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_gp_outputs_updated_at ON goods_processing_outputs;
CREATE TRIGGER trg_gp_outputs_updated_at
  BEFORE UPDATE ON goods_processing_outputs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_stock_movements_updated_at ON stock_movements;
CREATE TRIGGER trg_stock_movements_updated_at
  BEFORE UPDATE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_gr_lines_updated_at ON goods_receipt_lines;
CREATE TRIGGER trg_gr_lines_updated_at
  BEFORE UPDATE ON goods_receipt_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
