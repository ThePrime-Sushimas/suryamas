-- ============================================================
-- MIGRATION: General Invoice Payment — CC_OWNER method
-- Tanggal: 2026-05-30
-- Deskripsi: Tambah metode pembayaran CC_OWNER untuk tagihan
--            yang dibayar via marketplace (Tokopedia/Shopee)
--            menggunakan kartu kredit owner.
-- ============================================================

BEGIN;

-- 1. Tambah kolom owner_credit_card_id
ALTER TABLE general_invoice_payments
  ADD COLUMN IF NOT EXISTS owner_credit_card_id UUID REFERENCES owner_credit_cards(id);

-- 2. Tambah kolom cc_settlement_id (link ke marketplace_settlements saat di-settle)
ALTER TABLE general_invoice_payments
  ADD COLUMN IF NOT EXISTS cc_settlement_id UUID REFERENCES marketplace_settlements(id);

-- 3. Drop old payment_method constraint
ALTER TABLE general_invoice_payments
  DROP CONSTRAINT IF EXISTS gen_inv_payments_method_check;

-- 4. Add new payment_method constraint (TRANSFER, CASH, CC_OWNER)
ALTER TABLE general_invoice_payments
  ADD CONSTRAINT gen_inv_payments_method_check CHECK (
    payment_method = ANY (ARRAY['TRANSFER', 'CASH', 'CC_OWNER'])
  );

-- 5. bank_account_id harus nullable (CC_OWNER tidak pakai bank)
ALTER TABLE general_invoice_payments
  ALTER COLUMN bank_account_id DROP NOT NULL;

-- 6. Constraint: CC_OWNER wajib owner_credit_card_id, TRANSFER/CASH wajib bank_account_id
ALTER TABLE general_invoice_payments
  DROP CONSTRAINT IF EXISTS gen_inv_payments_cc_or_bank_check;

ALTER TABLE general_invoice_payments
  ADD CONSTRAINT gen_inv_payments_cc_or_bank_check CHECK (
    (payment_method = 'CC_OWNER' AND owner_credit_card_id IS NOT NULL)
    OR
    (payment_method != 'CC_OWNER' AND bank_account_id IS NOT NULL)
  );

-- 7. marketplace_settlements: session_id harus nullable (general invoice payments tidak punya session)
ALTER TABLE marketplace_settlements
  ALTER COLUMN session_id DROP NOT NULL;

-- 8. Tambah kolom general_invoice_payment_id di marketplace_settlements
ALTER TABLE marketplace_settlements
  ADD COLUMN IF NOT EXISTS general_invoice_payment_id UUID REFERENCES general_invoice_payments(id);

-- 9. Constraint: EXACTLY satu source harus terisi (XOR — tidak boleh keduanya)
ALTER TABLE marketplace_settlements
  DROP CONSTRAINT IF EXISTS settlements_source_check;

ALTER TABLE marketplace_settlements
  ADD CONSTRAINT settlements_source_check CHECK (
    (session_id IS NOT NULL AND general_invoice_payment_id IS NULL)
    OR
    (session_id IS NULL AND general_invoice_payment_id IS NOT NULL)
  );

-- 10. Index untuk lookup
CREATE INDEX IF NOT EXISTS idx_gen_pay_cc_owner
  ON general_invoice_payments (owner_credit_card_id)
  WHERE owner_credit_card_id IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_gen_pay_cc_settlement
  ON general_invoice_payments (cc_settlement_id)
  WHERE cc_settlement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_settlements_gen_inv_pay
  ON marketplace_settlements (general_invoice_payment_id)
  WHERE general_invoice_payment_id IS NOT NULL;

COMMIT;
