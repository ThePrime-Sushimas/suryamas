-- Product Stock Configs: per-branch reorder point & safety stock configuration

CREATE TABLE IF NOT EXISTS public.product_stock_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  warehouse_id uuid,
  reorder_point numeric(20,4),
  safety_stock numeric(20,4),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

ALTER TABLE public.product_stock_configs
  ADD CONSTRAINT product_stock_configs_pkey PRIMARY KEY (id);

ALTER TABLE public.product_stock_configs
  ADD CONSTRAINT product_stock_configs_unique UNIQUE (branch_id, product_id);

ALTER TABLE public.product_stock_configs
  ADD CONSTRAINT product_stock_configs_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);

ALTER TABLE public.product_stock_configs
  ADD CONSTRAINT product_stock_configs_branch_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);

ALTER TABLE public.product_stock_configs
  ADD CONSTRAINT product_stock_configs_product_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);

CREATE INDEX IF NOT EXISTS idx_psc_branch ON public.product_stock_configs(branch_id);
CREATE INDEX IF NOT EXISTS idx_psc_product ON public.product_stock_configs(product_id);
CREATE INDEX IF NOT EXISTS idx_psc_company ON public.product_stock_configs(company_id);
