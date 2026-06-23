-- ============================================================
-- Migration: Amortization scheduler fixes (review round 2)
-- 1. Add updated_at column
-- 2. Add has_data_anomaly column
-- 3. Replace UNIQUE(run_month) with partial unique index
--    (allows multiple rows per month as long as only one is non-FAILED)
-- ============================================================

-- 1. Add updated_at
ALTER TABLE public.amortization_scheduler_runs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Add has_data_anomaly
ALTER TABLE public.amortization_scheduler_runs
  ADD COLUMN IF NOT EXISTS has_data_anomaly boolean NOT NULL DEFAULT false;

-- 3. Drop the simple UNIQUE constraint on run_month
ALTER TABLE public.amortization_scheduler_runs
  DROP CONSTRAINT IF EXISTS amort_sched_runs_month_unique;

-- 4. Create partial unique index: only one non-FAILED row per month
--    When a stale RUNNING row is recovered (set to FAILED), it exits this
--    index predicate, allowing a new RUNNING/SUCCESS/PARTIAL row to be inserted.
CREATE UNIQUE INDEX IF NOT EXISTS idx_amort_sched_runs_month_active
  ON public.amortization_scheduler_runs (run_month)
  WHERE status IN ('SUCCESS', 'PARTIAL', 'RUNNING');
