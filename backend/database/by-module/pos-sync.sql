-- ============================================
-- Module: pos-sync
-- Generated: 2026-06-09T16:36:06.339Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.aggregated_transactions
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    branch_name character varying(255) COLLATE pg_catalog."default",
    source_type character varying(30) COLLATE pg_catalog."default" NOT NULL DEFAULT 'POS'::character varying,
    source_id character varying(100) COLLATE pg_catalog."default" NOT NULL,
    source_ref character varying(100) COLLATE pg_catalog."default" NOT NULL,
    transaction_date date NOT NULL,
    payment_method_id integer,
    gross_amount numeric(18, 2) NOT NULL,
    discount_amount numeric(18, 2) NOT NULL DEFAULT 0,
    tax_amount numeric(18, 2) NOT NULL DEFAULT 0,
    service_charge_amount numeric(18, 2) NOT NULL DEFAULT 0,
    nett_amount numeric(18, 2) NOT NULL,
    currency character varying(10) COLLATE pg_catalog."default" NOT NULL DEFAULT 'IDR'::character varying,
    journal_id uuid,
    is_reconciled boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    version integer NOT NULL DEFAULT 1,
    status aggregated_transaction_status NOT NULL DEFAULT 'READY'::aggregated_transaction_status,
    deleted_by uuid,
    failed_at timestamp with time zone,
    failed_reason text COLLATE pg_catalog."default",
    percentage_fee_amount numeric(15, 2) NOT NULL DEFAULT 0,
    fixed_fee_amount numeric(15, 2) NOT NULL DEFAULT 0,
    total_fee_amount numeric(15, 2) NOT NULL DEFAULT 0,
    bill_after_discount numeric(15, 2) NOT NULL DEFAULT 0,
    branch_id uuid,
    expected_fee_amount numeric(15, 2) NOT NULL DEFAULT 0,
    actual_fee_amount numeric(15, 2) NOT NULL DEFAULT 0,
    fee_discrepancy numeric(15, 2) NOT NULL DEFAULT 0,
    fee_discrepancy_note text COLLATE pg_catalog."default",
    pos_sync_aggregate_id uuid,
    superseded_by uuid,
    actual_nett_amount numeric(15, 2) GENERATED ALWAYS AS ((nett_amount - fee_discrepancy)) STORED,
    rounding_amount numeric(18, 2) NOT NULL DEFAULT 0,
    delivery_cost numeric(18, 2) NOT NULL DEFAULT 0,
    order_fee numeric(18, 2) NOT NULL DEFAULT 0,
    voucher_discount_amount numeric(18, 2) NOT NULL DEFAULT 0,
    promotion_discount_amount numeric(18, 2) NOT NULL DEFAULT 0,
    menu_discount_amount numeric(18, 2) NOT NULL DEFAULT 0,
    voucher_payment_amount numeric(18, 2) NOT NULL DEFAULT 0,
    other_vat_amount numeric(18, 2) NOT NULL DEFAULT 0,
    pax_total integer NOT NULL DEFAULT 0,
    CONSTRAINT aggregated_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT uq_aggregated_source UNIQUE (source_type, source_id, source_ref)
);

CREATE INDEX IF NOT EXISTS uq_aggregated_pos_sync_source
    ON public.aggregated_transactions(pos_sync_aggregate_id);
CREATE INDEX IF NOT EXISTS idx_aggregated_superseded_by
    ON public.aggregated_transactions(superseded_by);
CREATE INDEX IF NOT EXISTS idx_aggregated_branch_id
    ON public.aggregated_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_aggregated_journal_id
    ON public.aggregated_transactions(journal_id);
CREATE INDEX IF NOT EXISTS idx_aggregated_payment_method
    ON public.aggregated_transactions(payment_method_id);

ALTER TABLE IF EXISTS public.aggregated_transactions
    ADD CONSTRAINT aggregated_transactions_pos_sync_aggregate_id_fkey FOREIGN KEY (pos_sync_aggregate_id)
    REFERENCES public.pos_sync_aggregates (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.aggregated_transactions
    ADD CONSTRAINT aggregated_transactions_superseded_by_fkey FOREIGN KEY (superseded_by)
    REFERENCES public.aggregated_transactions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.aggregated_transactions
    ADD CONSTRAINT fk_aggregated_branch FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE CASCADE
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.aggregated_transactions
    ADD CONSTRAINT fk_aggregated_journal FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.aggregated_transactions
    ADD CONSTRAINT fk_aggregated_payment_method FOREIGN KEY (payment_method_id)
    REFERENCES public.payment_methods (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.pos_sync_aggregates
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    sales_date date NOT NULL,
    branch_pos_id integer NOT NULL,
    branch_id uuid,
    branch_name text COLLATE pg_catalog."default",
    payment_pos_id integer NOT NULL,
    payment_method_id integer,
    gross_amount numeric NOT NULL DEFAULT 0,
    discount_amount numeric NOT NULL DEFAULT 0,
    tax_amount numeric NOT NULL DEFAULT 0,
    other_tax_amount numeric NOT NULL DEFAULT 0,
    grand_total numeric NOT NULL DEFAULT 0,
    payment_amount numeric NOT NULL DEFAULT 0,
    transaction_count integer NOT NULL DEFAULT 0,
    fee_percentage numeric NOT NULL DEFAULT 0,
    fee_fixed_amount numeric NOT NULL DEFAULT 0,
    percentage_fee_amount numeric NOT NULL DEFAULT 0,
    fixed_fee_amount_calc numeric NOT NULL DEFAULT 0,
    total_fee_amount numeric NOT NULL DEFAULT 0,
    nett_amount numeric NOT NULL DEFAULT 0,
    status text COLLATE pg_catalog."default" NOT NULL DEFAULT 'PENDING'::text,
    skip_reason text COLLATE pg_catalog."default",
    recalculated boolean NOT NULL DEFAULT false,
    recalculated_at timestamp with time zone,
    recalculated_count integer NOT NULL DEFAULT 0,
    synced_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    is_reconciled boolean NOT NULL DEFAULT false,
    void_transaction_count integer NOT NULL DEFAULT 0,
    rounding_amount numeric NOT NULL DEFAULT 0,
    delivery_cost numeric NOT NULL DEFAULT 0,
    order_fee numeric NOT NULL DEFAULT 0,
    voucher_discount_amount numeric NOT NULL DEFAULT 0,
    promotion_discount_amount numeric NOT NULL DEFAULT 0,
    menu_discount_amount numeric NOT NULL DEFAULT 0,
    voucher_payment_amount numeric NOT NULL DEFAULT 0,
    other_vat_amount numeric NOT NULL DEFAULT 0,
    pax_total integer NOT NULL DEFAULT 0,
    CONSTRAINT pos_sync_aggregates_pkey PRIMARY KEY (id),
    CONSTRAINT pos_sync_aggregates_sales_date_branch_pos_id_payment_pos_id_key UNIQUE (sales_date, branch_pos_id, payment_pos_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_sync_aggregates_branch
    ON public.pos_sync_aggregates(branch_id);

ALTER TABLE IF EXISTS public.pos_sync_aggregates
    ADD CONSTRAINT pos_sync_aggregates_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pos_sync_aggregates
    ADD CONSTRAINT pos_sync_aggregates_payment_method_id_fkey FOREIGN KEY (payment_method_id)
    REFERENCES public.payment_methods (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.pos_sync_aggregate_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    aggregate_id uuid NOT NULL,
    sales_num text COLLATE pg_catalog."default" NOT NULL,
    sales_date date NOT NULL,
    branch_pos_id integer NOT NULL,
    subtotal numeric NOT NULL DEFAULT 0,
    discount_total numeric NOT NULL DEFAULT 0,
    other_tax_total numeric NOT NULL DEFAULT 0,
    vat_total numeric NOT NULL DEFAULT 0,
    grand_total numeric NOT NULL DEFAULT 0,
    payment_pos_id integer NOT NULL,
    payment_amount numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    rounding_total numeric NOT NULL DEFAULT 0,
    delivery_cost numeric NOT NULL DEFAULT 0,
    order_fee numeric NOT NULL DEFAULT 0,
    voucher_discount_total numeric NOT NULL DEFAULT 0,
    promotion_discount numeric NOT NULL DEFAULT 0,
    menu_discount_total numeric NOT NULL DEFAULT 0,
    voucher_total numeric NOT NULL DEFAULT 0,
    other_vat_total numeric NOT NULL DEFAULT 0,
    CONSTRAINT pos_sync_aggregate_lines_pkey PRIMARY KEY (id),
    CONSTRAINT pos_sync_aggregate_lines_aggregate_id_sales_num_payment_pos_id_ UNIQUE (aggregate_id, sales_num, payment_pos_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_sync_aggregate_lines_agg
    ON public.pos_sync_aggregate_lines(aggregate_id);

ALTER TABLE IF EXISTS public.pos_sync_aggregate_lines
    ADD CONSTRAINT pos_sync_aggregate_lines_aggregate_id_fkey FOREIGN KEY (aggregate_id)
    REFERENCES public.pos_sync_aggregates (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


END;