-- ══════════════════════════════════════════════════════════════
-- Sync is_reconciled to aggregated_transactions + pos_sync_aggregates
-- when a cash deposit is reconciled or unreconciled.
-- Set-based, no loop, no duplicate, atomic.
-- ══════════════════════════════════════════════════════════════
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
    SELECT DISTINCT at.id, at.pos_sync_aggregate_id
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
    SET is_reconciled = p_is_reconciled,
        updated_at = now()
    WHERE id IN (SELECT id FROM matched)
    RETURNING id, pos_sync_aggregate_id
  ),

  updated_pos AS (
    UPDATE pos_sync_aggregates
    SET is_reconciled = p_is_reconciled,
        updated_at = now()
    WHERE id IN (
      SELECT DISTINCT pos_sync_aggregate_id
      FROM updated_agg
      WHERE pos_sync_aggregate_id IS NOT NULL
    )
    RETURNING id
  )

  SELECT
    (SELECT count(*)::int FROM updated_agg),
    (SELECT count(*)::int FROM updated_pos);
END;
$$;
