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