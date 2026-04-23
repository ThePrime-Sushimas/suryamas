-- ============================================================================
-- Migration: Add field_mapping to accounting_purpose_accounts
--            + New COA accounts for POS journal fields
--            + New SAL-INV purpose account mappings
-- ============================================================================

-- ── 1. Add field_mapping column ─────────────────────────────────────────────
ALTER TABLE public.accounting_purpose_accounts
  ADD COLUMN IF NOT EXISTS field_mapping varchar(50) NULL;

CREATE INDEX IF NOT EXISTS idx_apa_field_mapping
  ON public.accounting_purpose_accounts (field_mapping)
  WHERE field_mapping IS NOT NULL;

-- ── 2. New COA accounts ─────────────────────────────────────────────────────
DO $$
-- Ganti deklarasi variable
DECLARE
  v_company_id      uuid := '3576839e-d83a-4061-8551-fe9b5d971111';
  v_created_by      uuid := '8a130a3e-0490-48b9-abe5-769af0dee345';
  v_parent_liability uuid;
  v_parent_revenue   uuid;  -- untuk 410xxx sales/fee (parent 4102)
  v_parent_discount  uuid;  -- untuk 410xxx discount (parent 4103)
  v_parent_expense   uuid;
BEGIN
  SELECT id INTO v_parent_liability FROM chart_of_accounts
    WHERE company_id = v_company_id AND account_code = '2102' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_parent_revenue FROM chart_of_accounts
    WHERE company_id = v_company_id AND account_code = '4102' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_parent_discount FROM chart_of_accounts
    WHERE company_id = v_company_id AND account_code = '4103' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_parent_expense FROM chart_of_accounts
    WHERE company_id = v_company_id AND account_code = '6108' AND deleted_at IS NULL LIMIT 1;
      -- 210209: Service Charge Payable
  INSERT INTO chart_of_accounts (
    company_id, account_code, account_name, account_type,
    normal_balance, is_header, is_postable, is_active,
    parent_account_id, created_by
  ) VALUES (
    v_company_id, '210209', 'Service Charge Payable', 'LIABILITY',
    'CREDIT', false, true, true,
    v_parent_liability, v_created_by
  ) ON CONFLICT (company_id, account_code) DO NOTHING;

  -- 210210: Other VAT Payable
  INSERT INTO chart_of_accounts (
    company_id, account_code, account_name, account_type,
    normal_balance, is_header, is_postable, is_active,
    parent_account_id, created_by
  ) VALUES (
    v_company_id, '210210', 'Other VAT Payable', 'LIABILITY',
    'CREDIT', false, true, true,
    v_parent_liability, v_created_by
  ) ON CONFLICT (company_id, account_code) DO NOTHING;

  -- 410202: Order Fee Revenue
  INSERT INTO chart_of_accounts (
    company_id, account_code, account_name, account_type,
    normal_balance, is_header, is_postable, is_active,
    parent_account_id, created_by
  ) VALUES (
    v_company_id, '410202', 'Order Fee Revenue', 'REVENUE',
    'CREDIT', false, true, true,
    v_parent_revenue, v_created_by
  ) ON CONFLICT (company_id, account_code) DO NOTHING;

  -- 410203: Delivery Revenue
  INSERT INTO chart_of_accounts (
    company_id, account_code, account_name, account_type,
    normal_balance, is_header, is_postable, is_active,
    parent_account_id, created_by
  ) VALUES (
    v_company_id, '410203', 'Delivery Revenue', 'REVENUE',
    'CREDIT', false, true, true,
    v_parent_revenue, v_created_by
  ) ON CONFLICT (company_id, account_code) DO NOTHING;

  -- 410304: Promotion Discount (parent = 4103 discount header)
  SELECT id INTO v_parent_revenue FROM chart_of_accounts
    WHERE company_id = v_company_id AND account_code = '4103' AND deleted_at IS NULL LIMIT 1;

  INSERT INTO chart_of_accounts (
    company_id, account_code, account_name, account_type,
    normal_balance, is_header, is_postable, is_active,
    parent_account_id, created_by
  ) VALUES (
    v_company_id, '410304', 'Promotion Discount', 'REVENUE',
    'CREDIT', false, true, true,
    v_parent_revenue, v_created_by
  ) ON CONFLICT (company_id, account_code) DO NOTHING;

  -- 410305: Voucher Discount
  INSERT INTO chart_of_accounts (
    company_id, account_code, account_name, account_type,
    normal_balance, is_header, is_postable, is_active,
    parent_account_id, created_by
  ) VALUES (
    v_company_id, '410305', 'Voucher Discount', 'REVENUE',
    'CREDIT', false, true, true,
    v_parent_revenue, v_created_by
  ) ON CONFLICT (company_id, account_code) DO NOTHING;

  -- 610801: Rounding Expense
  INSERT INTO chart_of_accounts (
    company_id, account_code, account_name, account_type,
    normal_balance, is_header, is_postable, is_active,
    parent_account_id, created_by
  ) VALUES (
    v_company_id, '610801', 'Rounding Expense', 'EXPENSE',
    'DEBIT', false, true, true,
    v_parent_expense, v_created_by
  ) ON CONFLICT (company_id, account_code) DO NOTHING;
END $$;

-- ── 3. Backfill field_mapping for existing SAL-INV entries ──────────────────
DO $$
DECLARE
  v_company_id uuid := '3576839e-d83a-4061-8551-fe9b5d971111';
  v_purpose_id uuid;
BEGIN
  SELECT id INTO v_purpose_id FROM accounting_purposes
    WHERE company_id = v_company_id AND purpose_code = 'SAL-INV'
    AND is_active = true AND deleted_at IS NULL LIMIT 1;

  IF v_purpose_id IS NULL THEN
    RAISE NOTICE 'SAL-INV purpose not found, skipping field_mapping backfill';
    RETURN;
  END IF;

  -- Backfill existing accounts
  UPDATE accounting_purpose_accounts apa
  SET field_mapping = 'gross_revenue'
  FROM chart_of_accounts coa
  WHERE apa.account_id = coa.id
    AND apa.purpose_id = v_purpose_id
    AND coa.account_code = '410101'
    AND apa.field_mapping IS NULL;

  UPDATE accounting_purpose_accounts apa
  SET field_mapping = 'tax_payable'
  FROM chart_of_accounts coa
  WHERE apa.account_id = coa.id
    AND apa.purpose_id = v_purpose_id
    AND coa.account_code = '210206'
    AND apa.field_mapping IS NULL;

  UPDATE accounting_purpose_accounts apa
  SET field_mapping = 'bill_discount'
  FROM chart_of_accounts coa
  WHERE apa.account_id = coa.id
    AND apa.purpose_id = v_purpose_id
    AND coa.account_code = '410301'
    AND apa.field_mapping IS NULL;

  -- Insert new SAL-INV purpose account mappings
  INSERT INTO accounting_purpose_accounts (
    company_id, purpose_id, account_id, side, priority,
    field_mapping, is_required, is_auto, is_active, created_by, updated_by
  )
  SELECT
    v_company_id, v_purpose_id, coa.id,
    m.side::varchar, m.priority, m.field_mapping,
    true, true, true,
    '8a130a3e-0490-48b9-abe5-769af0dee345',
    '8a130a3e-0490-48b9-abe5-769af0dee345'
  FROM (VALUES
    ('210209', 'CREDIT', 3, 'service_charge_payable'),
    ('210210', 'CREDIT', 4, 'other_vat_payable'),
    ('410202', 'CREDIT', 5, 'order_fee_revenue'),
    ('410203', 'CREDIT', 6, 'delivery_revenue'),
    ('410304', 'DEBIT',  3, 'promotion_discount'),
    ('410305', 'DEBIT',  4, 'voucher_discount'),
    ('610801', 'DEBIT',  5, 'rounding_expense')
  ) AS m(account_code, side, priority, field_mapping)
  JOIN chart_of_accounts coa
    ON coa.account_code = m.account_code
    AND coa.company_id = v_company_id
    AND coa.deleted_at IS NULL
  ON CONFLICT DO NOTHING;
END $$;
