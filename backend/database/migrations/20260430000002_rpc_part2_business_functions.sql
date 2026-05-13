-- ============================================================================
-- Migration Part 2: Business Logic Functions (from Supabase)
-- ============================================================================

-- 25. get_next_journal_sequence
CREATE OR REPLACE FUNCTION public.get_next_journal_sequence(p_company_id uuid, p_period character varying, p_journal_type journal_type_enum)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_next_seq INTEGER;
  v_lock_name TEXT;
BEGIN
  v_lock_name := 'journal_seq_' || p_company_id || '_' || p_period || '_' || p_journal_type;

  PERFORM pg_advisory_xact_lock(
    hashtext(v_lock_name) % 2147483647,
    hashtext(v_lock_name) / 2147483647 % 2147483647
  );

  SELECT COALESCE(MAX(j.sequence_number), 0) + 1
  INTO v_next_seq
  FROM journal_headers j
  WHERE j.company_id = p_company_id
  AND j.period = p_period
  AND j.journal_type = p_journal_type;

  RETURN v_next_seq;
END;
$function$;

-- 26. create_journal_header_atomic
CREATE OR REPLACE FUNCTION public.create_journal_header_atomic(p_company_id uuid, p_branch_id uuid, p_journal_number character varying, p_journal_type journal_type_enum, p_journal_date date, p_period character varying, p_description text, p_total_amount numeric, p_source_module character varying)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_seq INTEGER;
  v_journal_id UUID;
  v_result JSONB;
BEGIN
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'Company ID is required'; END IF;
  IF p_total_amount <= 0 THEN RAISE EXCEPTION 'Total amount must be greater than 0'; END IF;

  SELECT to_jsonb(h) || jsonb_build_object('is_existing', true)
  INTO v_result
  FROM journal_headers h
  WHERE h.company_id = p_company_id
    AND h.journal_number = p_journal_number
    AND h.deleted_at IS NULL
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  v_seq := get_next_journal_sequence(p_company_id, p_period, p_journal_type);

  INSERT INTO journal_headers (
    company_id, branch_id, journal_number, sequence_number,
    journal_type, journal_date, period, description,
    total_debit, total_credit, currency, exchange_rate,
    status, is_auto, source_module, posted_at, created_at, updated_at
  ) VALUES (
    p_company_id, p_branch_id, p_journal_number, v_seq,
    p_journal_type, p_journal_date, p_period, p_description,
    p_total_amount, p_total_amount, 'IDR', 1,
    'POSTED', true, p_source_module, NOW(), NOW(), NOW()
  )
  RETURNING id INTO v_journal_id;

  SELECT to_jsonb(h) || jsonb_build_object('is_existing', false)
  INTO v_result
  FROM journal_headers h
  WHERE h.id = v_journal_id;

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    SELECT to_jsonb(h) || jsonb_build_object('is_existing', true)
    INTO v_result
    FROM journal_headers h
    WHERE h.company_id = p_company_id
      AND h.journal_number = p_journal_number
      AND h.deleted_at IS NULL
    LIMIT 1;

    IF v_result IS NOT NULL THEN RETURN v_result; END IF;
    RAISE;
END;
$function$;

-- 27. post_journal_lines_atomic
CREATE OR REPLACE FUNCTION public.post_journal_lines_atomic(p_journal_header_id uuid, p_lines jsonb, p_bank_statement_ids bigint[], p_aggregate_ids uuid[], p_set_processing boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_inserted_count integer;
BEGIN
  INSERT INTO journal_lines (
    journal_header_id, line_number, account_id, description,
    debit_amount, credit_amount, currency, exchange_rate,
    base_debit_amount, base_credit_amount, created_at
  )
  SELECT
    p_journal_header_id,
    (line->>'line_number')::integer,
    (line->>'account_id')::uuid,
    line->>'description',
    (line->>'debit_amount')::numeric,
    (line->>'credit_amount')::numeric,
    line->>'currency',
    (line->>'exchange_rate')::numeric,
    (line->>'base_debit_amount')::numeric,
    (line->>'base_credit_amount')::numeric,
    NOW()
  FROM jsonb_array_elements(p_lines) AS line;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  IF array_length(p_bank_statement_ids, 1) > 0 THEN
    UPDATE bank_statements
    SET journal_id = p_journal_header_id, updated_at = NOW()
    WHERE id = ANY(p_bank_statement_ids);
  END IF;

  IF array_length(p_aggregate_ids, 1) > 0 THEN
    UPDATE aggregated_transactions
    SET journal_id = p_journal_header_id,
        status = 'COMPLETED',
        updated_at = NOW()
    WHERE id = ANY(p_aggregate_ids);
  END IF;

  RETURN jsonb_build_object('success', true, 'lines_inserted', v_inserted_count);

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$function$;

-- 28. create_job_atomic
CREATE OR REPLACE FUNCTION public.create_job_atomic(p_user_id uuid, p_company_id uuid, p_type job_type_enum, p_module character varying, p_name character varying, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jobs
 LANGUAGE plpgsql
AS $function$
DECLARE v_job jobs;
BEGIN
  PERFORM 1 FROM jobs WHERE user_id = p_user_id AND status IN ('pending', 'processing') AND deleted_at IS NULL FOR UPDATE NOWAIT;
  IF FOUND THEN RAISE EXCEPTION 'User already has an active job' USING ERRCODE = '23505'; END IF;
  INSERT INTO jobs (user_id, company_id, type, module, name, status, progress, metadata, created_by)
  VALUES (p_user_id, p_company_id, p_type, p_module, p_name, 'pending', 0, p_metadata, p_user_id) RETURNING * INTO v_job;
  RETURN v_job;
END;
$function$;

-- 29. mark_job_processing_atomic
CREATE OR REPLACE FUNCTION public.mark_job_processing_atomic(p_job_id uuid)
 RETURNS jobs
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_job jobs;
BEGIN
  UPDATE jobs SET
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'pending'
    AND deleted_at IS NULL
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or not in pending state';
  END IF;

  RETURN v_job;
END;
$function$;

-- 30. complete_job_atomic
CREATE OR REPLACE FUNCTION public.complete_job_atomic(p_job_id uuid, p_result_url text, p_file_path text, p_file_size bigint, p_expires_at timestamp with time zone, p_updated_by uuid)
 RETURNS jobs
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_job jobs;
BEGIN
  UPDATE jobs SET
    status = 'completed',
    progress = 100,
    result_url = p_result_url,
    file_path = p_file_path,
    file_size = p_file_size,
    completed_at = NOW(),
    expires_at = p_expires_at,
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_job_id
    AND status = 'processing'
    AND deleted_at IS NULL
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or not in processing state';
  END IF;

  RETURN v_job;
END;
$function$;

-- 31. fail_job_atomic
CREATE OR REPLACE FUNCTION public.fail_job_atomic(p_job_id uuid, p_error_message text, p_updated_by uuid)
 RETURNS jobs
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_job jobs;
BEGIN
  UPDATE jobs SET
    status = 'failed',
    error_message = p_error_message,
    completed_at = NOW(),
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_job_id
    AND status IN ('pending', 'processing')
    AND deleted_at IS NULL
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or not in active state';
  END IF;

  RETURN v_job;
END;
$function$;

-- 32. soft_delete_job
CREATE OR REPLACE FUNCTION public.soft_delete_job(p_job_id uuid, p_user_id uuid, p_deleted_by uuid)
 RETURNS jobs
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_job jobs;
BEGIN
  UPDATE jobs SET
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    updated_at = NOW(),
    updated_by = p_deleted_by
  WHERE id = p_job_id
    AND user_id = p_user_id
    AND deleted_at IS NULL
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or already deleted';
  END IF;

  RETURN v_job;
END;
$function$;

-- 33. generate_employee_id
CREATE OR REPLACE FUNCTION public.generate_employee_id(p_branch_name text, p_join_date date, p_job_position text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  seq integer;
  branch_code text;
  position_code text;
  month_part text;
  year_part text;
BEGIN
  seq := nextval('employee_id_seq');

  branch_code := upper(substr(regexp_replace(p_branch_name, '[^A-Za-z]', '', 'g') || 'XX', 1, 2));
  position_code := upper(substr(regexp_replace(p_job_position, '[^A-Za-z]', '', 'g') || 'XX', 1, 2));

  month_part := lpad(extract(month from p_join_date)::text, 2, '0');
  year_part := right(extract(year from p_join_date)::text, 2);

  RETURN 'S'
    || branch_code
    || month_part
    || year_part
    || position_code
    || lpad(seq::text, 4, '0');
END;
$function$;

-- 34. generate_settlement_number
CREATE OR REPLACE FUNCTION public.generate_settlement_number(p_settlement_date date)
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_next_seq INTEGER;
  v_result VARCHAR(50);
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(settlement_number FROM '([0-9]+)$') AS INTEGER)),
    0
  ) + 1 INTO v_next_seq
  FROM bank_settlement_groups
  WHERE settlement_date = p_settlement_date;

  v_result := 'SET-' || TO_CHAR(p_settlement_date, 'YYYYMMDD') || '-' || LPAD(v_next_seq::TEXT, 3, '0');
  RETURN v_result;
END;
$function$;

-- 35. migrate_reconciled_pos_to_sync
CREATE OR REPLACE FUNCTION public.migrate_reconciled_pos_to_sync(p_pos_id uuid, p_sync_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_pos record;
  v_covered_by_cash_deposit boolean;
BEGIN
  SELECT id, is_reconciled, actual_fee_amount, fee_discrepancy, fee_discrepancy_note,
         payment_method_id, transaction_date, branch_name
  INTO v_pos
  FROM aggregated_transactions
  WHERE id = p_pos_id
    AND source_type = 'POS'
    AND is_reconciled = true
    AND superseded_by IS NULL
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM cash_counts cc
    JOIN cash_deposits cd ON cd.id = cc.cash_deposit_id
    WHERE cc.payment_method_id = v_pos.payment_method_id
      AND cc.start_date <= v_pos.transaction_date
      AND cc.end_date >= v_pos.transaction_date
      AND cc.branch_name = v_pos.branch_name
      AND cc.deleted_at IS NULL
      AND cd.status = 'RECONCILED'
  ) INTO v_covered_by_cash_deposit;

  IF v_covered_by_cash_deposit THEN
    UPDATE aggregated_transactions
    SET superseded_by = p_sync_id, status = 'SUPERSEDED', is_reconciled = false, updated_at = now()
    WHERE id = p_pos_id;
    RETURN true;
  END IF;

  UPDATE aggregated_transactions
  SET is_reconciled = true, actual_fee_amount = v_pos.actual_fee_amount,
      fee_discrepancy = v_pos.fee_discrepancy, fee_discrepancy_note = v_pos.fee_discrepancy_note,
      updated_at = now()
  WHERE id = p_sync_id;

  UPDATE bank_statements
  SET reconciliation_id = p_sync_id, is_reconciled = true, updated_at = now()
  WHERE reconciliation_id = p_pos_id AND deleted_at IS NULL;

  UPDATE bank_reconciliation_groups
  SET aggregate_id = p_sync_id, updated_at = now()
  WHERE aggregate_id = p_pos_id AND deleted_at IS NULL;

  UPDATE bank_settlement_aggregates
  SET aggregate_id = p_sync_id
  WHERE aggregate_id = p_pos_id;

  UPDATE aggregated_transactions
  SET superseded_by = p_sync_id, status = 'SUPERSEDED', is_reconciled = false, updated_at = now()
  WHERE id = p_pos_id;

  RETURN true;
END;
$function$;

-- 36. supersede_manual_entries
CREATE OR REPLACE FUNCTION public.supersede_manual_entries(p_superseded_by_id uuid, p_transaction_date date, p_payment_method_id integer, p_branch_id uuid DEFAULT NULL::uuid, p_branch_name text DEFAULT NULL::text)
 RETURNS TABLE(id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_branch_id IS NULL AND p_branch_name IS NULL THEN
    RAISE EXCEPTION 'Either branch_id or branch_name must be provided';
  END IF;

  RETURN QUERY
  UPDATE aggregated_transactions
  SET superseded_by = p_superseded_by_id, status = 'SUPERSEDED', updated_at = now()
  WHERE source_type = 'POS'
    AND transaction_date = p_transaction_date
    AND payment_method_id = p_payment_method_id
    AND is_reconciled = false
    AND superseded_by IS NULL
    AND deleted_at IS NULL
    AND (
      (p_branch_id IS NOT NULL AND p_branch_name IS NOT NULL
        AND branch_id = p_branch_id AND branch_name = p_branch_name)
      OR
      (p_branch_name IS NOT NULL AND branch_name = p_branch_name)
      OR
      (p_branch_id IS NOT NULL AND p_branch_name IS NULL
        AND branch_id = p_branch_id)
    )
  RETURNING aggregated_transactions.id;
END;
$function$;

-- 37. supersede_manual_if_sync_exists_batch
CREATE OR REPLACE FUNCTION public.supersede_manual_if_sync_exists_batch(p_manual_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_affected int;
BEGIN
  WITH matches AS (
    SELECT DISTINCT ON (m.id)
      m.id   AS manual_id,
      s.id   AS sync_id
    FROM public.aggregated_transactions m
    JOIN public.aggregated_transactions s
      ON s.source_type       = 'POS_SYNC'
      AND s.transaction_date  = m.transaction_date
      AND s.payment_method_id = m.payment_method_id
      AND (s.branch_id = m.branch_id OR s.branch_name = m.branch_name)
      AND s.deleted_at        IS NULL
      AND s.superseded_by     IS NULL
    WHERE m.id             = ANY(p_manual_ids)
      AND m.source_type    = 'POS'
      AND m.superseded_by  IS NULL
      AND m.deleted_at     IS NULL
      AND m.payment_method_id IS NOT NULL
    ORDER BY m.id, s.updated_at DESC
  )
  UPDATE public.aggregated_transactions
  SET superseded_by = matches.sync_id, status = 'SUPERSEDED', updated_at = now()
  FROM matches
  WHERE public.aggregated_transactions.id = matches.manual_id;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$function$;

-- 38. sync_cash_deposit_reconciliation
CREATE OR REPLACE FUNCTION public.sync_cash_deposit_reconciliation(p_deposit_id uuid, p_is_reconciled boolean)
 RETURNS TABLE(updated_aggregates integer, updated_pos_sync integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH cc AS (
    SELECT start_date, end_date, branch_name, payment_method_id
    FROM cash_counts
    WHERE cash_deposit_id = p_deposit_id
      AND deleted_at IS NULL
  ),
  matched AS (
    SELECT DISTINCT at.id
    FROM aggregated_transactions at
    JOIN cc
      ON at.payment_method_id = cc.payment_method_id
     AND at.transaction_date >= cc.start_date
     AND at.transaction_date <= cc.end_date
     AND (cc.branch_name IS NULL OR at.branch_name = cc.branch_name)
    WHERE at.deleted_at IS NULL
      AND at.superseded_by IS NULL
  ),
  updated_agg AS (
    UPDATE aggregated_transactions
    SET is_reconciled = p_is_reconciled, updated_at = now()
    WHERE id IN (SELECT id FROM matched)
    RETURNING id, pos_sync_aggregate_id
  )
  SELECT
    (SELECT count(*)::int FROM updated_agg),
    (SELECT count(*)::int FROM updated_agg WHERE pos_sync_aggregate_id IS NOT NULL);
END;
$function$;

-- 39. sync_pos_aggregates_batch
CREATE OR REPLACE FUNCTION public.sync_pos_aggregates_batch(p_sales_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_synced     int := 0;
  v_superseded int := 0;
  v_voided     int := 0;
BEGIN
  WITH upserted AS (
    INSERT INTO public.aggregated_transactions (
      source_type, source_id, source_ref,
      transaction_date, payment_method_id,
      branch_id, branch_name,
      gross_amount, discount_amount, tax_amount, nett_amount,
      total_fee_amount, percentage_fee_amount, fixed_fee_amount,
      bill_after_discount, rounding_amount, delivery_cost, order_fee,
      voucher_discount_amount, promotion_discount_amount,
      menu_discount_amount, voucher_payment_amount,
      other_vat_amount, service_charge_amount,
      pax_total, pos_sync_aggregate_id, status, updated_at
    )
    SELECT
      'POS_SYNC',
      p.id::varchar(100),
      substr(p.sales_date::text || '_' || p.branch_pos_id::text || '_' || p.payment_pos_id::text, 1, 100),
      p.sales_date,
      p.payment_method_id,
      p.branch_id,
      p.branch_name,
      COALESCE(p.gross_amount, 0),
      COALESCE(p.discount_amount, 0),
      COALESCE(p.tax_amount, 0),
      COALESCE(p.nett_amount, 0),
      COALESCE(p.total_fee_amount, 0),
      COALESCE(p.percentage_fee_amount, 0),
      COALESCE(p.fixed_fee_amount_calc, 0),
      COALESCE(p.grand_total, 0),
      COALESCE(p.rounding_amount, 0),
      COALESCE(p.delivery_cost, 0),
      COALESCE(p.order_fee, 0),
      COALESCE(p.voucher_discount_amount, 0),
      COALESCE(p.promotion_discount_amount, 0),
      COALESCE(p.menu_discount_amount, 0),
      COALESCE(p.voucher_payment_amount, 0),
      COALESCE(p.other_vat_amount, 0),
      COALESCE(p.other_tax_amount, 0),
      COALESCE(p.pax_total, 0),
      p.id,
      'READY',
      now()
    FROM public.pos_sync_aggregates p
    WHERE p.sales_date = p_sales_date
      AND p.status IN ('READY', 'RECALCULATED')
    ON CONFLICT (source_type, source_id, source_ref)
    DO UPDATE SET
      gross_amount              = EXCLUDED.gross_amount,
      discount_amount           = EXCLUDED.discount_amount,
      tax_amount                = EXCLUDED.tax_amount,
      nett_amount               = EXCLUDED.nett_amount,
      total_fee_amount          = EXCLUDED.total_fee_amount,
      percentage_fee_amount     = EXCLUDED.percentage_fee_amount,
      fixed_fee_amount          = EXCLUDED.fixed_fee_amount,
      bill_after_discount       = EXCLUDED.bill_after_discount,
      rounding_amount           = EXCLUDED.rounding_amount,
      delivery_cost             = EXCLUDED.delivery_cost,
      order_fee                 = EXCLUDED.order_fee,
      voucher_discount_amount   = EXCLUDED.voucher_discount_amount,
      promotion_discount_amount = EXCLUDED.promotion_discount_amount,
      menu_discount_amount      = EXCLUDED.menu_discount_amount,
      voucher_payment_amount    = EXCLUDED.voucher_payment_amount,
      other_vat_amount          = EXCLUDED.other_vat_amount,
      service_charge_amount     = EXCLUDED.service_charge_amount,
      pax_total                 = EXCLUDED.pax_total,
      status                    = EXCLUDED.status,
      updated_at                = now()
    RETURNING id, branch_id, branch_name, payment_method_id, transaction_date
  ),
  superseded AS (
    UPDATE public.aggregated_transactions at
    SET superseded_by = u.id, status = 'SUPERSEDED', updated_at = now()
    FROM upserted u
    WHERE at.source_type       = 'POS'
      AND at.transaction_date  = u.transaction_date
      AND at.payment_method_id = u.payment_method_id
      AND (at.branch_id = u.branch_id OR at.branch_name = u.branch_name)
      AND at.is_reconciled     = false
      AND at.superseded_by     IS NULL
      AND at.deleted_at        IS NULL
    RETURNING at.id
  ),
  reconciled_twins AS (
    SELECT at_pos.id AS pos_id, u.id AS sync_id
    FROM upserted u
    JOIN public.aggregated_transactions at_pos
      ON at_pos.source_type       = 'POS'
      AND at_pos.transaction_date  = u.transaction_date
      AND at_pos.payment_method_id = u.payment_method_id
      AND (at_pos.branch_id = u.branch_id OR at_pos.branch_name = u.branch_name)
      AND at_pos.is_reconciled     = true
      AND at_pos.status            = 'READY'
      AND at_pos.superseded_by     IS NULL
      AND at_pos.deleted_at        IS NULL
  ),
  migrated_statements AS (
    UPDATE public.bank_statements bs
    SET reconciliation_id = rt.sync_id, updated_at = now()
    FROM reconciled_twins rt
    WHERE bs.reconciliation_id = rt.pos_id
      AND bs.deleted_at IS NULL
    RETURNING bs.id
  ),
  migrated_pos AS (
    UPDATE public.aggregated_transactions
    SET superseded_by = rt.sync_id, status = 'SUPERSEDED', updated_at = now()
    FROM reconciled_twins rt
    WHERE public.aggregated_transactions.id = rt.pos_id
    RETURNING public.aggregated_transactions.id
  )
  SELECT
    (SELECT COUNT(*) FROM upserted)::int,
    (SELECT COUNT(*) FROM superseded)::int + (SELECT COUNT(*) FROM migrated_pos)::int
  INTO v_synced, v_superseded;

  WITH voided AS (
    INSERT INTO public.aggregated_transactions (
      source_type, source_id, source_ref,
      transaction_date, payment_method_id,
      branch_id, branch_name,
      gross_amount, discount_amount, tax_amount, nett_amount,
      total_fee_amount, percentage_fee_amount, fixed_fee_amount,
      bill_after_discount, rounding_amount, delivery_cost, order_fee,
      voucher_discount_amount, promotion_discount_amount,
      menu_discount_amount, voucher_payment_amount,
      other_vat_amount, service_charge_amount,
      pax_total, pos_sync_aggregate_id, status, updated_at
    )
    SELECT
      'POS_SYNC',
      v.id::varchar(100),
      substr(v.sales_date::text || '_' || v.branch_pos_id::text || '_VOID', 1, 100),
      v.sales_date,
      NULL,
      v.branch_id,
      v.branch_name,
      COALESCE(v.gross_amount, 0),
      COALESCE(v.discount_amount, 0),
      COALESCE(v.tax_amount, 0),
      0, 0, 0, 0,
      COALESCE(v.grand_total, 0),
      COALESCE(v.rounding_amount, 0),
      COALESCE(v.delivery_cost, 0),
      COALESCE(v.order_fee, 0),
      COALESCE(v.voucher_discount_amount, 0),
      COALESCE(v.promotion_discount_amount, 0),
      COALESCE(v.menu_discount_amount, 0),
      COALESCE(v.voucher_payment_amount, 0),
      COALESCE(v.other_vat_amount, 0),
      COALESCE(v.other_tax_amount, 0),
      COALESCE(v.pax_total, 0),
      v.id,
      'VOID',
      now()
    FROM public.pos_sync_aggregates v
    WHERE v.sales_date = p_sales_date
      AND v.status = 'VOID'
    ON CONFLICT (source_type, source_id, source_ref)
    DO UPDATE SET
      gross_amount        = EXCLUDED.gross_amount,
      bill_after_discount = EXCLUDED.bill_after_discount,
      status              = EXCLUDED.status,
      updated_at          = now()
    RETURNING id
  )
  SELECT COUNT(*)::int INTO v_voided FROM voided;

  RETURN jsonb_build_object(
    'synced',     v_synced,
    'superseded', v_superseded,
    'voided',     v_voided
  );
END;
$function$;
