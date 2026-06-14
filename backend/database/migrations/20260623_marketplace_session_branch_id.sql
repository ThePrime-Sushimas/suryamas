-- Add branch_id to marketplace_checkout_sessions
-- Opsi A: single branch per session, filled from lines[0].branch_id on create

ALTER TABLE marketplace_checkout_sessions
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_mcs_branch ON marketplace_checkout_sessions(branch_id);

-- Backfill existing sessions from their first line's branch_id
UPDATE marketplace_checkout_sessions mcs
SET branch_id = sub.branch_id
FROM (
  SELECT DISTINCT ON (session_id) session_id, branch_id
  FROM marketplace_checkout_lines
  ORDER BY session_id, created_at ASC
) sub
WHERE sub.session_id = mcs.id
  AND mcs.branch_id IS NULL;
