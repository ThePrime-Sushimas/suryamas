
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
