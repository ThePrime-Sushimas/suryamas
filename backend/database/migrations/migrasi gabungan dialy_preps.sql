-- ─── 1. PUBLIC HOLIDAYS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  holiday_date date NOT NULL,
  holiday_name varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT public_holidays_pkey PRIMARY KEY (id),
  CONSTRAINT public_holidays_unique UNIQUE (company_id, holiday_date),
  CONSTRAINT public_holidays_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies(id)
);

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

-- ─── 3. DAILY PREP ORDERS (header) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_prep_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  dpo_number varchar(50) NOT NULL,
  prep_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  source_warehouse_id uuid NOT NULL,   -- MAIN
  target_warehouse_id uuid NOT NULL,   -- READY
  -- Snapshot config saat generate (audit trail)
  weight_7d numeric(4,3) NOT NULL,
  weight_30d numeric(4,3) NOT NULL,
  weight_dow numeric(4,3) NOT NULL,
  coverage_days numeric(4,2) NOT NULL,
  holiday_factor_applied numeric(4,3) NOT NULL DEFAULT 1.000,
  has_upcoming_holiday boolean NOT NULL DEFAULT false,
  -- Confirm
  confirmed_at timestamptz,
  confirmed_by uuid,
  -- Cancel
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  -- Optimistic lock
  lock_token uuid,
  locked_at timestamptz,
  locked_by uuid,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT daily_prep_orders_pkey PRIMARY KEY (id),
  CONSTRAINT daily_prep_orders_number_key UNIQUE (company_id, dpo_number),
  CONSTRAINT daily_prep_orders_branch_date_key UNIQUE (branch_id, prep_date)
    DEFERRABLE INITIALLY DEFERRED,     -- allow replace draft for same date
  CONSTRAINT daily_prep_orders_status_check
    CHECK (status IN ('DRAFT','CONFIRMED','CANCELLED')),
  CONSTRAINT daily_prep_orders_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies(id),
  CONSTRAINT daily_prep_orders_branch_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches(id),
  CONSTRAINT daily_prep_orders_source_wh_fkey FOREIGN KEY (source_warehouse_id)
    REFERENCES public.warehouses(id),
  CONSTRAINT daily_prep_orders_target_wh_fkey FOREIGN KEY (target_warehouse_id)
    REFERENCES public.warehouses(id)
);

CREATE INDEX idx_dpo_branch_date ON public.daily_prep_orders(branch_id, prep_date)
  WHERE is_deleted = false;
CREATE INDEX idx_dpo_status ON public.daily_prep_orders(status)
  WHERE is_deleted = false;
CREATE INDEX idx_dpo_company ON public.daily_prep_orders(company_id)
  WHERE is_deleted = false;

-- ─── 4. DAILY PREP ORDER LINES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_prep_order_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dpo_id uuid NOT NULL,
  product_id uuid NOT NULL,
  -- Snapshot kalkulasi (audit trail lengkap)
  avg_sales_7d numeric(20,4) NOT NULL DEFAULT 0,
  avg_sales_30d numeric(20,4) NOT NULL DEFAULT 0,
  avg_sales_dow numeric(20,4) NOT NULL DEFAULT 0,
  holiday_factor numeric(6,4) NOT NULL DEFAULT 1.0000,
  coverage_days numeric(6,4) NOT NULL DEFAULT 1.5000,
  predicted_need numeric(20,4) NOT NULL DEFAULT 0,
  current_ready_stock numeric(20,4) NOT NULL DEFAULT 0,
  current_main_stock numeric(20,4) NOT NULL DEFAULT 0,
  suggested_qty numeric(20,4) NOT NULL DEFAULT 0,
  -- Qty final (bisa diedit admin sebelum confirm)
  confirmed_qty numeric(20,4),
  uom varchar(30) NOT NULL,
  -- Stock movement reference (diisi setelah confirm)
  out_movement_id uuid,
  in_movement_id uuid,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_prep_order_lines_pkey PRIMARY KEY (id),
  CONSTRAINT dpo_lines_dpo_fkey FOREIGN KEY (dpo_id)
    REFERENCES public.daily_prep_orders(id) ON DELETE CASCADE,
  CONSTRAINT dpo_lines_product_fkey FOREIGN KEY (product_id)
    REFERENCES public.products(id),
  CONSTRAINT dpo_lines_out_movement_fkey FOREIGN KEY (out_movement_id)
    REFERENCES public.stock_movements(id),
  CONSTRAINT dpo_lines_in_movement_fkey FOREIGN KEY (in_movement_id)
    REFERENCES public.stock_movements(id)
);

CREATE INDEX idx_dpo_lines_dpo ON public.daily_prep_order_lines(dpo_id);
CREATE INDEX idx_dpo_lines_product ON public.daily_prep_order_lines(product_id);

-- ─── 5. TRIGGERS updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_dpo_forecast_configs_updated_at
  BEFORE UPDATE ON public.dpo_forecast_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_daily_prep_orders_updated_at
  BEFORE UPDATE ON public.daily_prep_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_daily_prep_order_lines_updated_at
  BEFORE UPDATE ON public.daily_prep_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();