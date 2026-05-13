-- ============================================================================
-- Migration: Create Cash Count Tables (SIMPLIFIED)
-- Purpose: Track physical cash counting vs POS system balance per period
-- Tables: cash_counts (header), cash_count_details (daily breakdown)
-- ============================================================================

-- ============================================================================
-- TABLE: cash_counts
-- ============================================================================
-- Header cash count per periode per branch per payment method.
--
-- Simplified flow:
--   OPEN      → dibuat, system_balance sudah dihitung
--   COUNTED   → physical count diinput, difference dihitung
--   DEPOSITED → uang disetor ke bank
--   CLOSED    → bank statement match, selesai
--
-- Accountability:
--   Jika difference < 0 (deficit) → responsible_employee_id diisi
--   Deficit akan dipotong ke staff yang bertanggung jawab
-- ============================================================================

CREATE TABLE IF NOT EXISTS cash_counts (
  -- ── Primary Key ──
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Tenant ──
  company_id                UUID NOT NULL,
    -- Perusahaan pemilik data. Multi-tenant isolation.

  -- ── Periode ──
  start_date                DATE NOT NULL,
    -- Tanggal awal periode cash count.
    -- Contoh: 2026-04-01

  end_date                  DATE NOT NULL,
    -- Tanggal akhir periode cash count.
    -- Contoh: 2026-04-07
    -- CONSTRAINT: end_date >= start_date

  -- ── Dimensi ──
  branch_id                 UUID,
    -- Cabang/outlet yang dihitung.
    -- NULL = semua cabang (jarang, biasanya per cabang).
    -- FK → branches(id)

  payment_method_id         INTEGER NOT NULL,
    -- Payment method yang dihitung (harus tipe CASH).
    -- FK → payment_methods(id)
    -- Dari sini dapat COA via:
    --   payment_methods.coa_account_id (akun kas - ASSET)
    --   payment_methods.fee_coa_account_id (akun fee - EXPENSE)

  -- ── System Balance (auto-calculated dari aggregated_transactions) ──
  system_balance            NUMERIC(18,2) NOT NULL DEFAULT 0,
    -- Total penjualan cash dari aggregated_transactions di periode ini.
    -- Dihitung saat create:
    --   SUM(nett_amount) FROM aggregated_transactions
    --   WHERE branch_id = this.branch_id
    --     AND payment_method_id = this.payment_method_id
    --     AND transaction_date BETWEEN start_date AND end_date

  transaction_count         INTEGER NOT NULL DEFAULT 0,
    -- Jumlah transaksi yang dihitung (COUNT dari query yang sama).

  -- ── Physical Count (user input) ──
  physical_count            NUMERIC(18,2),
    -- Jumlah uang fisik hasil hitung manual.
    -- NULL saat status OPEN (belum dihitung).
    -- Diisi user saat melakukan cash count.

  -- ── Selisih (generated column) ──
  difference                NUMERIC(18,2) GENERATED ALWAYS AS (
                              COALESCE(physical_count, 0) - system_balance
                            ) STORED,
    -- Otomatis dihitung oleh database.
    -- Positif (+) = surplus (uang lebih dari seharusnya)
    -- Negatif (-) = deficit (uang kurang → dipotong ke staff)
    -- Nol (0)     = balance (sesuai)

  -- ── Status (4 saja) ──
  status                    VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    -- OPEN      = dibuat, belum ada physical count
    -- COUNTED   = physical_count sudah diinput, difference sudah ada
    -- DEPOSITED = uang sudah disetor ke bank
    -- CLOSED    = bank statement sudah match (reconciled), selesai

  -- ── Deposit Info ──
  deposit_amount            NUMERIC(18,2),
    -- Jumlah yang disetor ke bank.
    -- Bisa berbeda dari physical_count (misal ada pengeluaran kas kecil).
    -- NULL jika belum disetor.

  deposit_date              DATE,
    -- Tanggal uang disetor ke bank.

  deposit_bank_account_id   INTEGER,
    -- Bank account tujuan setoran.
    -- FK → bank_accounts(id)

  deposit_reference         VARCHAR(100),
    -- Nomor referensi setoran (slip setoran, dll).

  -- ── Accountability (untuk deficit) ──
  responsible_employee_id   UUID,
    -- Employee yang bertanggung jawab atas deficit.
    -- FK → employees(id)
    -- Diisi jika difference < 0 (deficit).
    -- NULL jika surplus atau balance.
    -- Digunakan untuk laporan accountability dan potongan gaji.

  -- ── Notes ──
  notes                     TEXT,
    -- Catatan tambahan dari user.
    -- Misal: "Selisih karena kembalian pecahan kecil"

  -- ── Audit Trail ──
  counted_by                UUID,
    -- User yang melakukan physical count. FK → users(id)
  counted_at                TIMESTAMPTZ,
    -- Waktu physical count dilakukan.

  deposited_by              UUID,
    -- User yang melakukan setoran. FK → users(id)
  deposited_at              TIMESTAMPTZ,
    -- Waktu setoran dilakukan.

  closed_by                 UUID,
    -- User yang close (setelah reconcile). FK → users(id)
  closed_at                 TIMESTAMPTZ,
    -- Waktu close.

  created_by                UUID,
    -- User yang membuat record. FK → users(id)
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ,
    -- Soft delete. NULL = aktif.

  -- ── Constraints ──
  CONSTRAINT chk_cash_count_date_range
    CHECK (end_date >= start_date),

  CONSTRAINT chk_cash_count_status
    CHECK (status IN ('OPEN', 'COUNTED', 'DEPOSITED', 'CLOSED')),

  CONSTRAINT chk_cash_count_system_balance_non_negative
    CHECK (system_balance >= 0),

  CONSTRAINT chk_cash_count_physical_count_non_negative
    CHECK (physical_count IS NULL OR physical_count >= 0),

  CONSTRAINT chk_cash_count_deposit_amount_non_negative
    CHECK (deposit_amount IS NULL OR deposit_amount >= 0)
);


-- ── Indexes ──

-- Query utama: per company + periode
CREATE INDEX idx_cash_counts_company_period
  ON cash_counts(company_id, start_date, end_date)
  WHERE deleted_at IS NULL;

-- Filter per branch + payment method
CREATE INDEX idx_cash_counts_branch_pm
  ON cash_counts(branch_id, payment_method_id)
  WHERE deleted_at IS NULL;

-- Filter per status
CREATE INDEX idx_cash_counts_status
  ON cash_counts(company_id, status)
  WHERE deleted_at IS NULL;

-- Cari cash counts dengan deficit (untuk accountability report)
CREATE INDEX idx_cash_counts_deficit
  ON cash_counts(company_id, responsible_employee_id)
  WHERE deleted_at IS NULL;

-- ── Unique Constraint ──
-- Tidak boleh ada 2 cash count aktif untuk kombinasi yang sama
CREATE UNIQUE INDEX uq_cash_counts_period_branch_pm
  ON cash_counts(company_id, start_date, end_date, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'), payment_method_id)
  WHERE deleted_at IS NULL;
  -- Note: COALESCE branch_id karena NULL != NULL di unique index


-- ── Comments ──
COMMENT ON TABLE cash_counts IS
  'Header cash count: perbandingan system balance (POS) vs physical count per periode per branch per payment method';

COMMENT ON COLUMN cash_counts.system_balance IS
  'Auto-calculated saat create: SUM(nett_amount) dari aggregated_transactions untuk periode + branch + payment method ini';

COMMENT ON COLUMN cash_counts.physical_count IS
  'Input manual user: jumlah uang fisik hasil hitung. NULL = belum dihitung (status OPEN)';

COMMENT ON COLUMN cash_counts.difference IS
  'Generated column: physical_count - system_balance. Positif=surplus, Negatif=deficit (dipotong ke staff)';

COMMENT ON COLUMN cash_counts.responsible_employee_id IS
  'Employee bertanggung jawab atas deficit (difference < 0). Untuk laporan accountability dan potongan gaji';


-- ============================================================================
-- TABLE: cash_count_details
-- ============================================================================
-- Breakdown harian dari cash count.
-- 1 row = 1 hari dalam periode cash count.
-- Untuk audit trail dan detail per hari.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cash_count_details (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cash_count_id     UUID NOT NULL REFERENCES cash_counts(id) ON DELETE CASCADE,
    -- FK ke header cash_counts.
    -- CASCADE: hapus header → hapus semua detail.

  transaction_date  DATE NOT NULL,
    -- Tanggal transaksi (1 row per hari dalam periode).

  amount            NUMERIC(18,2) NOT NULL DEFAULT 0,
    -- Jumlah penjualan cash di tanggal ini.
    -- Dari SUM(nett_amount) aggregated_transactions per hari.

  transaction_count INTEGER NOT NULL DEFAULT 0,
    -- Jumlah transaksi di tanggal ini.

  notes             TEXT,
    -- Catatan per hari (misal: "Mesin POS error, data manual").

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──
CREATE INDEX idx_cash_count_details_parent
  ON cash_count_details(cash_count_id);

CREATE INDEX idx_cash_count_details_date
  ON cash_count_details(cash_count_id, transaction_date);

-- ── Comments ──
COMMENT ON TABLE cash_count_details IS
  'Breakdown harian: detail penjualan cash per hari dalam periode cash count';


-- ============================================================================
-- TRIGGER: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cash_counts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cash_counts_updated_at
  BEFORE UPDATE ON cash_counts
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_counts_updated_at();


-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

ALTER TABLE cash_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_count_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_counts_company_isolation ON cash_counts
  FOR ALL USING (company_id = current_setting('app.company_id')::UUID);

CREATE POLICY cash_count_details_isolation ON cash_count_details
  FOR ALL USING (
    cash_count_id IN (
      SELECT id FROM cash_counts
      WHERE company_id = current_setting('app.company_id')::UUID
    )
  );


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP TRIGGER IF EXISTS trg_cash_counts_updated_at ON cash_counts;
-- DROP FUNCTION IF EXISTS update_cash_counts_updated_at();
-- DROP TABLE IF EXISTS cash_count_details CASCADE;
-- DROP TABLE IF EXISTS cash_counts CASCADE;
