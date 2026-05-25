-- Debug salmon UOM + cost allocation (run via psql on tunnel :5433)
-- Usage: psql "$DATABASE_URL" -f backend/database/scripts/debug_salmon_cost_uom.sql

\echo '=== 1) Produk bbc2d002 (Salmon Fresh input) — UOM setup ==='
SELECT
  p.id,
  p.product_code,
  p.product_name,
  mu.unit_name,
  pu.conversion_factor,
  pu.is_base_unit,
  pu.is_default_stock_unit,
  pu.is_deleted
FROM products p
LEFT JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_deleted = false
LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
WHERE p.id = 'bbc2d002-11d4-45d4-811f-bb7a866c4fb1'
ORDER BY pu.is_base_unit DESC NULLS LAST, mu.unit_name;

\echo ''
\echo '=== 2) Semua produk salmon — UOM ==='
SELECT
  p.product_code,
  p.product_name,
  mu.unit_name,
  pu.conversion_factor,
  pu.is_base_unit
FROM products p
JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_deleted = false
JOIN metric_units mu ON mu.id = pu.metric_unit_id
WHERE p.product_name ILIKE '%salmon%'
   OR p.product_code IN ('AB003', 'AB017', 'TTS001')
ORDER BY p.product_name, pu.is_base_unit DESC, mu.unit_name;

\echo ''
\echo '=== 3) Output template salmon ==='
SELECT
  p_in.product_code AS input_code,
  p_in.product_name AS input_product,
  p_out.product_code AS output_code,
  p_out.product_name AS output_product,
  pot.output_uom,
  pot.suggested_pct,
  pot.bears_cost
FROM product_output_templates pot
JOIN products p_in ON p_in.id = pot.product_id
JOIN products p_out ON p_out.id = pot.output_product_id
WHERE p_in.id = 'bbc2d002-11d4-45d4-811f-bb7a866c4fb1'
   OR p_in.product_name ILIKE '%salmon%fresh%'
   OR p_in.product_code = 'AB017'
ORDER BY pot.sort_order;

\echo ''
\echo '=== 4) GR line salmon — Depok (terbaru) ==='
SELECT
  gr.gr_number,
  gr.received_date,
  b.branch_name,
  p.product_code,
  p.product_name,
  grl.qty_po_uom,
  grl.uom_po,
  grl.qty_received,
  grl.uom_received,
  grl.conversion_factor,
  grl.qty_rejected,
  grl.unit_price_invoice,
  grl.total_price_invoice,
  grl.unit_price_po,
  gr.created_at AS gr_created_at
FROM goods_receipt_lines grl
JOIN products p ON p.id = grl.product_id
JOIN goods_receipts gr ON gr.id = grl.gr_id
JOIN branches b ON b.id = gr.branch_id
WHERE b.branch_name ILIKE '%depok%'
  AND (p.product_name ILIKE '%salmon%' OR p.id = 'bbc2d002-11d4-45d4-811f-bb7a866c4fb1')
ORDER BY gr.created_at DESC NULLS LAST
LIMIT 5;

\echo ''
\echo '=== 5) GR line salmon — semua cabang (terbaru) ==='
SELECT
  b.branch_name,
  gr.gr_number,
  p.product_code,
  grl.qty_po_uom,
  grl.uom_po,
  grl.qty_received,
  grl.uom_received,
  grl.conversion_factor,
  grl.total_price_invoice
FROM goods_receipt_lines grl
JOIN products p ON p.id = grl.product_id
JOIN goods_receipts gr ON gr.id = grl.gr_id
JOIN branches b ON b.id = gr.branch_id
WHERE p.id = 'bbc2d002-11d4-45d4-811f-bb7a866c4fb1'
ORDER BY gr.created_at DESC NULLS LAST
LIMIT 15;

\echo ''
\echo '=== 6) GP output + unit_cost — Depok ==='
SELECT
  b.branch_name,
  gp.processing_number,
  gp.status AS gp_status,
  p_in.product_name AS input_product,
  p_out.product_code AS output_code,
  p_out.product_name AS output_product,
  gpo.qty_output,
  gpo.uom,
  gpo.actual_qty,
  gpo.unit_cost,
  gpo.allocated_cost,
  gpo.is_waste
FROM goods_processing_outputs gpo
JOIN goods_processing_inputs gpi ON gpi.id = gpo.input_id
JOIN goods_processing gp ON gp.id = gpo.goods_processing_id
JOIN branches b ON b.id = gp.branch_id
JOIN products p_in ON p_in.id = gpi.product_id
JOIN products p_out ON p_out.id = gpo.product_id
WHERE b.branch_name ILIKE '%depok%'
  AND p_in.id = 'bbc2d002-11d4-45d4-811f-bb7a866c4fb1'
ORDER BY gp.created_at DESC, gpo.sort_order
LIMIT 20;

\echo ''
\echo '=== 7) Stock balance salmon products — Depok / Cibinong / Grand Wisata ==='
SELECT
  b.branch_name,
  w.warehouse_name,
  p.product_code,
  p.product_name,
  sb.qty,
  sb.avg_cost,
  (sb.qty * sb.avg_cost) AS total_value
FROM stock_balances sb
JOIN products p ON p.id = sb.product_id
JOIN warehouses w ON w.id = sb.warehouse_id
JOIN branches b ON b.id = w.branch_id
WHERE p.product_code IN ('AB003', 'TTS001')
  AND (
    b.branch_name ILIKE '%depok%'
    OR b.branch_name ILIKE '%cibinong%'
    OR b.branch_name ILIKE '%grand%wisata%'
  )
ORDER BY b.branch_name, p.product_code;

\echo ''
\echo '=== 8) GR line salmon input (filter badan/tetelan) ==='
SELECT
  b.branch_name,
  p.product_name,
  grl.qty_po_uom,
  grl.uom_po,
  grl.qty_received,
  grl.uom_received,
  grl.qty_rejected,
  grl.unit_price_invoice,
  grl.total_price_invoice,
  gr.created_at
FROM goods_receipt_lines grl
JOIN products p ON p.id = grl.product_id
JOIN goods_receipts gr ON gr.id = grl.gr_id
JOIN branches b ON b.id = gr.branch_id
WHERE p.product_name ILIKE '%salmon%'
  AND p.product_name NOT ILIKE '%badan%'
  AND p.product_name NOT ILIKE '%tetelan%'
ORDER BY gr.created_at DESC
LIMIT 10;

\echo ''
\echo '=== 9) GP inputs salmon ==='
SELECT
  b.branch_name,
  gp.processing_number,
  gp.status,
  p_in.product_name AS input_product,
  gpi.qty_input,
  gpi.uom AS input_uom,
  grl.qty_po_uom,
  grl.uom_po,
  grl.qty_received,
  grl.uom_received,
  grl.unit_price_invoice,
  grl.total_price_invoice
FROM goods_processing_inputs gpi
JOIN goods_processing gp ON gp.id = gpi.goods_processing_id
JOIN branches b ON b.id = gp.branch_id
JOIN products p_in ON p_in.id = gpi.product_id
JOIN goods_receipt_lines grl ON grl.id = gpi.gr_line_id
WHERE p_in.product_name ILIKE '%salmon%'
ORDER BY gp.created_at DESC
LIMIT 10;
