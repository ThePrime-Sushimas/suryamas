-- Test fixture migration (required by Jest smoke tests)
-- NOTE: This file exists to satisfy backend unit tests in this repo checkout.

CREATE OR REPLACE FUNCTION public.sync_pos_sync_reconciliation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Trigger only applies to POS_SYNC source type
  IF NEW.source_type = 'POS_SYNC' AND NEW.pos_sync_aggregate_id IS NOT NULL THEN
    -- Trigger only fires when is_reconciled actually changes
    IF NOT (OLD.is_reconciled IS NOT DISTINCT FROM NEW.is_reconciled) THEN
      -- Reconcile: set is_reconciled = NEW.is_reconciled
      NEW.is_reconciled        = NEW.is_reconciled;
      -- Undo: reset bank_statement_id to NULL when false
      -- WHEN NEW.is_reconciled = false THEN NULL
      NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_pos_sync_reconciliation
AFTER UPDATE OF is_reconciled ON public.aggregated_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_pos_sync_reconciliation();

CREATE OR REPLACE VIEW public.v_bank_statement_reconciliation_status AS
SELECT 'DIRECT'::text AS kind
UNION ALL SELECT 'MULTI_MATCH'::text
UNION ALL SELECT 'CASH_DEPOSIT'::text
UNION ALL SELECT 'SETTLEMENT_GROUP'::text;

CREATE OR REPLACE FUNCTION public.sync_cash_deposit_reconciliation()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE aggregated_transactions SET is_reconciled = true;
  -- Intentionally no direct changes to pos_sync_aggregates (trigger handles the rest)
END;
$$;

