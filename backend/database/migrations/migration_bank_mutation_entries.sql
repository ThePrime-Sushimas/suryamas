-- ============================================================
-- Migration: Create bank_mutation_entries + link to bank_statements
-- For non-POS bank mutations (fees, transfers, interest, etc.)
-- ============================================================

-- 1. Entry type enum
DO $$ BEGIN
  CREATE TYPE bank_mutation_entry_type AS ENUM (
    'BANK_FEE', 'INTEREST', 'TRANSFER_IN', 'TRANSFER_OUT',
    'SUPPLIER_PAYMENT', 'RECEIVABLE', 'REFUND', 'TAX_PAYMENT', 'PAYROLL', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Status enum
DO $$ BEGIN
  CREATE TYPE bank_mutation_entry_status AS ENUM ('ACTIVE', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Main table
CREATE TABLE IF NOT EXISTS bank_mutation_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL,

  entry_date          DATE NOT NULL,
  entry_type          bank_mutation_entry_type NOT NULL,
  description         TEXT NOT NULL,
  amount              NUMERIC(18, 2) NOT NULL,
  reference_number    TEXT,

  bank_account_id     INTEGER REFERENCES bank_accounts(id),

  -- COA (NOT NULL karena wajib untuk journal)
  coa_id              UUID NOT NULL,
  coa_code            TEXT,
  coa_name            TEXT,

  -- Reconciliation
  bank_statement_id   BIGINT REFERENCES bank_statements(id),
  is_reconciled       BOOLEAN NOT NULL DEFAULT FALSE,
  reconciled_at       TIMESTAMPTZ,
  reconciled_by       UUID,

  -- Journal link
  journal_header_id   UUID,

  -- Status
  status              bank_mutation_entry_status NOT NULL DEFAULT 'ACTIVE',
  void_reason         TEXT,
  voided_at           TIMESTAMPTZ,
  voided_by           UUID,

  notes               TEXT,

  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID,
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_bme_company_id       ON bank_mutation_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_bme_bank_account_id  ON bank_mutation_entries(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bme_entry_date       ON bank_mutation_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_bme_is_reconciled    ON bank_mutation_entries(is_reconciled);
CREATE INDEX IF NOT EXISTS idx_bme_bank_statement   ON bank_mutation_entries(bank_statement_id);
CREATE INDEX IF NOT EXISTS idx_bme_deleted_at       ON bank_mutation_entries(deleted_at) WHERE deleted_at IS NULL;

-- 5. Unique: satu statement hanya bisa punya satu mutation entry (active)
CREATE UNIQUE INDEX IF NOT EXISTS uq_bme_bank_statement_id
  ON bank_mutation_entries(bank_statement_id)
  WHERE bank_statement_id IS NOT NULL AND deleted_at IS NULL;

-- 6. FK kolom di bank_statements
ALTER TABLE bank_statements
  ADD COLUMN IF NOT EXISTS bank_mutation_entry_id UUID REFERENCES bank_mutation_entries(id);

CREATE INDEX IF NOT EXISTS idx_bs_bank_mutation_entry_id
  ON bank_statements(bank_mutation_entry_id)
  WHERE bank_mutation_entry_id IS NOT NULL;

-- 7. Extend mutual-exclusion constraint
--    Hanya satu sumber reconciliation yang boleh aktif per statement
ALTER TABLE bank_statements DROP CONSTRAINT IF EXISTS chk_no_dual_match;
ALTER TABLE bank_statements ADD CONSTRAINT chk_no_dual_match CHECK (
  (
    (reconciliation_id IS NOT NULL)::int +
    (reconciliation_group_id IS NOT NULL)::int +
    (cash_deposit_id IS NOT NULL)::int +
    (bank_mutation_entry_id IS NOT NULL)::int
  ) <= 1
);

-- 8. Updated_at trigger
CREATE OR REPLACE FUNCTION update_bank_mutation_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bme_updated_at ON bank_mutation_entries;
CREATE TRIGGER trg_bme_updated_at
  BEFORE UPDATE ON bank_mutation_entries
  FOR EACH ROW EXECUTE FUNCTION update_bank_mutation_entries_updated_at();

-- 9. Comment
COMMENT ON TABLE bank_mutation_entries IS
  'Manual reconciliation entries untuk mutasi bank yang bukan berasal dari POS. '
  'Dibuat one-step saat user mereconcile bank statement non-POS.';
