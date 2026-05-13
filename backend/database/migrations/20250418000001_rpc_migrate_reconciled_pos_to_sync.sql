-- ══════════════════════════════════════════════════════════════════
-- RPC: Migrate reconciliation dari POS (reconciled) → POS_SYNC
-- Dipanggil otomatis saat syncPosSyncToAggregated detect POS twin
-- yang sudah reconciled.
--
-- Handles:
--   - Direct bank statement link (reconciliation_id)
--   - Multi-match group link (bank_reconciliation_groups)
--   - Settlement group link (bank_settlement_aggregates)
--   - Cash deposit guard (skip migrate, cukup supersede)
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.migrate_reconciled_pos_to_sync(
  p_pos_id uuid,
  p_sync_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos record;
  v_covered_by_cash_deposit boolean;
BEGIN
  SELECT id, is_reconciled, actual_fee_amount, fee_discrepancy, fee_discrepancy_note,
         payment_method_id, transaction_date, branch_name
  INTO v_pos
  FROM aggregated_transactions
  WHERE id = p_pos_id
    AND source_type = 'POS'
    AND is_reconciled = true
    AND superseded_by IS NULL
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Guard: skip migrate kalau POS ini di-cover cash deposit
  -- (reconciliation via cash_counts, bukan bank statement)
  -- POS_SYNC akan di-cover otomatis oleh sync_cash_deposit_reconciliation
  SELECT EXISTS (
    SELECT 1
    FROM cash_counts cc
    JOIN cash_deposits cd ON cd.id = cc.cash_deposit_id
    WHERE cc.payment_method_id = v_pos.payment_method_id
      AND cc.start_date <= v_pos.transaction_date
      AND cc.end_date >= v_pos.transaction_date
      AND cc.branch_name = v_pos.branch_name
      AND cc.deleted_at IS NULL
      AND cd.status = 'RECONCILED'
  ) INTO v_covered_by_cash_deposit;

  IF v_covered_by_cash_deposit THEN
    -- Cukup supersede POS, jangan migrate reconciliation state
    UPDATE aggregated_transactions
    SET
      superseded_by = p_sync_id,
      status        = 'SUPERSEDED',
      is_reconciled = false,
      updated_at    = now()
    WHERE id = p_pos_id;

    RETURN true;
  END IF;

  -- 1. Copy reconciliation state ke POS_SYNC
  --    Trigger trg_sync_pos_sync_reconciliation otomatis sync ke pos_sync_aggregates
  UPDATE aggregated_transactions
  SET
    is_reconciled        = true,
    actual_fee_amount    = v_pos.actual_fee_amount,
    fee_discrepancy      = v_pos.fee_discrepancy,
    fee_discrepancy_note = v_pos.fee_discrepancy_note,
    updated_at           = now()
  WHERE id = p_sync_id;

  -- 2a. Migrate direct bank statement link (1:1 match)
  UPDATE bank_statements
  SET reconciliation_id = p_sync_id, updated_at = now()
  WHERE reconciliation_id = p_pos_id AND deleted_at IS NULL;

  -- 2b. Migrate multi-match group link
  UPDATE bank_reconciliation_groups
  SET aggregate_id = p_sync_id, updated_at = now()
  WHERE aggregate_id = p_pos_id AND deleted_at IS NULL;

  -- 2c. Migrate settlement group link
  UPDATE bank_settlement_aggregates
  SET aggregate_id = p_sync_id, updated_at = now()
  WHERE aggregate_id = p_pos_id;

  -- 3. Supersede POS record
  --    Trigger tidak firing efek karena source_type = 'POS'
  UPDATE aggregated_transactions
  SET
    superseded_by = p_sync_id,
    status        = 'SUPERSEDED',
    is_reconciled = false,
    updated_at    = now()
  WHERE id = p_pos_id;

  RETURN true;
END;
$$;
