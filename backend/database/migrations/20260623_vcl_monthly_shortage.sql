-- Monthly opname negative selisih → shortage report (not direct waste)

ALTER TABLE variance_classification_lines
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'DAILY_OPNAME'
    CHECK (source_type IN ('DAILY_OPNAME', 'MONTHLY_OPNAME')),
  ADD COLUMN IF NOT EXISTS monthly_opname_id UUID REFERENCES monthly_stock_opname(id),
  ADD COLUMN IF NOT EXISTS monthly_opname_line_id UUID REFERENCES monthly_stock_opname_lines(id),
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

ALTER TABLE variance_classification_lines
  ALTER COLUMN closing_id DROP NOT NULL,
  ALTER COLUMN line_id DROP NOT NULL;

ALTER TABLE variance_classification_lines
  DROP CONSTRAINT IF EXISTS vcl_source_check;

ALTER TABLE variance_classification_lines
  ADD CONSTRAINT vcl_source_check CHECK (
    (source_type = 'DAILY_OPNAME' AND closing_id IS NOT NULL AND line_id IS NOT NULL)
    OR (source_type = 'MONTHLY_OPNAME' AND monthly_opname_id IS NOT NULL AND monthly_opname_line_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_vcl_monthly_line_shortage
  ON variance_classification_lines(monthly_opname_line_id)
  WHERE source_type = 'MONTHLY_OPNAME' AND variance_category = 'SHORTAGE';

CREATE INDEX IF NOT EXISTS idx_vcl_monthly_opname
  ON variance_classification_lines(monthly_opname_id)
  WHERE monthly_opname_id IS NOT NULL;

ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS source_monthly_opname_id UUID REFERENCES monthly_stock_opname(id);
