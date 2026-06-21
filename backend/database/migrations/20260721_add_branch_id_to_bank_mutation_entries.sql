-- ============================================================
-- Migration: Add branch_id to bank_mutation_entries
-- Purpose: Enable branch-level filtering for bank mutation entries
--          Default: Central branch (for bank fees, interest, etc.)
-- ============================================================

-- 1. Add column
ALTER TABLE bank_mutation_entries ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- 2. Index (partial — only non-null, non-deleted)
CREATE INDEX IF NOT EXISTS idx_bme_branch_id
  ON bank_mutation_entries(branch_id)
  WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

-- 3. Backfill existing rows to Central branch
UPDATE bank_mutation_entries bme
SET branch_id = (
  SELECT b.id FROM branches b
  WHERE b.company_id = bme.company_id AND b.is_central = true
  LIMIT 1
)
WHERE bme.branch_id IS NULL;

-- 4. Comment
COMMENT ON COLUMN bank_mutation_entries.branch_id IS
  'Branch attribution for this mutation entry. Defaults to Central branch for company-wide items (bank fees, interest). Used for branch-level report filtering.';
