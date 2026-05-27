-- ============================================================
-- SEED: SAL-INV Accounting Purpose (Sales Invoice)
-- Used by POS journals processor and sales invoice flows.
-- Ensures the purpose exists and is active for each company.
-- ============================================================

-- 1) Insert missing SAL-INV purpose per company
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
  'SAL-INV' AS purpose_code,
  'Sales Invoice' AS purpose_name,
  'Penjualan makanan dan minuman' AS description,
  'SALES' AS applied_to,
  true AS is_system,
  true AS is_active,
  NOW() AS created_at,
  NOW() AS updated_at
FROM companies c
WHERE NOT EXISTS (
  SELECT 1
  FROM accounting_purposes ap
  WHERE ap.company_id = c.id
    AND ap.purpose_code = 'SAL-INV'
)
ON CONFLICT DO NOTHING;

-- 2) If a system SAL-INV exists but inactive, activate it (safe for system defaults)
UPDATE accounting_purposes ap
SET is_active = true,
    updated_at = NOW()
WHERE ap.purpose_code = 'SAL-INV'
  AND ap.is_system = true
  AND ap.is_active = false
  AND (ap.is_deleted IS NULL OR ap.is_deleted = false);

