-- ============================================================================
// Database Migration: Add Fee Columns to Payment Methods
// ============================================================================
//
// PURPOSE: Add 3 fee columns untuk fee reconciliation
// TARGET TABLE: payment_methods
// DATE: 2024
//
// KOLOM YANG DITAMBAH:
// 1. fee_percentage - Persentase biaya (MDR/komisi platform)
// 2. fee_fixed_amount - Jumlah biaya tetap per transaksi/total  
// 3. fee_fixed_per_transaction - Boolean: per transaksi vs per total
//
// NOTE: Marketing Fee TIDAK ada di payment method!
// Marketing Fee = Expected Net (dari fee config) - Actual dari Bank
//
// FLOW:
// 1. POS IMPORT → AGGREGATED (per payment method)
// 2. HITUNG EXPECTED: Gross - (percentage_fee + fixed_fee)
// 3. COMPARE: Expected vs Actual dari mutasi bank
// 4. SELISIH = Marketing Fee (input manual)
//
// ============================================================================

-- Migration Script untuk Supabase/PostgreSQL

-- ============================================================================
-- STEP 1: Add Columns (dengan DEFAULT values untuk backward compatibility)
-- ============================================================================

-- Add fee_percentage column
ALTER TABLE payment_methods 
ADD COLUMN IF NOT EXISTS fee_percentage DECIMAL(5, 2) DEFAULT 0 NOT NULL;

-- Add fee_fixed_amount column  
ALTER TABLE payment_methods 
ADD COLUMN IF NOT EXISTS fee_fixed_amount DECIMAL(15, 2) DEFAULT 0 NOT NULL;

-- Add fee_fixed_per_transaction column
ALTER TABLE payment_methods 
ADD COLUMN IF NOT EXISTS fee_fixed_per_transaction BOOLEAN DEFAULT FALSE NOT NULL;

-- ============================================================================
-- STEP 2: Add Comments untuk Documentation
-- ============================================================================

COMMENT ON COLUMN payment_methods.fee_percentage IS 
'Persentase biaya (MDR/merchant fee). Contoh: 2.5 = 2.5%, 20.0 = 20% untuk Gojek';

COMMENT ON COLUMN payment_methods.fee_fixed_amount IS 
'Jumlah biaya tetap. Contoh: 500 = Rp 500. Dikali transaction count jika fee_fixed_per_transaction = true';

COMMENT ON COLUMN payment_methods.fee_fixed_per_transaction IS 
'Apakah fixed fee dikenakan per transaksi (true) atau per total settlement (false).
true = GoPay/OVO/DANA/Grab (per tx), false = QRIS/EDC/Card (per settlement)';

-- ============================================================================
-- STEP 3: Add Indexes untuk Performance
-- ============================================================================

-- Index untuk filter payment methods dengan fee configuration
CREATE INDEX IF NOT EXISTS idx_payment_methods_fee_config 
ON payment_methods(company_id, fee_percentage, fee_fixed_amount) 
WHERE is_active = true AND deleted_at IS NULL;

-- Index untuk query berdasarkan fee_percentage
CREATE INDEX IF NOT EXISTS idx_payment_methods_fee_percentage 
ON payment_methods(company_id, fee_percentage) 
WHERE is_active = true AND deleted_at IS NULL AND fee_percentage > 0;

-- ============================================================================
-- STEP 4: Add Constraints (untuk validasi)
-- ============================================================================

-- Add check constraint untuk fee_percentage (0-100)
ALTER TABLE payment_methods 
ADD CONSTRAINT IF NOT EXISTS chk_fee_percentage_range 
CHECK (fee_percentage >= 0 AND fee_percentage <= 100);

-- Add check constraint untuk fee_fixed_amount (non-negative)
ALTER TABLE payment_methods 
ADD CONSTRAINT IF NOT EXISTS chk_fee_fixed_amount_non_negative 
CHECK (fee_fixed_amount >= 0);

-- ============================================================================
-- STEP 5: Update Existing Data dengan Default Values
-- ============================================================================

-- Update existing records dengan default 0 values
UPDATE payment_methods 
SET 
  fee_percentage = COALESCE(fee_percentage, 0),
  fee_fixed_amount = COALESCE(fee_fixed_amount, 0),
  fee_fixed_per_transaction = COALESCE(fee_fixed_per_transaction, false)
WHERE fee_percentage IS NULL 
   OR fee_fixed_amount IS NULL 
   OR fee_fixed_per_transaction IS NULL;

-- ============================================================================
-- STEP 6: Contoh Data Payment Methods dengan Fee Configuration
-- ============================================================================

/*
-- QRIS (MDR 0.7% per total)
INSERT INTO payment_methods (company_id, code, name, payment_type, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction)
VALUES ('company-uuid', 'QRIS', 'QRIS', 'CARD', 0.7, 0, false);

-- Gojek/GoFood (20% + 500 per transaksi)
INSERT INTO payment_methods (company_id, code, name, payment_type, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction)
VALUES ('company-uuid', 'GOPAY', 'GoPay', 'BANK', 20.0, 500, true);

-- OVO (15% + 1000 per transaksi)
INSERT INTO payment_methods (company_id, code, name, payment_type, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction)
VALUES ('company-uuid', 'OVO', 'OVO', 'BANK', 15.0, 1000, true);

-- Grab (25% + 500 per transaksi)
INSERT INTO payment_methods (company_id, code, name, payment_type, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction)
VALUES ('company-uuid', 'GRAB', 'Grab', 'BANK', 25.0, 500, true);

-- Debit Card (0.5% + 500 per total)
INSERT INTO payment_methods (company_id, code, name, payment_type, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction)
VALUES ('company-uuid', 'DEBIT', 'Debit Card', 'CARD', 0.5, 500, false);

-- Credit Card (2% + 3000 per total)
INSERT INTO payment_methods (company_id, code, name, payment_type, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction)
VALUES ('company-uuid', 'CC', 'Kartu Kredit', 'CARD', 2.0, 3000, false);

-- Cash (Tanpa fee)
INSERT INTO payment_methods (company_id, code, name, payment_type, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction)
VALUES ('company-uuid', 'CASH', 'Tunai', 'CASH', 0, 0, false);
*/

-- ============================================================================
-- STEP 7: Verification Query
-- ============================================================================

-- Query untuk verify columns sudah ditambahkan dengan benar
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_methods'
  AND column_name IN ('fee_percentage', 'fee_fixed_amount', 'fee_fixed_per_transaction')
ORDER BY column_name;

-- Query untuk check data dengan fee configuration
SELECT 
  code,
  name,
  payment_type,
  fee_percentage,
  fee_fixed_amount,
  fee_fixed_per_transaction,
  CASE 
    WHEN fee_fixed_per_transaction THEN fee_fixed_amount || ' per transaksi'
    ELSE fee_fixed_amount || ' per total'
  END as fee_type
FROM payment_methods
WHERE is_active = true 
  AND deleted_at IS NULL
  AND (fee_percentage > 0 OR fee_fixed_amount > 0)
ORDER BY payment_type, code;

-- ============================================================================
-- STEP 8: Trigger untuk Updated_at (Automatic timestamp)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_methods_updated_at ON payment_methods;

CREATE TRIGGER trg_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_methods_updated_at();

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================

/*
-- Untuk rollback, jalankan:

-- Drop constraints
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS chk_fee_percentage_range;
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS chk_fee_fixed_amount_non_negative;

-- Drop indexes
DROP INDEX IF EXISTS idx_payment_methods_fee_config;
DROP INDEX IF EXISTS idx_payment_methods_fee_percentage;

-- Drop trigger
DROP TRIGGER IF EXISTS trg_payment_methods_updated_at ON payment_methods;
DROP FUNCTION IF EXISTS update_payment_methods_updated_at();

-- Drop columns
ALTER TABLE payment_methods DROP COLUMN IF EXISTS fee_percentage;
ALTER TABLE payment_methods DROP COLUMN IF EXISTS fee_fixed_amount;
ALTER TABLE payment_methods DROP COLUMN IF EXISTS fee_fixed_per_transaction;
*/

-- ============================================================================
-- CONTOH PERHITUNGAN (untuk referensi)
-- ============================================================================

/*
-- Gojek Example:
-- Total Gross: Rp 1,000,000 (10 transaksi @ Rp 100,000)
-- fee_percentage: 20%
-- fee_fixed_amount: 500
-- fee_fixed_per_transaction: true

Expected Net:
1. Percentage Fee: 1,000,000 × 20% = 200,000
2. Fixed Fee: 10 × 500 = 5,000
3. Total Fee: 205,000
4. Expected Net: 1,000,000 - 205,000 = 795,000

Marketing Fee:
- Jika Actual Bank: 750,000
- Marketing Fee = 795,000 - 750,000 = 45,000

-- QRIS Example:
-- Total Gross: Rp 500,000
-- fee_percentage: 0.7%
-- fee_fixed_amount: 0
-- fee_fixed_per_transaction: false

Expected Net:
1. Percentage Fee: 500,000 × 0.7% = 3,500
2. Fixed Fee: 0
3. Expected Net: 496,500

Marketing Fee:
- Jika Actual Bank: 496,500
- Marketing Fee = 0 (matched!)
*/

-- ============================================================================
// END OF MIGRATION
// ============================================================================

