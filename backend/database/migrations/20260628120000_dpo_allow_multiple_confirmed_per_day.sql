-- Allow multiple CONFIRMED DPO per branch+prep_date (multiple pickups per day).
-- Previously: only one active DPO per branch+date — re-generate cancelled even CONFIRMED docs.
-- Now: unique constraint applies to DRAFT only; confirmed history stays visible.

DROP INDEX IF EXISTS idx_dpo_branch_date_active;

CREATE UNIQUE INDEX idx_dpo_branch_date_draft_active
  ON public.daily_prep_orders(branch_id, prep_date)
  WHERE is_deleted = false AND status = 'DRAFT';
