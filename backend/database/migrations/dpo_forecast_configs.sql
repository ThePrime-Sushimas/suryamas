
-- ─── 2. DPO FORECAST CONFIGS (per cabang) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dpo_forecast_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid NOT NULL,             -- wajib per cabang
  weight_7d numeric(4,3) NOT NULL DEFAULT 0.600,
  weight_30d numeric(4,3) NOT NULL DEFAULT 0.300,
  weight_dow numeric(4,3) NOT NULL DEFAULT 0.100,
  coverage_days numeric(4,2) NOT NULL DEFAULT 1.50,
  holiday_factor numeric(4,3) NOT NULL DEFAULT 1.200,
  lookback_days_short int NOT NULL DEFAULT 7,
  lookback_days_long int NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT dpo_forecast_configs_pkey PRIMARY KEY (id),
  CONSTRAINT dpo_forecast_configs_unique UNIQUE (company_id, branch_id),
  CONSTRAINT dpo_forecast_configs_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies(id),
  CONSTRAINT dpo_forecast_configs_branch_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches(id),
  CONSTRAINT chk_weights CHECK (
    ABS((weight_7d + weight_30d + weight_dow) - 1.000) < 0.001
  ),
  CONSTRAINT chk_coverage CHECK (coverage_days > 0 AND coverage_days <= 7),
  CONSTRAINT chk_holiday_factor CHECK (holiday_factor >= 1.0 AND holiday_factor <= 3.0)
);