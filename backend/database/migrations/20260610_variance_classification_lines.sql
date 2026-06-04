-- ============================================================================
-- VARIANCE CLASSIFICATION LINES — Database Migration
-- Creates table for classifying negative variance into waste/shortage categories
-- Adds classification_version column to daily_closing_counts
-- ============================================================================

-- 1. Create variance_classification_lines table
CREATE TABLE IF NOT EXISTS variance_classification_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id            UUID NOT NULL REFERENCES daily_closing_counts(id),
  line_id               UUID NOT NULL REFERENCES daily_closing_count_lines(id),
  variance_category     VARCHAR(20) NOT NULL CHECK (variance_category IN ('WASTE', 'SHORTAGE')),
  qty                   NUMERIC(20,4) NOT NULL CHECK (qty > 0),
  shortage_assigned_to  UUID REFERENCES employees(user_id),
  shortage_note         TEXT,
  classified_by         UUID NOT NULL,
  classified_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  branch_id             UUID NOT NULL REFERENCES branches(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_vcl_closing ON variance_classification_lines(closing_id);
CREATE INDEX IF NOT EXISTS idx_vcl_line ON variance_classification_lines(line_id);
CREATE INDEX IF NOT EXISTS idx_vcl_assigned ON variance_classification_lines(shortage_assigned_to)
  WHERE variance_category = 'SHORTAGE';

-- 3. Add classification_version column to daily_closing_counts
ALTER TABLE daily_closing_counts ADD COLUMN IF NOT EXISTS classification_version INTEGER NOT NULL DEFAULT 0;
