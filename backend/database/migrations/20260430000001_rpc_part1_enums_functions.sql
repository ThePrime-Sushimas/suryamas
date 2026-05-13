-- ============================================================================
-- Migration Part 1: Enums + Functions (from Supabase)
-- ============================================================================

-- ── ENUMS ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE aggregated_transaction_status AS ENUM ('READY','PENDING','PROCESSING','COMPLETED','CANCELLED','FAILED','SUPERSEDED','VOID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bank_mutation_entry_status AS ENUM ('ACTIVE','VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bank_mutation_entry_type AS ENUM ('BANK_FEE','INTEREST','TRANSFER_IN','TRANSFER_OUT','SUPPLIER_PAYMENT','RECEIVABLE','REFUND','TAX_PAYMENT','PAYROLL','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_status_enum AS ENUM ('pending','processing','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_type_enum AS ENUM ('export','import');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE journal_status_enum AS ENUM ('DRAFT','SUBMITTED','APPROVED','POSTED','REVERSED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE journal_type_enum AS ENUM ('EXPENSE','PURCHASE','SALES','INVENTORY','CASH','BANK','ASSET','TAX','GENERAL','OPENING','RECEIVABLE','PAYROLL','FINANCING','PAYABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pos_import_status_enum AS ENUM ('PENDING','ANALYZED','IMPORTED','MAPPED','POSTED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE supplier_type_enum AS ENUM ('vegetables','meat','seafood','dairy','beverage','dry_goods','packaging','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── FUNCTIONS ──────────────────────────────────────────────────────────────

-- 1. set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 2. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;

-- 3. update_updated_by_column
CREATE OR REPLACE FUNCTION public.update_updated_by_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_by = CURRENT_USER;
    RETURN NEW;
END;
$function$;

-- 4. update_account_period_balances_updated_at
CREATE OR REPLACE FUNCTION public.update_account_period_balances_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 5. update_aggregated_transactions_updated_at
CREATE OR REPLACE FUNCTION public.update_aggregated_transactions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 6. update_bank_mutation_entries_updated_at
CREATE OR REPLACE FUNCTION public.update_bank_mutation_entries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 7. update_bank_settlement_groups_updated_at
CREATE OR REPLACE FUNCTION public.update_bank_settlement_groups_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 8. update_bank_statements_updated_at
CREATE OR REPLACE FUNCTION public.update_bank_statements_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- 9. update_cash_counts_updated_at
CREATE OR REPLACE FUNCTION public.update_cash_counts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 10. update_cash_deposits_updated_at
CREATE OR REPLACE FUNCTION public.update_cash_deposits_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 11. update_metric_units_updated_at_and_by
CREATE OR REPLACE FUNCTION public.update_metric_units_updated_at_and_by()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by = CURRENT_USER;
  END IF;
  RETURN NEW;
END;
$function$;

-- 12. update_payment_methods_updated_at
CREATE OR REPLACE FUNCTION public.update_payment_methods_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 13. update_pmg_updated_at
CREATE OR REPLACE FUNCTION public.update_pmg_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 14. update_product_uoms_updated_at
CREATE OR REPLACE FUNCTION public.update_product_uoms_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- 15. update_products_updated_at
CREATE OR REPLACE FUNCTION public.update_products_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- 16. trg_set_account_path
CREATE OR REPLACE FUNCTION public.trg_set_account_path()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.parent_account_id IS NULL THEN
        NEW.level := 1;
        NEW.account_path := NEW.account_code;
    ELSE
        SELECT
            parent.level + 1,
            parent.account_path || '/' || NEW.account_code
        INTO
            NEW.level,
            NEW.account_path
        FROM chart_of_accounts parent
        WHERE parent.id = NEW.parent_account_id;
    END IF;
    RETURN NEW;
END;
$function$;

-- 17. set_journal_period
CREATE OR REPLACE FUNCTION public.set_journal_period()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.period := TO_CHAR(NEW.journal_date, 'YYYY-MM');
  RETURN NEW;
END;
$function$;

-- 18. audit_employee_branches
CREATE OR REPLACE FUNCTION public.audit_employee_branches()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.perm_audit_log (
        entity_id, entity_type, action, old_value, new_value, branch_id, created_at
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        'employee_branches',
        TG_OP,
        CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN
            jsonb_build_object('id', OLD.id, 'employee_id', OLD.employee_id, 'branch_id', OLD.branch_id, 'is_primary', OLD.is_primary, 'created_at', OLD.created_at)
        ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN
            jsonb_build_object('id', NEW.id, 'employee_id', NEW.employee_id, 'branch_id', NEW.branch_id, 'is_primary', NEW.is_primary, 'created_at', NEW.created_at)
        ELSE NULL END,
        COALESCE(NEW.branch_id, OLD.branch_id),
        NOW()
    );
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 19. update_product_default_purchase_unit
CREATE OR REPLACE FUNCTION public.update_product_default_purchase_unit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.is_default_purchase_unit = true AND NEW.status_uom = 'ACTIVE' AND NEW.is_deleted = false THEN
    UPDATE products p
    SET default_purchase_unit = mu.unit_name
    FROM metric_units mu
    WHERE p.id = NEW.product_id AND mu.id = NEW.metric_unit_id;
  END IF;

  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND OLD.is_default_purchase_unit = true THEN
    UPDATE products p
    SET default_purchase_unit = (
      SELECT mu.unit_name
      FROM product_uoms pu
      JOIN metric_units mu ON pu.metric_unit_id = mu.id
      WHERE pu.product_id = OLD.product_id
        AND pu.is_default_purchase_unit = true
        AND pu.status_uom = 'ACTIVE'
        AND pu.is_deleted = false
        AND pu.id != OLD.id
      LIMIT 1
    )
    WHERE p.id = OLD.product_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 20. generate_settlement_number
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

-- 21. set_bank_settlement_number_on_insert
CREATE OR REPLACE FUNCTION public.set_bank_settlement_number_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.settlement_number IS NULL THEN
    NEW.settlement_number := generate_settlement_number(NEW.settlement_date);
  END IF;
  RETURN NEW;
END;
$function$;

-- 22. check_duplicate_transactions
CREATE OR REPLACE FUNCTION public.check_duplicate_transactions(transactions jsonb)
 RETURNS TABLE(bill_number character varying, sales_number character varying, sales_date date, pos_import_id uuid)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH transaction_data AS (
    SELECT
      (value->>'bill_number')::character varying(100) AS bill_number,
      (value->>'sales_number')::character varying(100) AS sales_number,
      (value->>'sales_date')::date AS sales_date
    FROM jsonb_array_elements(transactions)
  )
  SELECT DISTINCT
    pil.bill_number,
    pil.sales_number,
    pil.sales_date,
    pil.pos_import_id
  FROM pos_import_lines pil
  WHERE EXISTS (
    SELECT 1 FROM transaction_data td
    WHERE pil.bill_number = td.bill_number
      AND pil.sales_number = td.sales_number
      AND pil.sales_date = td.sales_date
  );
END;
$function$;

-- 23. user_has_permission
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_module_name character varying, p_action character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  SELECT
    CASE p_action
      WHEN 'view' THEN rp.can_view
      WHEN 'insert' THEN rp.can_insert
      WHEN 'update' THEN rp.can_update
      WHEN 'delete' THEN rp.can_delete
      WHEN 'approve' THEN rp.can_approve
      WHEN 'release' THEN rp.can_release
      ELSE false
    END INTO v_has_permission
  FROM perm_user_profiles up
  JOIN perm_roles r ON up.role_id = r.id
  JOIN perm_role_permissions rp ON r.id = rp.role_id
  JOIN perm_modules m ON rp.module_id = m.id
  WHERE up.user_id = p_user_id
    AND m.name = p_module_name
    AND m.is_active = true;

  RETURN COALESCE(v_has_permission, false);
END;
$function$;

-- 24. sync_pos_sync_reconciliation (trigger function)
CREATE OR REPLACE FUNCTION public.sync_pos_sync_reconciliation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.is_reconciled IS NOT DISTINCT FROM NEW.is_reconciled THEN
    RETURN NEW;
  END IF;

  IF NEW.source_type = 'POS_SYNC' AND NEW.pos_sync_aggregate_id IS NOT NULL THEN
    UPDATE pos_sync_aggregates
    SET is_reconciled = NEW.is_reconciled, updated_at = now()
    WHERE id = NEW.pos_sync_aggregate_id;
  END IF;

  RETURN NEW;
END;
$function$;
