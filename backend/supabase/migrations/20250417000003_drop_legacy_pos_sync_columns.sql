-- ══════════════════════════════════════════════════════════════════
-- Drop legacy reconciliation columns dari pos_sync_aggregates
--
-- Kolom-kolom ini legacy dari desain awal dimana pos_sync_aggregates
-- adalah source of truth. Sekarang aggregated_transactions yang jadi
-- source of truth. pos_sync_aggregates hanya staging/raw data.
--
-- Kolom yang dihapus:
--   bank_statement_id, reconciled_at, reconciled_by,
--   actual_fee_amount, fee_discrepancy, fee_discrepancy_note,
--   journal_id
--
-- Kolom yang TETAP (masih dipakai sebagai read cache):
--   is_reconciled
--
-- Trigger trg_sync_pos_sync_reconciliation di-update supaya
-- hanya sync is_reconciled (tidak perlu reset kolom yang sudah dihapus)
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Drop legacy columns
ALTER TABLE pos_sync_aggregates
  DROP COLUMN IF EXISTS bank_statement_id,
  DROP COLUMN IF EXISTS reconciled_at,
  DROP COLUMN IF EXISTS reconciled_by,
  DROP COLUMN IF EXISTS actual_fee_amount,
  DROP COLUMN IF EXISTS fee_discrepancy,
  DROP COLUMN IF EXISTS fee_discrepancy_note,
  DROP COLUMN IF EXISTS journal_id;

-- 2. Update trigger — hanya sync is_reconciled, kolom lain sudah tidak ada
CREATE OR REPLACE FUNCTION public.sync_pos_sync_reconciliation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_reconciled IS NOT DISTINCT FROM NEW.is_reconciled THEN
    RETURN NEW;
  END IF;

  IF NEW.source_type = 'POS_SYNC' AND NEW.pos_sync_aggregate_id IS NOT NULL THEN
    UPDATE pos_sync_aggregates
    SET
      is_reconciled = NEW.is_reconciled,
      updated_at    = now()
    WHERE id = NEW.pos_sync_aggregate_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Verification
SELECT
  column_name
FROM information_schema.columns
WHERE table_name = 'pos_sync_aggregates'
  AND table_schema = 'public'
  AND column_name IN (
    'bank_statement_id', 'reconciled_at', 'reconciled_by',
    'actual_fee_amount', 'fee_discrepancy', 'fee_discrepancy_note',
    'journal_id'
  );
-- Should return 0 rows

COMMIT;
