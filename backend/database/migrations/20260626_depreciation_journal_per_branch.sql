-- ============================================================
-- Migration: Split depreciation journal per branch
-- 
-- Previously, depreciation created a single consolidated journal
-- without branch_id. Now it creates one journal per branch so that
-- balance sheet correctly reflects assets per branch.
--
-- Also changes journal_id (single) → journal_ids (array) on runs.
-- ============================================================

-- 1. Add new column
ALTER TABLE asset_depreciation_runs
  ADD COLUMN journal_ids UUID[] DEFAULT '{}';

-- 2. Migrate existing data (single journal_id → array)
UPDATE asset_depreciation_runs
SET journal_ids = ARRAY[journal_id]
WHERE journal_id IS NOT NULL;

-- 3. Drop old column
ALTER TABLE asset_depreciation_runs
  DROP COLUMN journal_id;

-- 4. Same for reversal: support multiple reversal journals
ALTER TABLE asset_depreciation_runs
  ADD COLUMN reversal_journal_ids UUID[] DEFAULT '{}';

UPDATE asset_depreciation_runs
SET reversal_journal_ids = ARRAY[reversal_journal_id]
WHERE reversal_journal_id IS NOT NULL;

ALTER TABLE asset_depreciation_runs
  DROP COLUMN reversal_journal_id;

-- ============================================================
-- Add journal_posted tracking to asset_transfers
-- Allows detection of failed journal posting for manual repair.
-- ============================================================

ALTER TABLE asset_transfers
  ADD COLUMN journal_posted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN source_journal_id UUID REFERENCES journal_headers(id),
  ADD COLUMN target_journal_id UUID REFERENCES journal_headers(id);
