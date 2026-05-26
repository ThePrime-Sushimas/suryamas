-- ============================================================
-- SEED: GEN-AP-LIABILITY Accounting Purpose
-- For General AP module — Hutang Usaha Umum (General AP Liability)
-- ============================================================

-- Insert the GEN-AP-LIABILITY accounting purpose for each company
-- This purpose is used by general-invoices module to:
-- 1. Credit the liability account when invoice is POSTED
-- 2. Debit the liability account when payment is marked PAID

INSERT INTO accounting_purposes (
    company_id,
    purpose_code,
    purpose_name,
    description,
    applied_to,
    is_system,
    is_active,
    created_at,
    updated_at
)
SELECT
    c.id AS company_id,
    'GEN-AP-LIABILITY' AS purpose_code,
    'General AP Liability' AS purpose_name,
    'Hutang Usaha Umum - Akun kewajiban untuk invoice dari vendor umum' AS description,
    'EXPENSE' AS applied_to,
    true AS is_system,
    true AS is_active,
    NOW() AS created_at,
    NOW() AS updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM accounting_purposes ap
    WHERE ap.company_id = c.id
    AND ap.purpose_code = 'GEN-AP-LIABILITY'
)
ON CONFLICT DO NOTHING;

-- Note: Each company needs to have a Liability/Payable account
-- mapped to this purpose via accounting_purpose_accounts table.
-- The mapping should be done through the accounting module UI or
-- a separate seed file specific to each company's COA setup.
