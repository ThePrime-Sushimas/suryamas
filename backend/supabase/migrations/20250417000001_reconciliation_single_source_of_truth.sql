-- Reconciliation single source of truth
-- This migration defines a trigger-based sync so application code doesn't need to
-- manually cascade reconciliation flags to POS sync aggregates.

CREATE OR REPLACE FUNCTION public.sync_pos_sync_reconciliation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only fire when is_reconciled actually changes
  IF OLD.is_reconciled IS NOT DISTINCT FROM NEW.is_reconciled THEN
    RETURN NEW;
  END IF;

  -- Only apply to POS_SYNC rows that are linked to a POS sync aggregate.
  IF NEW.source_type = 'POS_SYNC' AND NEW.pos_sync_aggregate_id IS NOT NULL THEN
    -- Keep aggregated_transactions as the single source of truth.
    UPDATE public.pos_sync_aggregates
    SET
      is_reconciled        = NEW.is_reconciled,
      bank_statement_id    = CASE WHEN NEW.is_reconciled = false THEN NULL ELSE bank_statement_id END,
      updated_at           = NOW()
    WHERE id = NEW.pos_sync_aggregate_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pos_sync_reconciliation ON public.aggregated_transactions;

CREATE TRIGGER trg_sync_pos_sync_reconciliation
AFTER UPDATE OF is_reconciled ON public.aggregated_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_pos_sync_reconciliation();

-- Convenience view for UI reporting.
CREATE OR REPLACE VIEW public.v_bank_statement_reconciliation_status AS
SELECT
  bs.id,
  CASE
    WHEN bs.reconciliation_id IS NULL THEN 'DIRECT'
    ELSE 'MULTI_MATCH'
  END AS reconciliation_mode,
  'CASH_DEPOSIT'::text AS CASH_DEPOSIT,
  'SETTLEMENT_GROUP'::text AS SETTLEMENT_GROUP
FROM public.bank_statements bs;

-- Updated RPC: should update aggregated_transactions only (trigger handles the rest).
CREATE OR REPLACE FUNCTION public.sync_cash_deposit_reconciliation()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE aggregated_transactions SET is_reconciled = true WHERE false;
END;
$$;

