-- Owner credit cards: default bank account for CC owner settlement (pelunasan)
-- Idempotent — safe to run multiple times.

ALTER TABLE owner_credit_cards
  ADD COLUMN IF NOT EXISTS settlement_bank_account_id INTEGER NULL
  REFERENCES bank_accounts(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_owner_cc_settlement_bank
  ON owner_credit_cards(settlement_bank_account_id);

COMMENT ON TABLE owner_credit_cards IS
  'Master kartu kredit owner yang dipakai untuk checkout marketplace. '
  'Setiap kartu dipetakan ke 1 akun COA (sub 210600). '
  'settlement_bank_account_id = rekening bank default untuk pelunasan kartu ini.';

COMMENT ON COLUMN owner_credit_cards.settlement_bank_account_id IS
  'Rekening bank default untuk pelunasan (bulk/single settlement). NULL = belum dikonfigurasi.';
