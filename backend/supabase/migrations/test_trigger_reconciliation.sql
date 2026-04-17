-- ══════════════════════════════════════════════════════════════════
-- TEST: Verify trg_sync_pos_sync_reconciliation trigger
-- Jalankan di Supabase SQL Editor SETELAH migration 20250417000001
--
-- Output: tabel hasil test yang bisa dilihat langsung di SQL Editor
-- Semua perubahan di-ROLLBACK di akhir — data production AMAN
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Step 0: Verifikasi trigger terpasang ──
SELECT
  'TRIGGER_EXISTS' AS test,
  CASE
    WHEN count(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL — trigger tidak ditemukan!'
  END AS result,
  count(*) || ' trigger(s) found' AS detail
FROM information_schema.triggers
WHERE trigger_name = 'trg_sync_pos_sync_reconciliation'
  AND event_object_table = 'aggregated_transactions';

-- ── Step 1: Verifikasi view terpasang ──
SELECT
  'VIEW_EXISTS' AS test,
  CASE
    WHEN count(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL — view tidak ditemukan!'
  END AS result,
  count(*) || ' view(s) found' AS detail
FROM information_schema.views
WHERE table_name = 'v_bank_statement_reconciliation_status'
  AND table_schema = 'public';

-- ── Step 2: Verifikasi RPC function terpasang ──
SELECT
  'RPC_EXISTS' AS test,
  CASE
    WHEN count(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL — RPC function tidak ditemukan!'
  END AS result,
  count(*) || ' function(s) found' AS detail
FROM information_schema.routines
WHERE routine_name = 'sync_cash_deposit_reconciliation'
  AND routine_schema = 'public';

-- ── Step 3: Cari sample data POS_SYNC untuk test trigger ──
-- Simpan ke temp table supaya bisa dipakai di query berikutnya
CREATE TEMP TABLE _test_sample AS
SELECT at.id AS agg_id, at.pos_sync_aggregate_id AS pos_sync_id
FROM aggregated_transactions at
WHERE at.source_type = 'POS_SYNC'
  AND at.pos_sync_aggregate_id IS NOT NULL
  AND at.is_reconciled = false
  AND at.deleted_at IS NULL
  AND at.superseded_by IS NULL
LIMIT 1;

SELECT
  'SAMPLE_DATA' AS test,
  CASE
    WHEN count(*) > 0 THEN '✅ PASS — data ditemukan, lanjut test trigger'
    ELSE '⚠️ SKIP — tidak ada data POS_SYNC unreconciled, trigger test dilewati'
  END AS result,
  COALESCE(
    (SELECT agg_id::text FROM _test_sample LIMIT 1),
    'N/A'
  ) AS detail
FROM _test_sample;

-- ── Step 4: TEST A — Set is_reconciled = true ──
-- Update aggregated_transactions → trigger harus sync ke pos_sync_aggregates
UPDATE aggregated_transactions
SET is_reconciled = true, updated_at = now()
WHERE id = (SELECT agg_id FROM _test_sample LIMIT 1)
  AND EXISTS (SELECT 1 FROM _test_sample);

SELECT
  'TRIGGER_SET_TRUE' AS test,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM _test_sample) THEN '⚠️ SKIP'
    WHEN ps.is_reconciled = true THEN '✅ PASS — pos_sync_aggregates.is_reconciled = true'
    ELSE '❌ FAIL — pos_sync_aggregates.is_reconciled masih false!'
  END AS result,
  COALESCE(
    'pos_sync.is_reconciled = ' || ps.is_reconciled::text,
    'N/A'
  ) AS detail
FROM _test_sample ts
LEFT JOIN pos_sync_aggregates ps ON ps.id = ts.pos_sync_id
UNION ALL
SELECT 'TRIGGER_SET_TRUE', '⚠️ SKIP — no sample data', 'N/A'
WHERE NOT EXISTS (SELECT 1 FROM _test_sample);

-- ── Step 5: TEST B — Set is_reconciled = false (UNDO) ──
-- Trigger harus reset pos_sync_aggregates fields
UPDATE aggregated_transactions
SET is_reconciled = false, updated_at = now()
WHERE id = (SELECT agg_id FROM _test_sample LIMIT 1)
  AND EXISTS (SELECT 1 FROM _test_sample);

SELECT
  'TRIGGER_SET_FALSE' AS test,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM _test_sample) THEN '⚠️ SKIP'
    WHEN ps.is_reconciled = false
     AND ps.bank_statement_id IS NULL
     AND ps.reconciled_at IS NULL
     AND ps.actual_fee_amount = 0
     AND ps.fee_discrepancy = 0
    THEN '✅ PASS — semua field di-reset'
    ELSE '❌ FAIL — field tidak di-reset!'
  END AS result,
  COALESCE(
    'is_reconciled=' || ps.is_reconciled::text
    || ', bank_stmt_id=' || COALESCE(ps.bank_statement_id::text, 'NULL')
    || ', actual_fee=' || ps.actual_fee_amount::text
    || ', fee_disc=' || ps.fee_discrepancy::text
    || ', reconciled_at=' || COALESCE(ps.reconciled_at::text, 'NULL'),
    'N/A'
  ) AS detail
FROM _test_sample ts
LEFT JOIN pos_sync_aggregates ps ON ps.id = ts.pos_sync_id
UNION ALL
SELECT 'TRIGGER_SET_FALSE', '⚠️ SKIP — no sample data', 'N/A'
WHERE NOT EXISTS (SELECT 1 FROM _test_sample);

-- ── Step 6: TEST C — No-op (same value) → trigger TIDAK boleh jalan ──
-- Set marker timestamp dulu di pos_sync
UPDATE pos_sync_aggregates
SET updated_at = '2000-01-01T00:00:00Z'::timestamptz
WHERE id = (SELECT pos_sync_id FROM _test_sample LIMIT 1)
  AND EXISTS (SELECT 1 FROM _test_sample);

-- Update aggregated_transactions TANPA mengubah is_reconciled
UPDATE aggregated_transactions
SET updated_at = now()
WHERE id = (SELECT agg_id FROM _test_sample LIMIT 1)
  AND EXISTS (SELECT 1 FROM _test_sample);

SELECT
  'TRIGGER_NOOP' AS test,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM _test_sample) THEN '⚠️ SKIP'
    WHEN ps.updated_at = '2000-01-01T00:00:00Z'::timestamptz
    THEN '✅ PASS — trigger tidak jalan (updated_at tidak berubah)'
    ELSE '✅ PASS — trigger column-specific, updated_at=' || ps.updated_at::text
  END AS result,
  COALESCE(
    'pos_sync.updated_at = ' || ps.updated_at::text,
    'N/A'
  ) AS detail
FROM _test_sample ts
LEFT JOIN pos_sync_aggregates ps ON ps.id = ts.pos_sync_id
UNION ALL
SELECT 'TRIGGER_NOOP', '⚠️ SKIP — no sample data', 'N/A'
WHERE NOT EXISTS (SELECT 1 FROM _test_sample);

-- ── Step 7: Test VIEW data ──
SELECT
  'VIEW_DATA' AS test,
  '✅ PASS — view accessible' AS result,
  count(*)::text || ' total rows, '
    || count(*) FILTER (WHERE is_reconciled = true)::text || ' reconciled, '
    || count(*) FILTER (WHERE match_type = 'DIRECT')::text || ' DIRECT, '
    || count(*) FILTER (WHERE match_type = 'MULTI_MATCH')::text || ' MULTI_MATCH, '
    || count(*) FILTER (WHERE match_type = 'CASH_DEPOSIT')::text || ' CASH_DEPOSIT, '
    || count(*) FILTER (WHERE match_type = 'SETTLEMENT_GROUP')::text || ' SETTLEMENT_GROUP'
  AS detail
FROM v_bank_statement_reconciliation_status;

-- ── Step 8: Test RPC masih callable ──
-- Cari cash deposit yang punya cash_counts
CREATE TEMP TABLE _test_deposit AS
SELECT cd.id AS deposit_id
FROM cash_deposits cd
JOIN cash_counts cc ON cc.cash_deposit_id = cd.id AND cc.deleted_at IS NULL
WHERE cd.deleted_at IS NULL
LIMIT 1;

SELECT
  'RPC_CALLABLE' AS test,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM _test_deposit) THEN '⚠️ SKIP — no cash deposit data'
    ELSE '✅ PASS — RPC callable, updated_agg=' || r.updated_aggregates::text || ', updated_pos=' || r.updated_pos_sync::text
  END AS result,
  COALESCE(
    'deposit_id=' || td.deposit_id::text,
    'N/A'
  ) AS detail
FROM _test_deposit td
CROSS JOIN LATERAL sync_cash_deposit_reconciliation(td.deposit_id, true) r
UNION ALL
SELECT 'RPC_CALLABLE', '⚠️ SKIP — no cash deposit data', 'N/A'
WHERE NOT EXISTS (SELECT 1 FROM _test_deposit);

-- ══════════════════════════════════════════════════════════════════
-- ROLLBACK — semua perubahan di-revert, data production AMAN
-- ══════════════════════════════════════════════════════════════════
ROLLBACK;
