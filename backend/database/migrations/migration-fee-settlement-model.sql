-- ============================================================
-- Migration: Add fee_settlement_model to payment_methods
-- ============================================================
-- ACCRUAL : fee diakui sebagai expense + liability dulu,
--           baru clear saat bank settlement (default semua existing)
-- NET     : provider langsung potong fee dari settlement,
--           tidak ada payable stage — skip liability line
-- ============================================================

ALTER TABLE public.payment_methods
ADD COLUMN fee_settlement_model CHARACTER VARYING(10)
  NOT NULL DEFAULT 'ACCRUAL'
  CONSTRAINT payment_methods_fee_settlement_model_check
    CHECK (fee_settlement_model IN ('ACCRUAL', 'NET'));

COMMENT ON COLUMN public.payment_methods.fee_settlement_model IS
  'ACCRUAL = fee expense + MDR payable liability (cleared at bank settlement). '
  'NET = provider nets fee from payout, no payable stage needed.';

-- Index untuk filtering
CREATE INDEX IF NOT EXISTS idx_payment_methods_fee_settlement_model
  ON public.payment_methods USING btree (fee_settlement_model)
  TABLESPACE pg_default
  WHERE deleted_at IS NULL;

-- Semua existing payment methods default ke ACCRUAL (sudah di-set via DEFAULT)
-- Kalau ada provider yang NET settlement, update manual:
-- UPDATE public.payment_methods
--   SET fee_settlement_model = 'NET'
-- WHERE code IN ('GOPAY', 'OVO', ...)   -- sesuaikan
--   AND company_id = '...';
