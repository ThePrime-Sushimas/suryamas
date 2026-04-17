-- ══════════════════════════════════════════════════════════════════
-- DIAGNOSTIC: Cari pos_sync_aggregates yang punya "twin" di
-- aggregated_transactions (source_type=POS) tapi tidak linked
--
-- Ini terjadi ketika:
--   1. POS Sync sudah buat pos_sync_aggregates
--   2. POS Import (CSV) buat aggregated_transactions terpisah
--   3. Keduanya untuk tanggal/branch/payment yang sama
--   4. Tidak ada link pos_sync_aggregate_id
-- ══════════════════════════════════════════════════════════════════

-- Query 1: Berapa banyak orphan?
SELECT
  'ORPHAN_COUNT' AS check_type,
  count(*) AS total,
  count(*) FILTER (WHERE psa.is_reconciled = false AND at_pos.is_reconciled = true) AS pos_reconciled_but_sync_not
FROM pos_sync_aggregates psa
JOIN aggregated_transactions at_pos
  ON at_pos.transaction_date = psa.sales_date
  AND at_pos.payment_method_id = psa.payment_method_id
  AND at_pos.branch_name = psa.branch_name
  AND at_pos.source_type = 'POS'
  AND at_pos.deleted_at IS NULL
  AND at_pos.superseded_by IS NULL
LEFT JOIN aggregated_transactions at_sync
  ON at_sync.pos_sync_aggregate_id = psa.id
  AND at_sync.deleted_at IS NULL
WHERE psa.status IN ('READY', 'JOURNALED', 'RECALCULATED')
  AND at_sync.id IS NULL;  -- tidak ada aggregated_transactions yang link ke pos_sync ini

-- Query 2: Detail per record (limit 20)
SELECT
  psa.id AS pos_sync_id,
  psa.sales_date,
  psa.branch_name,
  psa.payment_method_id,
  psa.nett_amount AS sync_nett,
  psa.is_reconciled AS sync_reconciled,
  at_pos.id AS agg_pos_id,
  at_pos.source_type,
  at_pos.nett_amount AS pos_nett,
  at_pos.is_reconciled AS pos_reconciled,
  at_pos.pos_sync_aggregate_id
FROM pos_sync_aggregates psa
JOIN aggregated_transactions at_pos
  ON at_pos.transaction_date = psa.sales_date
  AND at_pos.payment_method_id = psa.payment_method_id
  AND at_pos.branch_name = psa.branch_name
  AND at_pos.source_type = 'POS'
  AND at_pos.deleted_at IS NULL
  AND at_pos.superseded_by IS NULL
LEFT JOIN aggregated_transactions at_sync
  ON at_sync.pos_sync_aggregate_id = psa.id
  AND at_sync.deleted_at IS NULL
WHERE psa.status IN ('READY', 'JOURNALED', 'RECALCULATED')
  AND at_sync.id IS NULL
ORDER BY psa.sales_date DESC
LIMIT 20;

-- Query 3: Berapa pos_sync_aggregates yang SUDAH properly linked?
SELECT
  'LINKED_COUNT' AS check_type,
  count(*) AS total_linked,
  count(*) FILTER (WHERE psa.is_reconciled = at_sync.is_reconciled) AS in_sync,
  count(*) FILTER (WHERE psa.is_reconciled != at_sync.is_reconciled) AS out_of_sync
FROM pos_sync_aggregates psa
JOIN aggregated_transactions at_sync
  ON at_sync.pos_sync_aggregate_id = psa.id
  AND at_sync.deleted_at IS NULL
WHERE psa.status IN ('READY', 'JOURNALED', 'RECALCULATED');
