-- ============================================================
-- Migration: Unify pos_sync_aggregates → aggregated_transactions
-- Purpose: Single reconciliation path via aggregated_transactions
-- ============================================================

-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- Must be executed before BEGIN.

-- Add 'SUPERSEDED' to aggregated_transaction_status enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SUPERSEDED'
      AND enumtypid = 'aggregated_transaction_status'::regtype
  ) THEN
    ALTER TYPE aggregated_transaction_status ADD VALUE 'SUPERSEDED';
  END IF;
END $$;

BEGIN;

-- 1. Add new columns to aggregated_transactions
ALTER TABLE aggregated_transactions
  ADD COLUMN IF NOT EXISTS pos_sync_aggregate_id uuid
    REFERENCES pos_sync_aggregates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_by uuid
    REFERENCES aggregated_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_aggregated_pos_sync_agg_id
  ON aggregated_transactions(pos_sync_aggregate_id)
  WHERE pos_sync_aggregate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aggregated_superseded_by
  ON aggregated_transactions(superseded_by)
  WHERE superseded_by IS NOT NULL;

-- 2. Backfill: push pos_sync_aggregates (READY/JOURNALED/RECALCULATED) → aggregated_transactions
INSERT INTO aggregated_transactions (
  source_type,
  source_id,
  source_ref,
  transaction_date,
  payment_method_id,
  branch_id,
  branch_name,
  gross_amount,
  discount_amount,
  tax_amount,
  nett_amount,
  total_fee_amount,
  percentage_fee_amount,
  fixed_fee_amount,
  bill_after_discount,
  is_reconciled,
  pos_sync_aggregate_id,
  status,
  created_at,
  updated_at
)
SELECT
  'POS_SYNC',
  p.id::text,
  p.sales_date || '_' || p.branch_pos_id || '_' || p.payment_pos_id,
  p.sales_date,
  p.payment_method_id,
  p.branch_id,
  p.branch_name,
  p.gross_amount,
  p.discount_amount,
  p.tax_amount,
  p.nett_amount,
  p.total_fee_amount,
  p.percentage_fee_amount,
  p.fixed_fee_amount_calc,
  p.grand_total,
  p.is_reconciled,
  p.id,
  'READY',
  p.created_at,
  p.updated_at
FROM pos_sync_aggregates p
WHERE p.status IN ('READY', 'JOURNALED', 'RECALCULATED')
ON CONFLICT (source_type, source_id, source_ref) DO NOTHING;

-- 3. Enforce one aggregated_transactions per pos_sync_aggregate (after backfill to avoid conflicts)
CREATE UNIQUE INDEX IF NOT EXISTS uq_aggregated_pos_sync_source
  ON aggregated_transactions(pos_sync_aggregate_id)
  WHERE pos_sync_aggregate_id IS NOT NULL
    AND source_type = 'POS_SYNC'
    AND deleted_at IS NULL;

-- 4. Migrate bank_statements reconciliation links:
--    pos_sync_aggregate_id → reconciliation_id (via aggregated_transactions)
UPDATE bank_statements bs
SET
  reconciliation_id = at.id,
  pos_sync_aggregate_id = NULL,
  updated_at = now()
FROM aggregated_transactions at
WHERE at.pos_sync_aggregate_id = bs.pos_sync_aggregate_id
  AND bs.pos_sync_aggregate_id IS NOT NULL
  AND bs.reconciliation_id IS NULL;

-- 5. Prevent dual-match: pos_sync_aggregate_id should no longer be used
--    This guards against old code paths until the column is dropped
ALTER TABLE bank_statements
  ADD CONSTRAINT chk_no_dual_match
  CHECK (
    pos_sync_aggregate_id IS NULL
    OR reconciliation_id IS NULL
  );

-- 6. Supersede manual CSV entries where POS_SYNC exists for same period
--    Only supersede unreconciled manual entries
WITH pos_sync_entries AS (
  SELECT id, transaction_date, payment_method_id, branch_id
  FROM aggregated_transactions
  WHERE source_type = 'POS_SYNC'
    AND deleted_at IS NULL
    AND superseded_by IS NULL
)
UPDATE aggregated_transactions manual_at
SET
  superseded_by = pse.id,
  status = 'SUPERSEDED',
  updated_at = now()
FROM pos_sync_entries pse
WHERE manual_at.source_type = 'POS'
  AND manual_at.transaction_date = pse.transaction_date
  AND manual_at.payment_method_id = pse.payment_method_id
  AND manual_at.branch_id = pse.branch_id
  AND manual_at.is_reconciled = false
  AND manual_at.deleted_at IS NULL
  AND manual_at.superseded_by IS NULL;

-- 7. Verification: ensure no bank_statements still reference pos_sync_aggregate_id
DO $$
DECLARE
  remaining_count integer;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM bank_statements
  WHERE pos_sync_aggregate_id IS NOT NULL;

  IF remaining_count > 0 THEN
    RAISE WARNING 'Migration verification: % bank_statements still have pos_sync_aggregate_id set. These were not migrated to reconciliation_id.', remaining_count;
  END IF;
END $$;

-- 8. Check for orphaned bank_statements referencing pos_sync_aggregates
--    that were not backfilled (e.g. status PENDING or INVALID)
DO $$
DECLARE
  orphaned_count integer;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM bank_statements bs
  LEFT JOIN aggregated_transactions at
    ON at.pos_sync_aggregate_id = bs.pos_sync_aggregate_id
  WHERE bs.pos_sync_aggregate_id IS NOT NULL
    AND at.id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE WARNING 'Migration: % bank_statements reference pos_sync_aggregates that were not backfilled (status not READY/JOURNALED/RECALCULATED). Manual review required.', orphaned_count;
  END IF;
END $$;

COMMIT;
