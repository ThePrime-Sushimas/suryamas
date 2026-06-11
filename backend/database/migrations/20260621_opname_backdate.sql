-- ============================================================================
-- OPNAME BACKDATE SUPPORT
-- Adds is_backdate flag to daily_closing_counts.
-- Backdate sessions use the reopen approval flow:
-- DRAFT → auto-create reopen request → manager approves → REOPENED → user fills & confirms
-- ============================================================================

ALTER TABLE daily_closing_counts
  ADD COLUMN IF NOT EXISTS is_backdate BOOLEAN NOT NULL DEFAULT false;
