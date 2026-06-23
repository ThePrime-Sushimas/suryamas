-- ============================================================
-- Migration: Amortization auto-execute scheduler infrastructure
-- 1. Create run-tracking table
-- 2. Insert system user for automated journal creation
-- ============================================================

-- ------------------------------------------------------------
-- 1. Run-tracking table for scheduler idempotency & catch-up
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.amortization_scheduler_runs (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  run_month       varchar(7) NOT NULL,  -- format: YYYY-MM
  status          varchar(10) NOT NULL DEFAULT 'RUNNING',
  total_entries   integer NOT NULL DEFAULT 0,
  success_count   integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  trigger         varchar(12) NOT NULL,  -- SCHEDULED | CATCHUP
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  error_summary   jsonb,  -- array of { entry_id, amortization_id, period_number, error }

  CONSTRAINT amort_sched_runs_pkey PRIMARY KEY (id),
  CONSTRAINT amort_sched_runs_status_check CHECK (
    status = ANY (ARRAY['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'])
  ),
  CONSTRAINT amort_sched_runs_trigger_check CHECK (
    trigger = ANY (ARRAY['SCHEDULED', 'CATCHUP'])
  ),
  CONSTRAINT amort_sched_runs_month_unique UNIQUE (run_month)
);

CREATE INDEX IF NOT EXISTS idx_amort_sched_runs_month
  ON public.amortization_scheduler_runs (run_month);

-- ------------------------------------------------------------
-- 2. System user for automated amortization execution
-- Purpose: provides a valid user_id for journal created_by fields.
-- This user cannot login (password is a dummy bcrypt hash).
-- ------------------------------------------------------------
INSERT INTO public.auth_users (id, email, encrypted_password, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system-amortization@internal',
  '$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', -- non-matchable hash
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;
