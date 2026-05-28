-- ============================================================
-- Migration: Replace expense_type with transaction_type (per line)
-- Add prepaid amortization tables
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add transaction_type + prepaid fields to general_invoice_lines
-- ------------------------------------------------------------
ALTER TABLE public.general_invoice_lines
  ADD COLUMN transaction_type varchar(10) NOT NULL DEFAULT 'EXPENSE',
  ADD COLUMN expense_account_id uuid,
  ADD COLUMN total_periods integer,
  ADD COLUMN amortization_start_date date;

ALTER TABLE public.general_invoice_lines
  ADD CONSTRAINT gen_inv_lines_txn_type_check CHECK (
    transaction_type = ANY (ARRAY['EXPENSE', 'PREPAID'])
  ),
  ADD CONSTRAINT gen_inv_lines_expense_account_fkey FOREIGN KEY (expense_account_id)
    REFERENCES public.chart_of_accounts (id);

-- Validate: PREPAID lines must have expense_account_id, total_periods, start_date
-- (enforced in application layer, not DB constraint — allows DRAFT without full data)

-- ------------------------------------------------------------
-- 2. Add transaction_type to template lines
-- ------------------------------------------------------------
ALTER TABLE public.general_invoice_template_lines
  ADD COLUMN transaction_type varchar(10) NOT NULL DEFAULT 'EXPENSE',
  ADD COLUMN expense_account_id uuid,
  ADD COLUMN total_periods integer,
  ADD COLUMN amortization_start_offset_days integer;

ALTER TABLE public.general_invoice_template_lines
  ADD CONSTRAINT gen_tmpl_lines_txn_type_check CHECK (
    transaction_type = ANY (ARRAY['EXPENSE', 'PREPAID'])
  ),
  ADD CONSTRAINT gen_tmpl_lines_expense_account_fkey FOREIGN KEY (expense_account_id)
    REFERENCES public.chart_of_accounts (id);

-- ------------------------------------------------------------
-- 3. Drop expense_type from general_invoices
-- ------------------------------------------------------------
ALTER TABLE public.general_invoices
  DROP CONSTRAINT IF EXISTS general_invoices_expense_type_check;

ALTER TABLE public.general_invoices
  DROP COLUMN expense_type;

-- ------------------------------------------------------------
-- 4. Drop expense_type from general_invoice_templates
-- ------------------------------------------------------------
ALTER TABLE public.general_invoice_templates
  DROP CONSTRAINT IF EXISTS gen_inv_templates_expense_type_check;

ALTER TABLE public.general_invoice_templates
  DROP COLUMN expense_type;

-- ------------------------------------------------------------
-- 5. Create amortization schedule table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.general_invoice_amortizations (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL,
  branch_id           uuid NOT NULL,
  invoice_id          uuid NOT NULL,
  invoice_line_id     uuid NOT NULL,

  -- Schedule
  total_amount        numeric(20,4) NOT NULL,
  total_periods       integer NOT NULL,
  amount_per_period   numeric(20,4) NOT NULL,
  start_date          date NOT NULL,
  end_date            date NOT NULL,

  -- COA mapping
  prepaid_account_id  uuid NOT NULL,   -- 1xxx (debit saat POST invoice)
  expense_account_id  uuid NOT NULL,   -- 6xxx (debit saat amortisasi)

  -- Tracking
  periods_executed    integer NOT NULL DEFAULT 0,
  last_executed_at    date,
  status              varchar(20) NOT NULL DEFAULT 'ACTIVE',

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,

  CONSTRAINT gen_inv_amort_pkey PRIMARY KEY (id),
  CONSTRAINT gen_inv_amort_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) ON DELETE CASCADE,
  CONSTRAINT gen_inv_amort_branch_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id),
  CONSTRAINT gen_inv_amort_invoice_fkey FOREIGN KEY (invoice_id)
    REFERENCES public.general_invoices (id),
  CONSTRAINT gen_inv_amort_line_fkey FOREIGN KEY (invoice_line_id)
    REFERENCES public.general_invoice_lines (id),
  CONSTRAINT gen_inv_amort_prepaid_fkey FOREIGN KEY (prepaid_account_id)
    REFERENCES public.chart_of_accounts (id),
  CONSTRAINT gen_inv_amort_expense_fkey FOREIGN KEY (expense_account_id)
    REFERENCES public.chart_of_accounts (id),
  CONSTRAINT gen_inv_amort_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id),
  CONSTRAINT gen_inv_amort_status_check CHECK (
    status = ANY (ARRAY['ACTIVE', 'COMPLETED', 'CANCELLED'])
  ),
  CONSTRAINT gen_inv_amort_periods_check CHECK (total_periods > 0),
  CONSTRAINT gen_inv_amort_amount_check CHECK (total_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_gen_amort_company
  ON public.general_invoice_amortizations (company_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_gen_amort_invoice
  ON public.general_invoice_amortizations (invoice_id);
CREATE INDEX IF NOT EXISTS idx_gen_amort_line
  ON public.general_invoice_amortizations (invoice_line_id);
CREATE INDEX IF NOT EXISTS idx_gen_amort_status
  ON public.general_invoice_amortizations (status);

CREATE OR REPLACE TRIGGER general_invoice_amortizations_updated_at
  BEFORE UPDATE ON public.general_invoice_amortizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 6. Create amortization entries (per period execution)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.general_invoice_amortization_entries (
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  amortization_id   uuid NOT NULL,
  period_number     integer NOT NULL,
  period_date       date NOT NULL,
  amount            numeric(20,4) NOT NULL,
  journal_id        uuid,
  executed_at       timestamptz,
  executed_by       uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT gen_inv_amort_entries_pkey PRIMARY KEY (id),
  CONSTRAINT gen_inv_amort_entries_amort_fkey FOREIGN KEY (amortization_id)
    REFERENCES public.general_invoice_amortizations (id) ON DELETE CASCADE,
  CONSTRAINT gen_inv_amort_entries_journal_fkey FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id),
  CONSTRAINT gen_inv_amort_entries_executed_by_fkey FOREIGN KEY (executed_by)
    REFERENCES public.auth_users (id),
  CONSTRAINT gen_inv_amort_entries_unique UNIQUE (amortization_id, period_number)
);

CREATE INDEX IF NOT EXISTS idx_gen_amort_entries_amort
  ON public.general_invoice_amortization_entries (amortization_id);
CREATE INDEX IF NOT EXISTS idx_gen_amort_entries_pending
  ON public.general_invoice_amortization_entries (period_date)
  WHERE journal_id IS NULL;

-- ------------------------------------------------------------
-- 7. Drop expense COA defaults table (already unused)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.general_ap_expense_coa_defaults;
