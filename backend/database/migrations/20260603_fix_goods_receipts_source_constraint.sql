-- Fix goods_receipts.source CHECK: allow PO_PENDING (auto-draft GR when PO marked ORDERED).
-- Production may still have auto-named constraint "goodsreceiptssourcecheck" (SUPPLIER + MARKETPLACE only).

BEGIN;

ALTER TABLE goods_receipts DROP CONSTRAINT IF EXISTS goodsreceiptssourcecheck;
ALTER TABLE goods_receipts DROP CONSTRAINT IF EXISTS goods_receipts_source_check;
ALTER TABLE goods_receipts DROP CONSTRAINT IF EXISTS chk_goods_receipts_source;

ALTER TABLE goods_receipts
  ADD CONSTRAINT chk_goods_receipts_source
  CHECK (source IN ('SUPPLIER', 'MARKETPLACE', 'PO_PENDING'));

COMMIT;
