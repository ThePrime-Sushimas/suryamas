-- ══════════════════════════════════════════════════════════════════
-- PHASE 1: DB TRIGGER — auto-sync pos_sync_aggregates.is_reconciled
-- setiap kali aggregated_transactions.is_reconciled berubah
--
-- Ini menggantikan semua manual cascade yang tersebar di 6 tempat:
--   - orchestrator.updateReconciliationStatus()
--   - orchestrator.bulkUpdateReconciliationStatus()
--   - bankReconciliationRepository.undoReconciliation()
--   - bankReconciliationRepository.undoReconciliationGroup()
--   - settlementGroupRepository.cascadeReconciliationToPosSyncAggregates()
--   - RPC sync_cash_deposit_reconciliation (partial)
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_pos_sync_reconciliation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hanya jalankan jika is_reconciled benar-benar berubah
  IF OLD.is_reconciled IS NOT DISTINCT FROM NEW.is_reconciled THEN
    RETURN NEW;
  END IF;

  -- Hanya untuk source_type = POS_SYNC dan punya link ke pos_sync_aggregates
  IF NEW.source_type = 'POS_SYNC' AND NEW.pos_sync_aggregate_id IS NOT NULL THEN
    UPDATE pos_sync_aggregates
    SET
      is_reconciled        = NEW.is_reconciled,
      -- Saat UNDO (false): reset kolom reconciliation-specific milik pos_sync
      bank_statement_id    = CASE WHEN NEW.is_reconciled = false THEN NULL    ELSE bank_statement_id    END,
      reconciled_at        = CASE WHEN NEW.is_reconciled = false THEN NULL    ELSE reconciled_at        END,
      reconciled_by        = CASE WHEN NEW.is_reconciled = false THEN NULL    ELSE reconciled_by        END,
      actual_fee_amount    = CASE WHEN NEW.is_reconciled = false THEN 0       ELSE actual_fee_amount    END,
      fee_discrepancy      = CASE WHEN NEW.is_reconciled = false THEN 0       ELSE fee_discrepancy      END,
      fee_discrepancy_note = CASE WHEN NEW.is_reconciled = false THEN NULL    ELSE fee_discrepancy_note END,
      updated_at           = now()
    WHERE id = NEW.pos_sync_aggregate_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Pasang trigger pada aggregated_transactions
DROP TRIGGER IF EXISTS trg_sync_pos_sync_reconciliation ON public.aggregated_transactions;
CREATE TRIGGER trg_sync_pos_sync_reconciliation
  AFTER UPDATE OF is_reconciled ON public.aggregated_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pos_sync_reconciliation();

-- ══════════════════════════════════════════════════════════════════
-- PHASE 2: VIEW — bank_statements is_reconciled derived dari FK
-- Gunakan view ini untuk READ. Kolom is_reconciled di bank_statements
-- tetap ada untuk backward compat, tapi JANGAN write langsung ke sana.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_bank_statement_reconciliation_status AS
SELECT
  bs.id,
  bs.transaction_date,
  bs.bank_account_id,
  bs.company_id,
  -- Derived: true jika punya salah satu FK reconciliation
  CASE
    WHEN bs.reconciliation_id IS NOT NULL        THEN true  -- 1:1 match
    WHEN bs.reconciliation_group_id IS NOT NULL  THEN true  -- multi-match
    WHEN bs.cash_deposit_id IS NOT NULL          THEN true  -- cash deposit match
    WHEN bsg.id IS NOT NULL                      THEN true  -- settlement group
    ELSE false
  END AS is_reconciled,
  -- Jenis match (berguna untuk UI)
  CASE
    WHEN bs.reconciliation_id IS NOT NULL        THEN 'DIRECT'
    WHEN bs.reconciliation_group_id IS NOT NULL  THEN 'MULTI_MATCH'
    WHEN bs.cash_deposit_id IS NOT NULL          THEN 'CASH_DEPOSIT'
    WHEN bsg.id IS NOT NULL                      THEN 'SETTLEMENT_GROUP'
    ELSE 'NONE'
  END AS match_type,
  bs.reconciliation_id,
  bs.reconciliation_group_id,
  bs.cash_deposit_id,
  bsg.id AS settlement_group_id
FROM bank_statements bs
LEFT JOIN bank_settlement_groups bsg
  ON bsg.bank_statement_id = bs.id
  AND bsg.deleted_at IS NULL
WHERE bs.deleted_at IS NULL;

-- ══════════════════════════════════════════════════════════════════
-- PHASE 3: Update RPC sync_cash_deposit_reconciliation
-- Hapus sync ke pos_sync_aggregates — sudah ditangani trigger.
-- Lebih simpel, lebih cepat.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_cash_deposit_reconciliation(
  p_deposit_id uuid,
  p_is_reconciled boolean
)
RETURNS TABLE(updated_aggregates int, updated_pos_sync int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cc AS (
    SELECT start_date, end_date, branch_name, payment_method_id
    FROM cash_counts
    WHERE cash_deposit_id = p_deposit_id
      AND deleted_at IS NULL
  ),
  matched AS (
    SELECT DISTINCT at.id
    FROM aggregated_transactions at
    JOIN cc
      ON at.payment_method_id = cc.payment_method_id
     AND at.transaction_date >= cc.start_date
     AND at.transaction_date <= cc.end_date
     AND (cc.branch_name IS NULL OR at.branch_name = cc.branch_name)
    WHERE at.deleted_at IS NULL
      AND at.superseded_by IS NULL
  ),
  updated_agg AS (
    UPDATE aggregated_transactions
    SET
      is_reconciled = p_is_reconciled,
      updated_at    = now()
    WHERE id IN (SELECT id FROM matched)
    RETURNING id, pos_sync_aggregate_id
  )
  -- pos_sync_aggregates sekarang dihandle otomatis oleh trigger
  -- trg_sync_pos_sync_reconciliation.
  -- Kita tetap return count-nya untuk backward compat response shape.
  SELECT
    (SELECT count(*)::int FROM updated_agg),
    (SELECT count(*)::int FROM updated_agg WHERE pos_sync_aggregate_id IS NOT NULL);
END;
$$;

-- Index tambahan untuk performa trigger
CREATE INDEX IF NOT EXISTS idx_pos_sync_aggregates_id_reconciled
  ON public.pos_sync_aggregates (id)
  WHERE is_reconciled = false;
