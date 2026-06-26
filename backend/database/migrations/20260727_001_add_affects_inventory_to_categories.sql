-- ============================================================================
-- ADD affects_inventory TO categories
-- Petty cash expenses untuk kategori dengan affects_inventory = true
-- akan otomatis dicatat sebagai inventory-in (stock movement).
-- ============================================================================
BEGIN;

ALTER TABLE categories
  ADD COLUMN affects_inventory BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN categories.affects_inventory IS
  'true = expense petty cash untuk kategori ini otomatis masuk gudang sebagai inventory-in';

COMMIT;
