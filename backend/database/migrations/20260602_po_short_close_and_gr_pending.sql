-- PO line short-close (supplier tidak kirim sisa) + GR placeholder saat PO ORDERED
BEGIN;

ALTER TABLE purchase_order_lines
  ADD COLUMN IF NOT EXISTS qty_short_closed NUMERIC(20,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_close_reason TEXT;

ALTER TABLE purchase_order_lines
  DROP CONSTRAINT IF EXISTS chk_po_lines_qty_short_closed_nonneg;

ALTER TABLE purchase_order_lines
  ADD CONSTRAINT chk_po_lines_qty_short_closed_nonneg
  CHECK (qty_short_closed >= 0);

ALTER TABLE goods_receipts DROP CONSTRAINT IF EXISTS chk_goods_receipts_source;

ALTER TABLE goods_receipts
  ADD CONSTRAINT chk_goods_receipts_source
  CHECK (source IN ('SUPPLIER', 'MARKETPLACE', 'PO_PENDING'));

COMMIT;
