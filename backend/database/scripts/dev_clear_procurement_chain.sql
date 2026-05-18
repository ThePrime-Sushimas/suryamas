-- Dev-only: clear PR → PO → GR → GP → Purchase Invoice → Marketplace transactional data.
-- Keeps master: suppliers, products, branches, warehouses, owner_credit_cards, COA, users, etc.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/database/scripts/dev_clear_procurement_chain.sql

BEGIN;

-- ── 1. Collect journal IDs to remove later ───────────────────────────────────
CREATE TEMP TABLE _proc_journals ON COMMIT DROP AS
SELECT id FROM journal_headers
WHERE deleted_at IS NULL
  AND (
    source_module = 'marketplace_po'
    OR reference_type IN (
      'marketplace_checkout_session',
      'marketplace_bulk_settlement',
      'purchase_invoice',
      'goods_receipt',
      'goods_processing'
    )
  );

-- ── 2. Break FKs from marketplace / GR / PI to journals & GR ───────────────
UPDATE marketplace_checkout_sessions
SET journal_ordered_id = NULL,
    journal_received_id = NULL,
    journal_settled_id = NULL,
    goods_receipt_id = NULL;

UPDATE goods_receipts SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE purchase_invoices SET journal_id = NULL WHERE journal_id IS NOT NULL;

-- ── 3. Purchase invoices (depends on GR lines) ───────────────────────────────
UPDATE goods_processing_outputs SET purchase_invoice_line_id = NULL
WHERE purchase_invoice_line_id IS NOT NULL;

DELETE FROM purchase_invoice_lines;
DELETE FROM purchase_invoice_gr_links;
DELETE FROM purchase_invoice_attachments;
DELETE FROM purchase_invoices;

-- ── 4. Stock from goods processing ───────────────────────────────────────────
CREATE TEMP TABLE _gp_stock_pairs ON COMMIT DROP AS
SELECT DISTINCT warehouse_id, product_id
FROM stock_movements
WHERE reference_type = 'goods_processing';

UPDATE goods_processing_outputs SET stock_movement_id = NULL
WHERE stock_movement_id IS NOT NULL;

DELETE FROM stock_movements WHERE reference_type = 'goods_processing';

WITH recalc AS (
  SELECT
    a.warehouse_id,
    a.product_id,
    COALESCE((
      SELECT sm.balance_after
      FROM stock_movements sm
      WHERE sm.warehouse_id = a.warehouse_id
        AND sm.product_id = a.product_id
      ORDER BY sm.movement_date DESC, sm.created_at DESC, sm.id DESC
      LIMIT 1
    ), 0)::numeric AS new_qty
  FROM _gp_stock_pairs a
)
UPDATE stock_balances sb
SET qty = r.new_qty,
    avg_cost = CASE WHEN r.new_qty = 0 THEN 0 ELSE sb.avg_cost END,
    updated_at = now()
FROM recalc r
WHERE sb.warehouse_id = r.warehouse_id
  AND sb.product_id = r.product_id;

-- ── 5. Goods processing ──────────────────────────────────────────────────────
DELETE FROM goods_processing_outputs;
DELETE FROM goods_processing_inputs;
DELETE FROM goods_processing;

-- ── 6. Goods receipts ────────────────────────────────────────────────────────
DELETE FROM goods_receipt_lines;
DELETE FROM goods_receipt_attachments;
DELETE FROM goods_receipts;

-- ── 7. Marketplace (lines/attachments/shipments cascade from sessions) ───────
DELETE FROM marketplace_settlements;
DELETE FROM marketplace_checkout_attachments;
DELETE FROM marketplace_shipments;
DELETE FROM marketplace_checkout_lines;
DELETE FROM marketplace_checkout_sessions;

-- ── 8. Journals (procurement / marketplace only) ─────────────────────────────
DELETE FROM journal_lines
WHERE journal_header_id IN (SELECT id FROM _proc_journals);

DELETE FROM journal_headers
WHERE id IN (SELECT id FROM _proc_journals);

-- ── 9. Purchase orders & requests ────────────────────────────────────────────
DELETE FROM purchase_order_lines;
DELETE FROM purchase_orders;
DELETE FROM purchase_request_lines;
DELETE FROM purchase_requests;

COMMIT;

-- Summary
SELECT 'purchase_requests' AS tbl, COUNT(*)::int AS remaining FROM purchase_requests
UNION ALL SELECT 'purchase_orders', COUNT(*)::int FROM purchase_orders
UNION ALL SELECT 'goods_receipts', COUNT(*)::int FROM goods_receipts
UNION ALL SELECT 'goods_processing', COUNT(*)::int FROM goods_processing
UNION ALL SELECT 'purchase_invoices', COUNT(*)::int FROM purchase_invoices
UNION ALL SELECT 'marketplace_checkout_sessions', COUNT(*)::int FROM marketplace_checkout_sessions
UNION ALL SELECT 'proc_journals (marketplace_po)', COUNT(*)::int FROM journal_headers WHERE source_module = 'marketplace_po' AND deleted_at IS NULL;
