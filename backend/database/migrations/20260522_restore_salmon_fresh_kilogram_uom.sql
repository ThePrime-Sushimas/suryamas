-- Salmon Fresh (AB017): pricelist uses Kilogram UOM that was soft-deleted with wrong conversion_factor (=1).
-- PI Gram→KG conversion failed → qty_invoiced stayed as raw Gram (e.g. 30000 × Rp/KG).

UPDATE product_uoms
SET
  is_deleted = false,
  conversion_factor = 1000,
  is_base_unit = false,
  is_default_stock_unit = false,
  is_default_purchase_unit = false,
  updated_at = NOW()
WHERE id = '43d825dc-3931-43a6-a83e-5841ad049dd0'
  AND product_id = 'bbc2d002-11d4-45d4-811f-bb7a866c4fb1';
