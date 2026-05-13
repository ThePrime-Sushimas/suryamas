-- ══════════════════════════════════════════════════════════════════
-- DRY RUN: Preview fix orphan pos_sync backfill
-- Jalankan ini DULU sebelum migration yang asli
-- ROLLBACK di akhir — data TIDAK berubah
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Preview Step 1: Berapa pos_sync yang akan di-backfill? ──
SELECT
  'WILL_BACKFILL' AS step,
  count(*) AS total
FROM pos_sync_aggregates p
WHERE p.status IN ('READY', 'JOURNALED', 'RECALCULATED')
  AND NOT EXISTS (
    SELECT 1 FROM aggregated_transactions at
    WHERE at.pos_sync_aggregate_id = p.id
      AND at.deleted_at IS NULL
  );

-- ── Preview Step 2: Berapa POS yang akan di-supersede (unreconciled)? ──
SELECT
  'WILL_SUPERSEDE_UNRECONCILED' AS step,
  count(*) AS total
FROM aggregated_transactions manual_at
JOIN aggregated_transactions pse
  ON pse.source_type = 'POS_SYNC'
  AND pse.transaction_date = manual_at.transaction_date
  AND pse.payment_method_id = manual_at.payment_method_id
  AND pse.branch_name = manual_at.branch_name
  AND pse.deleted_at IS NULL
  AND pse.superseded_by IS NULL
WHERE manual_at.source_type = 'POS'
  AND manual_at.is_reconciled = false
  AND manual_at.deleted_at IS NULL
  AND manual_at.superseded_by IS NULL;

-- ── Preview Step 3: Berapa POS reconciled yang perlu migrate link? ──
SELECT
  'WILL_MIGRATE_RECONCILED' AS step,
  count(*) AS total
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
  AND pos.deleted_at IS NULL;

-- ── Preview: Detail POS reconciled yang akan di-migrate ──
SELECT
  pos.id AS pos_id,
  pos.transaction_date,
  pos.branch_name,
  pos.payment_method_id,
  pos.nett_amount AS pos_nett,
  sync.id AS sync_id,
  sync.nett_amount AS sync_nett,
  bs.id AS bank_statement_id,
  bs.credit_amount - bs.debit_amount AS bank_amount
FROM aggregated_transactions pos
JOIN aggregated_transactions sync
  ON sync.source_type = 'POS_SYNC'
  AND sync.transaction_date = pos.transaction_date
  AND sync.payment_method_id = pos.payment_method_id
  AND sync.branch_name = pos.branch_name
  AND sync.deleted_at IS NULL
  AND sync.superseded_by IS NULL
LEFT JOIN bank_statements bs
  ON bs.reconciliation_id = pos.id
  AND bs.deleted_at IS NULL
WHERE pos.source_type = 'POS'
  AND pos.is_reconciled = true
  AND pos.deleted_at IS NULL
ORDER BY pos.transaction_date DESC
LIMIT 20;

-- ── Preview: nett_amount match check (POS vs POS_SYNC) ──
SELECT
  'NETT_AMOUNT_MISMATCH' AS step,
  count(*) AS total
FROM aggregated_transactions pos
JOIN aggregated_transactions sync
  ON sync.source_type = 'POS_SYNC'
  AND sync.transaction_date = pos.transaction_date
  AND sync.payment_method_id = pos.payment_method_id
  AND sync.branch_name = pos.branch_name
  AND sync.deleted_at IS NULL
  AND sync.superseded_by IS NULL
WHERE pos.source_type = 'POS'
  AND pos.deleted_at IS NULL
  AND pos.superseded_by IS NULL
  AND abs(pos.nett_amount - sync.nett_amount) > 0.01;

ROLLBACK;
