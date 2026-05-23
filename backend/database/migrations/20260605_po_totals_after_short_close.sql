-- Recalc PO line/header amounts: committed qty = qty - qty_short_closed
BEGIN;

UPDATE purchase_order_lines pol
SET total_price = GREATEST(0, (pol.qty - pol.qty_short_closed) * pol.unit_price);

UPDATE purchase_orders po
SET total_amount = COALESCE(line_sums.sum_amount, 0),
    updated_at = now()
FROM (
  SELECT po_id, SUM(total_price)::numeric AS sum_amount
  FROM purchase_order_lines
  GROUP BY po_id
) line_sums
WHERE po.id = line_sums.po_id;

COMMIT;
