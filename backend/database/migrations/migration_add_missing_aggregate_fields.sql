-- ============================================================================
-- Migration: Add missing journal fields to aggregate tables
-- Source: tr_saleshead fields yang belum masuk ke aggregates
-- ============================================================================

-- ── pos_sync_aggregates ─────────────────────────────────────────────────────
ALTER TABLE public.pos_sync_aggregates
  ADD COLUMN IF NOT EXISTS rounding_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS menu_discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_payment_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_vat_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pax_total integer NOT NULL DEFAULT 0;

-- ── pos_sync_aggregate_lines ────────────────────────────────────────────────
ALTER TABLE public.pos_sync_aggregate_lines
  ADD COLUMN IF NOT EXISTS rounding_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_discount_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS menu_discount_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_vat_total numeric NOT NULL DEFAULT 0;

-- ── aggregated_transactions ─────────────────────────────────────────────────
-- NOTE: other_tax_amount dari pos_sync_aggregates di-map ke service_charge_amount
--       yang sudah ada di aggregated_transactions (tidak perlu kolom baru)
ALTER TABLE public.aggregated_transactions
  ADD COLUMN IF NOT EXISTS rounding_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_cost numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_fee numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_discount_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_discount_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS menu_discount_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_payment_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_vat_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pax_total integer NOT NULL DEFAULT 0;

-- ── Add VOID and SUPERSEDED to aggregated_transaction_status enum ───────────
-- SUPERSEDED sudah dipakai di code tapi belum ada di enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'VOID'
    AND enumtypid = 'public.aggregated_transaction_status'::regtype
  ) THEN
    ALTER TYPE public.aggregated_transaction_status ADD VALUE 'VOID';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SUPERSEDED'
    AND enumtypid = 'public.aggregated_transaction_status'::regtype
  ) THEN
    ALTER TYPE public.aggregated_transaction_status ADD VALUE 'SUPERSEDED';
  END IF;
END $$;
