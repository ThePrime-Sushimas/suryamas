-- ============================================================
-- SEED: chart_of_accounts for companies without COA
--
-- Problem:
-- Some companies may exist without any chart_of_accounts rows, which breaks:
-- - accounting_purpose_accounts mapping (e.g. SAL-INV, BANK-REC)
-- - any journal generation that relies on COA
--
-- Approach:
-- - Copy COA rows from a template company (must already have a complete COA)
-- - Reconstruct parent_account_id by matching parent account_code
--
-- Safety:
-- - Only targets companies with 0 COA rows
-- - Uses ON CONFLICT (company_id, account_code) DO NOTHING
-- - Does NOT delete/override existing company COA
-- ============================================================

DO $$
DECLARE
  v_template_company_id uuid := '3576839e-d83a-4061-8551-fe9b5d971111'; -- template company with full COA
  r_company RECORD;
  r_coa RECORD;
  v_parent_id uuid;
BEGIN
  -- Ensure template company has COA
  IF NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts
    WHERE company_id = v_template_company_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Template company % has no chart_of_accounts rows', v_template_company_id;
  END IF;

  -- For each company that has no COA at all, clone from template
  FOR r_company IN
    SELECT c.id AS company_id
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.chart_of_accounts coa
      WHERE coa.company_id = c.id
    )
  LOOP
    -- 1) Insert all COA rows without parent links first (parent_account_id NULL)
    FOR r_coa IN
      SELECT
        account_code,
        account_name,
        account_type,
        normal_balance,
        is_header,
        is_postable,
        is_active,
        created_by
      FROM public.chart_of_accounts
      WHERE company_id = v_template_company_id
        AND deleted_at IS NULL
      ORDER BY length(account_code) ASC, account_code ASC
    LOOP
      INSERT INTO public.chart_of_accounts (
        company_id,
        account_code,
        account_name,
        account_type,
        normal_balance,
        is_header,
        is_postable,
        is_active,
        parent_account_id,
        created_by
      ) VALUES (
        r_company.company_id,
        r_coa.account_code,
        r_coa.account_name,
        r_coa.account_type,
        r_coa.normal_balance,
        r_coa.is_header,
        r_coa.is_postable,
        r_coa.is_active,
        NULL,
        r_coa.created_by
      )
      ON CONFLICT (company_id, account_code) DO NOTHING;
    END LOOP;

    -- 2) Re-link parents by account_code (second pass)
    FOR r_coa IN
      SELECT
        child.account_code               AS child_code,
        parent.account_code              AS parent_code
      FROM public.chart_of_accounts child
      JOIN public.chart_of_accounts parent
        ON parent.id = child.parent_account_id
      WHERE child.company_id = v_template_company_id
        AND child.deleted_at IS NULL
        AND parent.deleted_at IS NULL
    LOOP
      SELECT id INTO v_parent_id
      FROM public.chart_of_accounts
      WHERE company_id = r_company.company_id
        AND account_code = r_coa.parent_code
        AND deleted_at IS NULL
      LIMIT 1;

      -- Update child to point to the cloned parent
      UPDATE public.chart_of_accounts c
      SET parent_account_id = v_parent_id
      WHERE c.company_id = r_company.company_id
        AND c.account_code = r_coa.child_code
        AND c.deleted_at IS NULL
        AND v_parent_id IS NOT NULL;
    END LOOP;
  END LOOP;
END $$;

