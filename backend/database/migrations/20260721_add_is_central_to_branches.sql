-- ============================================================
-- Migration: Add is_central flag to branches
-- Purpose: Mark branches as "Central" for company-wide expenses
--          (admin bank, bunga, expense HO, etc.)
-- NOTE: Multiple Central branches per company ARE ALLOWED
-- ============================================================

-- 1. Add column
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_central BOOLEAN NOT NULL DEFAULT false;

-- 2. Comment
COMMENT ON COLUMN branches.is_central IS
  'true = branch ini menampung biaya umum company-wide (admin bank, bunga, expense HO). '
  'Boleh lebih dari 1 per company — user memilih via dropdown saat submit.';

-- 3. Seed: Set CENTRAL_STOCK as Central for SUSHIMAS
UPDATE branches SET is_central = true
WHERE id = 'd5acf3df-47b0-467b-a22b-d93493dddac2';
