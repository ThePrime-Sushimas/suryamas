-- ============================================================
-- SEED: GEN-AP-LIABILITY → COA mapping
-- COA Suryamas: 210300 = Cadangan Biaya Akrual (header)
--   210301–210314 sudah terpakai; General AP pakai 210315 baru.
-- ============================================================

-- Bersihkan mapping salah jika migrasi sebelumnya map ke 210303 (Utang Jasa Profesional)
DELETE FROM accounting_purpose_accounts apa
USING accounting_purposes ap, chart_of_accounts coa
WHERE apa.purpose_id = ap.id
  AND apa.account_id = coa.id
  AND ap.purpose_code = 'GEN-AP-LIABILITY'
  AND coa.account_code = '210303';

DO $$
DECLARE
  r RECORD;
  v_parent_id uuid;
  v_created_by uuid;
  v_coa_id uuid;
  v_account_code constant varchar := '210315';
  v_account_name constant varchar := 'Hutang Usaha Umum';
BEGIN
  FOR r IN
    SELECT ap.company_id, ap.id AS purpose_id
    FROM accounting_purposes ap
    WHERE ap.purpose_code = 'GEN-AP-LIABILITY'
      AND (ap.is_deleted IS NULL OR ap.is_deleted = false)
  LOOP
    -- Parent: 210300 Cadangan Biaya Akrual
    SELECT coa.id, coa.created_by
    INTO v_parent_id, v_created_by
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = '210300'
      AND coa.deleted_at IS NULL
    LIMIT 1;

    -- Fallback: parent dari sibling 210301/210302
    IF v_parent_id IS NULL THEN
      SELECT coa.parent_account_id, coa.created_by
      INTO v_parent_id, v_created_by
      FROM chart_of_accounts coa
      WHERE coa.company_id = r.company_id
        AND coa.account_code IN ('210302', '210301')
        AND coa.deleted_at IS NULL
      ORDER BY coa.account_code
      LIMIT 1;
    END IF;

    IF v_parent_id IS NULL THEN
      RAISE NOTICE 'GEN-AP-LIABILITY: skip company % — parent 210300 not found', r.company_id;
      CONTINUE;
    END IF;

    INSERT INTO chart_of_accounts (
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
      r.company_id,
      v_account_code,
      v_account_name,
      'LIABILITY',
      'CREDIT',
      false,
      true,
      true,
      v_parent_id,
      v_created_by
    )
    ON CONFLICT (company_id, account_code) DO NOTHING;

    SELECT coa.id
    INTO v_coa_id
    FROM chart_of_accounts coa
    WHERE coa.company_id = r.company_id
      AND coa.account_code = v_account_code
      AND coa.deleted_at IS NULL
    LIMIT 1;

    IF v_coa_id IS NULL THEN
      RAISE NOTICE 'GEN-AP-LIABILITY: skip company % — COA % not found after insert', r.company_id, v_account_code;
      CONTINUE;
    END IF;

    INSERT INTO accounting_purpose_accounts (
      company_id,
      purpose_id,
      account_id,
      side,
      priority,
      is_required,
      is_auto,
      is_active,
      created_by,
      updated_by
    )
    SELECT
      r.company_id,
      r.purpose_id,
      v_coa_id,
      'CREDIT',
      1,
      true,
      true,
      true,
      v_created_by,
      v_created_by
    WHERE NOT EXISTS (
      SELECT 1
      FROM accounting_purpose_accounts apa
      WHERE apa.company_id = r.company_id
        AND apa.purpose_id = r.purpose_id
        AND apa.deleted_at IS NULL
        AND apa.is_active = true
    );
  END LOOP;
END $$;
