-- ============================================================
-- SEED: PC-DSB and PC-STL Accounting Purposes (Petty Cash)
-- PC-DSB: Pencairan dana kas kecil dari bank
-- PC-STL: Penutupan/settlement periode kas kecil
-- Ensures the purposes exist and are active for each company.
-- ============================================================

-- 1) Insert PC-DSB (Petty Cash Disburse) per company
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
  'PC-DSB' AS purpose_code,
  'Petty Cash Disburse' AS purpose_name,
  'Pencairan dana kas kecil dari bank' AS description,
  'CASH' AS applied_to,
  true AS is_system,
  true AS is_active,
  NOW() AS created_at,
  NOW() AS updated_at
FROM companies c
WHERE NOT EXISTS (
  SELECT 1
  FROM accounting_purposes ap
  WHERE ap.company_id = c.id
    AND ap.purpose_code = 'PC-DSB'
)
ON CONFLICT DO NOTHING;

-- 2) Insert PC-STL (Petty Cash Settlement) per company
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
  'PC-STL' AS purpose_code,
  'Petty Cash Settlement' AS purpose_name,
  'Penutupan periode kas kecil' AS description,
  'CASH' AS applied_to,
  true AS is_system,
  true AS is_active,
  NOW() AS created_at,
  NOW() AS updated_at
FROM companies c
WHERE NOT EXISTS (
  SELECT 1
  FROM accounting_purposes ap
  WHERE ap.company_id = c.id
    AND ap.purpose_code = 'PC-STL'
)
ON CONFLICT DO NOTHING;

-- 3) Activate if inactive (safe for system defaults)
UPDATE accounting_purposes
SET is_active = true,
    updated_at = NOW()
WHERE purpose_code IN ('PC-DSB', 'PC-STL')
  AND is_system = true
  AND is_active = false
  AND (is_deleted IS NULL OR is_deleted = false);
