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
