-- One-time: flag existing marketplace suppliers (replaces name-heuristic in app code).
-- Platforms not matched here must be flagged manually in Supplier form after deploy.
UPDATE suppliers
SET
  requires_invoice = false,
  invoice_bypass_reason = 'marketplace'
WHERE deleted_at IS NULL
  AND invoice_bypass_reason IS NULL
  AND (
    LOWER(supplier_name) LIKE '%shopee%'
    OR LOWER(supplier_name) LIKE '%tokped%'
    OR LOWER(supplier_name) LIKE '%tokopedia%'
    OR LOWER(supplier_name) LIKE '%lazada%'
    OR LOWER(supplier_name) LIKE '%tiktok%'
    OR LOWER(supplier_name) LIKE '%tik tok%'
    OR LOWER(supplier_name) LIKE '%bukalapak%'
    OR LOWER(supplier_name) LIKE '%blibli%'
  );
