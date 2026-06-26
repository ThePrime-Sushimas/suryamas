-- ============================================================================
-- ADD default_coa_id TO categories
-- Setiap kategori bisa punya COA default untuk petty cash expense.
-- Contoh: kategori "Transport" → default COA = 610401 (Biaya Transport)
-- ============================================================================
BEGIN;

ALTER TABLE categories
  ADD COLUMN default_coa_id UUID REFERENCES chart_of_accounts(id);

COMMENT ON COLUMN categories.default_coa_id IS
  'COA default untuk expense petty cash: kalau user tidak override, expense akan masuk ke akun ini di jurnal settlement';

COMMIT;
