-- ============================================================================
-- Migration: Cash Deposits + Cleanup Cash Counts
-- 
-- 1. Create cash_deposits table (setoran kas)
-- 2. Add cash_deposit_id FK to cash_counts
-- 3. Drop unused columns from cash_counts
-- 4. Drop unused cash_count_details table
-- ============================================================================


-- ============================================================================
-- 1. CREATE cash_deposits
-- ============================================================================
-- 1 deposit = gabungan pecahan besar dari N cash_counts (beberapa hari)
-- 1 deposit = 1 bank statement (saat reconcile)
--
-- Flow:
--   PENDING    → sudah disetor ke bank, menunggu bank statement masuk
--   RECONCILED → bank statement sudah match
-- ============================================================================

CREATE TABLE IF NOT EXISTS cash_deposits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id        UUID NOT NULL,
    -- Tenant isolation

  -- ── Jumlah & Tanggal Setor ──
  deposit_amount    NUMERIC(18,2) NOT NULL,
    -- Total yang disetor = SUM(large_denomination) dari cash_counts terpilih

  deposit_date      DATE NOT NULL,
    -- Tanggal uang disetor ke bank

  -- ── Bank Tujuan ──
  bank_account_id   INTEGER NOT NULL,
    -- Bank account tujuan setoran
    -- FK → bank_accounts(id)

  reference         VARCHAR(100),
    -- Nomor slip setoran / referensi

  -- ── Reconciliation Link ──
  bank_statement_id BIGINT,
    -- Link ke bank statement saat sudah match
    -- FK → bank_statements(id)
    -- NULL = belum reconcile (PENDING)
    -- Diisi dari halaman Bank Reconciliation

  -- ── Status ──
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING    = sudah disetor, menunggu bank statement
    -- RECONCILED = bank statement sudah match

  -- ── Context (dari cash_counts yang di-group) ──
  branch_name       VARCHAR(255),
    -- Cabang asal setoran

  payment_method_id INTEGER,
    -- Payment method (cash)

  period_start      DATE,
    -- Tanggal awal cash counts yang termasuk dalam deposit ini

  period_end        DATE,
    -- Tanggal akhir cash counts yang termasuk dalam deposit ini

  item_count        INTEGER NOT NULL DEFAULT 0,
    -- Jumlah cash_counts yang termasuk dalam deposit ini

  -- ── Notes ──
  notes             TEXT,

  -- ── Audit ──
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,

  -- ── Constraints ──
  CONSTRAINT chk_cash_deposit_status
    CHECK (status IN ('PENDING', 'RECONCILED')),

  CONSTRAINT chk_cash_deposit_amount
    CHECK (deposit_amount > 0)
);

-- Indexes
CREATE INDEX idx_cash_deposits_company
  ON cash_deposits(company_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_cash_deposits_bank_account
  ON cash_deposits(bank_account_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_cash_deposits_bank_statement
  ON cash_deposits(bank_statement_id)
  WHERE bank_statement_id IS NOT NULL;

CREATE INDEX idx_cash_deposits_date
  ON cash_deposits(company_id, deposit_date)
  WHERE deleted_at IS NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_cash_deposits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cash_deposits_updated_at
  BEFORE UPDATE ON cash_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_deposits_updated_at();

-- RLS
ALTER TABLE cash_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_deposits_company_isolation ON cash_deposits
  FOR ALL USING (company_id = current_setting('app.company_id')::UUID);

-- Comments
COMMENT ON TABLE cash_deposits IS
  'Setoran kas: gabungan pecahan besar dari N cash_counts, link ke bank_statements saat reconcile';

COMMENT ON COLUMN cash_deposits.deposit_amount IS
  'Total disetor = SUM(large_denomination) dari cash_counts terpilih';

COMMENT ON COLUMN cash_deposits.bank_statement_id IS
  'Link ke bank_statements(id) saat reconcile. NULL = PENDING';


-- ============================================================================
-- 2. ALTER cash_counts — tambah FK ke cash_deposits
-- ============================================================================

ALTER TABLE cash_counts
  ADD COLUMN IF NOT EXISTS cash_deposit_id UUID
  REFERENCES cash_deposits(id) ON DELETE SET NULL;

CREATE INDEX idx_cash_counts_deposit
  ON cash_counts(cash_deposit_id)
  WHERE cash_deposit_id IS NOT NULL;

COMMENT ON COLUMN cash_counts.cash_deposit_id IS
  'Link ke cash_deposits. Diisi saat cash count di-group ke setoran';


-- ============================================================================
-- 3. DROP unused columns dari cash_counts
--    (pindah ke cash_deposits)
-- ============================================================================

ALTER TABLE cash_counts DROP COLUMN IF EXISTS deposit_amount;
ALTER TABLE cash_counts DROP COLUMN IF EXISTS deposit_date;
ALTER TABLE cash_counts DROP COLUMN IF EXISTS deposit_bank_account_id;
ALTER TABLE cash_counts DROP COLUMN IF EXISTS deposit_reference;
ALTER TABLE cash_counts DROP COLUMN IF EXISTS deposited_by;
ALTER TABLE cash_counts DROP COLUMN IF EXISTS deposited_at;


-- ============================================================================
-- 4. DROP unused cash_count_details table
--    (tidak terpakai karena cash_counts sudah per hari per cabang)
-- ============================================================================

DROP TABLE IF EXISTS cash_count_details CASCADE;


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- ALTER TABLE cash_counts DROP COLUMN IF EXISTS cash_deposit_id;
-- ALTER TABLE cash_counts ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(18,2);
-- ALTER TABLE cash_counts ADD COLUMN IF NOT EXISTS deposit_date DATE;
-- ALTER TABLE cash_counts ADD COLUMN IF NOT EXISTS deposit_bank_account_id INTEGER;
-- ALTER TABLE cash_counts ADD COLUMN IF NOT EXISTS deposit_reference VARCHAR(100);
-- ALTER TABLE cash_counts ADD COLUMN IF NOT EXISTS deposited_by UUID;
-- ALTER TABLE cash_counts ADD COLUMN IF NOT EXISTS deposited_at TIMESTAMPTZ;
-- DROP TRIGGER IF EXISTS trg_cash_deposits_updated_at ON cash_deposits;
-- DROP FUNCTION IF EXISTS update_cash_deposits_updated_at();
-- DROP TABLE IF EXISTS cash_deposits CASCADE;
-- CREATE TABLE cash_count_details (...); -- recreate if needed
