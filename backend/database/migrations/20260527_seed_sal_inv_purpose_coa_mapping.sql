-- ============================================================
-- SEED: SAL-INV → COA mapping (accounting_purpose_accounts)
-- This seeds default accounts used by the POS journals processor.
--
-- NOTE:
-- - This migration only inserts mappings when the COA account_code exists
--   in the target company.
-- - It will not create chart_of_accounts rows.
-- ============================================================

DO $$
DECLARE
  r RECORD;
  v_created_by uuid;
BEGIN
  FOR r IN
    SELECT ap.company_id, ap.id AS purpose_id
    FROM accounting_purposes ap
    WHERE ap.purpose_code = 'SAL-INV'
      AND ap.is_active = true
      AND ap.deleted_at IS NULL
      AND (ap.is_deleted IS NULL OR ap.is_deleted = false)
  LOOP
    -- Pick a stable created_by for inserted mappings:
    -- use any COA created_by for the company (fallback to NULL if none).
    SELECT coa.created_by
    INTO v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.deleted_at IS NULL
    ORDER BY coa.account_code
    LIMIT 1;

    -- Helper pattern: insert one mapping if account_code exists and mapping not yet present.
    -- DEBIT
    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'DEBIT', 1,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '110301' -- Cash sales receivable
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );

    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'DEBIT', 2,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '410301' -- Bill Discount (contra-revenue)
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );

    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'DEBIT', 3,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '410304' -- Promotion Discount
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );

    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'DEBIT', 4,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '410305' -- Voucher Discount
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );

    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'DEBIT', 5,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '610801' -- Rounding Expense
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );

    -- CREDIT
    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'CREDIT', 1,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '410101' -- Sales - Food
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );

    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'CREDIT', 2,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '210206' -- PB1 payable
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );

    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'CREDIT', 3,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '210209' -- SC Payable
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );

    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'CREDIT', 4,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '210210' -- Other VAT Payable
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );

    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'CREDIT', 5,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '410202' -- Order Fee Revenue
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );

    INSERT INTO accounting_purpose_accounts (
      company_id, purpose_id, account_id, side, priority,
      is_required, is_auto, is_active, created_by, updated_by
    )
    SELECT
      r.company_id, r.purpose_id, coa.id, 'CREDIT', 6,
      true, true, true, v_created_by, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '410203' -- Delivery Revenue
      AND coa.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_purpose_accounts apa
        WHERE apa.company_id = r.company_id
          AND apa.purpose_id = r.purpose_id
          AND apa.account_id = coa.id
          AND apa.deleted_at IS NULL
      );
  END LOOP;
END $$;

