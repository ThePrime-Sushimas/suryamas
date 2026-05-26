-- Default COA per expense_type for General AP (suggest line 1 on new invoice)
CREATE TABLE IF NOT EXISTS public.general_ap_expense_coa_defaults (
    id              uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id      uuid NOT NULL,
    expense_type    varchar(50) NOT NULL,
    account_id      uuid NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid,
    updated_by      uuid,
    CONSTRAINT general_ap_expense_coa_defaults_pkey PRIMARY KEY (id),
    CONSTRAINT general_ap_expense_coa_defaults_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE CASCADE,
    CONSTRAINT general_ap_expense_coa_defaults_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts (id),
    CONSTRAINT general_ap_expense_coa_defaults_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.auth_users (id) ON DELETE SET NULL,
    CONSTRAINT general_ap_expense_coa_defaults_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES public.auth_users (id) ON DELETE SET NULL,
    CONSTRAINT general_ap_expense_coa_defaults_company_type_key
        UNIQUE (company_id, expense_type),
    CONSTRAINT general_ap_expense_coa_defaults_expense_type_check CHECK (
        expense_type = ANY (
            ARRAY['UTILITY','RENT','SALARY_SUPPORT','SUBSCRIPTION','MAINTENANCE','OTHER']
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_gen_ap_exp_coa_company
    ON public.general_ap_expense_coa_defaults (company_id);

CREATE OR REPLACE TRIGGER general_ap_expense_coa_defaults_updated_at
    BEFORE UPDATE ON public.general_ap_expense_coa_defaults
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
