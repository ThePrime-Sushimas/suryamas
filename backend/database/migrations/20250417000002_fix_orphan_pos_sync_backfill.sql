-- ══════════════════════════════════════════════════════════════════
-- Fix: Backfill orphaned pos_sync_aggregates → aggregated_transactions
-- dan supersede POS twins
--
-- Root cause: Migration 20250101 supersede by branch_id, tapi banyak
-- record POS punya branch_id = NULL. Sekarang match by branch_name.
--
-- Flow:
--   1. Backfill pos_sync_aggregates yang belum punya aggregated_transactions
--   2. Supersede POS record yang punya POS_SYNC twin (by branch_name)
--   3. Migrate reconciliation links dari POS → POS_SYNC jika POS sudah reconciled
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Step 1: Backfill orphaned pos_sync_aggregates ──
-- Insert ke aggregated_transactions untuk pos_sync yang belum ada
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
  now()
FROM pos_sync_aggregates p
WHERE p.status IN ('READY', 'JOURNALED', 'RECALCULATED')
  AND NOT EXISTS (
    SELECT 1 FROM aggregated_transactions at
    WHERE at.pos_sync_aggregate_id = p.id
      AND at.deleted_at IS NULL
  )
ON CONFLICT (source_type, source_id, source_ref) DO NOTHING;

-- ── Step 2: Supersede POS records yang punya POS_SYNC twin ──
-- Match by branch_name (bukan branch_id) karena banyak POS punya branch_id = NULL
WITH pos_sync_entries AS (
  SELECT id, transaction_date, payment_method_id, branch_name
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
  AND manual_at.branch_name = pse.branch_name
  AND manual_at.is_reconciled = false
  AND manual_at.deleted_at IS NULL
  AND manual_at.superseded_by IS NULL;

-- ── Step 3: Migrate reconciliation links dari POS → POS_SYNC ──
-- Jika POS sudah reconciled (punya bank_statement link), pindahkan ke POS_SYNC
WITH reconciled_pos AS (
  SELECT
    pos.id AS pos_id,
    sync.id AS sync_id,
    pos.is_reconciled,
    pos.actual_fee_amount,
    pos.fee_discrepancy,
    pos.fee_discrepancy_note
  FROM aggregated_transactions pos
  JOIN aggregated_transactions sync
    ON sync.source_type = 'POS_SYNC'
    AND sync.transaction_date = pos.transaction_date
    AND sync.payment_method_id = pos.payment_method_id
    AND sync.branch_name = pos.branch_name
    AND sync.deleted_at IS NULL
    AND sync.superseded_by IS NULL
  WHERE pos.source_type = 'POS'
    AND pos.is_reconciled = true
    AND pos.deleted_at IS NULL
),
-- Update POS_SYNC record: copy reconciliation state
update_sync AS (
  UPDATE aggregated_transactions
  SET
    is_reconciled = rp.is_reconciled,
    actual_fee_amount = rp.actual_fee_amount,
    fee_discrepancy = rp.fee_discrepancy,
    fee_discrepancy_note = rp.fee_discrepancy_note,
    updated_at = now()
  FROM reconciled_pos rp
  WHERE aggregated_transactions.id = rp.sync_id
  RETURNING aggregated_transactions.id AS sync_id, rp.pos_id
),
-- Update bank_statements: point to POS_SYNC instead of POS
update_bs AS (
  UPDATE bank_statements
  SET
    reconciliation_id = us.sync_id,
    updated_at = now()
  FROM update_sync us
  WHERE bank_statements.reconciliation_id = us.pos_id
  RETURNING bank_statements.id
)
-- Supersede the reconciled POS record
UPDATE aggregated_transactions pos
SET
  superseded_by = rp.sync_id,
  status = 'SUPERSEDED',
  is_reconciled = false,
  updated_at = now()
FROM reconciled_pos rp
WHERE pos.id = rp.pos_id;

-- ── Verification ──
SELECT
  'BACKFILL' AS step,
  count(*) AS total
FROM aggregated_transactions
WHERE source_type = 'POS_SYNC'
  AND deleted_at IS NULL
  AND superseded_by IS NULL;

SELECT
  'SUPERSEDED' AS step,
  count(*) AS total
FROM aggregated_transactions
WHERE status = 'SUPERSEDED'
  AND deleted_at IS NULL;

SELECT
  'REMAINING_ORPHANS' AS step,
  count(*) AS total
FROM pos_sync_aggregates psa
LEFT JOIN aggregated_transactions at_sync
  ON at_sync.pos_sync_aggregate_id = psa.id
  AND at_sync.deleted_at IS NULL
WHERE psa.status IN ('READY', 'JOURNALED', 'RECALCULATED')
  AND at_sync.id IS NULL;

COMMIT;
