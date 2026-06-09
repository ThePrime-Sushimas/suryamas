-- Dev-only: clear PR → PO → GR → GP → Purchase Invoice → AP Payments → Marketplace
--           + Production Requests + Pricelist Price Changes + ALL Stock Movements.
-- Keeps master: suppliers, products, branches, warehouses, owner_credit_cards, COA,
--               users, bank_accounts, pricelists (masters), etc.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/database/scripts/dev_clear_procurement_chain.sql

BEGIN;

-- ── 1. Collect journal IDs to remove later ───────────────────────────────────
CREATE TEMP TABLE _proc_journals ON COMMIT DROP AS
SELECT id FROM journal_headers
WHERE deleted_at IS NULL
  AND (source_module = 'marketplace_po'
    OR reference_type IN (
      'marketplace_checkout_session',
      'marketplace_bulk_settlement',
      'purchase_invoice',
      'goods_receipt',
      'goods_processing'
    ));

-- ── 2. Break FKs from marketplace / GR / PI to journals & GR ─────────────────
UPDATE marketplace_checkout_sessions
SET journal_ordered_id = NULL,
    journal_received_id = NULL,
    journal_settled_id = NULL,
    goods_receipt_id = NULL;

UPDATE goods_receipts SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE purchase_invoices SET journal_id = NULL WHERE journal_id IS NOT NULL;

-- ── 3. AP Payments (depends on purchase_invoices) ────────────────────────────
DELETE FROM ap_payment_invoice_lines;
DELETE FROM ap_payment_batches;
DELETE FROM ap_payments;

-- ── 4a. Pricelist price changes (FK to purchase_invoices) ───────────────────
DELETE FROM pricelist_price_changes;

-- ── 4b. Pricelists — nullify PI source references ───────────────────────────
UPDATE pricelists SET purchase_invoice_id = NULL
WHERE purchase_invoice_id IS NOT NULL;

-- ── 5. Purchase invoices (depends on GR lines) ──────────────────────────────
UPDATE goods_processing_outputs SET purchase_invoice_line_id = NULL
WHERE purchase_invoice_line_id IS NOT NULL;

DELETE FROM purchase_invoice_lines;
DELETE FROM purchase_invoice_charges;
DELETE FROM purchase_invoice_gr_links;
DELETE FROM purchase_invoice_attachments;
DELETE FROM purchase_invoices;

-- ── 6. Stock movements (ALL) — collect affected products first ──────────────
CREATE TEMP TABLE _all_stock_pairs ON COMMIT DROP AS
SELECT DISTINCT warehouse_id, product_id FROM stock_movements;

-- 6a. Nullify all FK references to stock_movements
UPDATE goods_processing_outputs SET stock_movement_id = NULL
WHERE stock_movement_id IS NOT NULL;

UPDATE stock_transfer_lines SET
  out_movement_id = NULL,
  in_movement_id = NULL,
  return_out_movement_id = NULL,
  return_in_movement_id = NULL
WHERE out_movement_id IS NOT NULL
   OR in_movement_id IS NOT NULL
   OR return_out_movement_id IS NOT NULL
   OR return_in_movement_id IS NOT NULL;

UPDATE stock_adjustments SET input_movement_id = NULL
WHERE input_movement_id IS NOT NULL;

UPDATE stock_adjustment_lines SET movement_id = NULL
WHERE movement_id IS NOT NULL;

UPDATE stock_adjustment_outputs SET movement_id = NULL
WHERE movement_id IS NOT NULL;

UPDATE production_order_materials SET
  stock_movement_out_id = NULL,
  stock_movement_in_id = NULL
WHERE stock_movement_out_id IS NOT NULL
   OR stock_movement_in_id IS NOT NULL;

UPDATE daily_prep_order_lines SET
  out_movement_id = NULL,
  in_movement_id = NULL
WHERE out_movement_id IS NOT NULL
   OR in_movement_id IS NOT NULL;

UPDATE daily_closing_count_lines SET
  out_movement_id = NULL,
  in_movement_id = NULL
WHERE out_movement_id IS NOT NULL
   OR in_movement_id IS NOT NULL;

-- 6b. Delete ALL stock_movements
DELETE FROM stock_movements;

-- 6c. Reset stock_balances for all affected products to zero
UPDATE stock_balances sb
SET qty = 0,
    avg_cost = 0,
    updated_at = now()
FROM _all_stock_pairs p
WHERE sb.warehouse_id = p.warehouse_id
  AND sb.product_id = p.product_id;

-- ── 7. Goods processing ─────────────────────────────────────────────────────
DELETE FROM goods_processing_outputs;
DELETE FROM goods_processing_inputs;
DELETE FROM goods_processing;

-- ── 8. Goods receipts ───────────────────────────────────────────────────────
DELETE FROM goods_receipt_lines;
DELETE FROM goods_receipt_attachments;
DELETE FROM goods_receipts;

-- ── 9. Marketplace (lines/attachments/shipments cascade from sessions) ──────
DELETE FROM marketplace_settlements;
DELETE FROM marketplace_checkout_attachments;
DELETE FROM marketplace_shipments;
DELETE FROM marketplace_checkout_lines;
DELETE FROM marketplace_checkout_sessions;

-- ── 10. Journals (procurement / marketplace only) ───────────────────────────
DELETE FROM journal_lines
WHERE journal_header_id IN (SELECT id FROM _proc_journals);

DELETE FROM journal_headers
WHERE id IN (SELECT id FROM _proc_journals);

-- ── 11. Purchase orders & requests ──────────────────────────────────────────
DELETE FROM purchase_order_lines;
DELETE FROM purchase_orders;

DELETE FROM purchase_request_lines;
DELETE FROM purchase_requests;

-- ── 12. Production requests (spinoff from procurement) ──────────────────────
DELETE FROM production_request_lines;
DELETE FROM production_requests;

COMMIT;

-- ── Summary ─────────────────────────────────────────────────────────────────
SELECT 'purchase_requests' AS tbl, COUNT(*)::int AS remaining FROM purchase_requests
UNION ALL SELECT 'purchase_orders', COUNT(*)::int FROM purchase_orders
UNION ALL SELECT 'goods_receipts', COUNT(*)::int FROM goods_receipts
UNION ALL SELECT 'goods_processing', COUNT(*)::int FROM goods_processing
UNION ALL SELECT 'purchase_invoices', COUNT(*)::int FROM purchase_invoices
UNION ALL SELECT 'ap_payments', COUNT(*)::int FROM ap_payments
UNION ALL SELECT 'marketplace_sessions', COUNT(*)::int FROM marketplace_checkout_sessions
UNION ALL SELECT 'stock_movements', COUNT(*)::int FROM stock_movements
UNION ALL SELECT 'proc_journals', COUNT(*)::int FROM journal_headers WHERE source_module = 'marketplace_po' AND deleted_at IS NULL
UNION ALL SELECT 'production_requests', COUNT(*)::int FROM production_requests
UNION ALL SELECT 'pricelist_price_changes', COUNT(*)::int FROM pricelist_price_changes
UNION ALL SELECT 'stock_balances_zero', COUNT(*)::int AS zero_count FROM stock_balances WHERE qty = 0;