-- Shortage Report: resolve status, deduction tracking, convert-to-waste linkage

ALTER TABLE variance_classification_lines
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS resolve_status VARCHAR(30) NOT NULL DEFAULT 'UNRESOLVED'
    CHECK (resolve_status IN ('UNRESOLVED', 'RESOLVED', 'CONVERTED_TO_WASTE')),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth_users(id),
  ADD COLUMN IF NOT EXISTS resolved_notes TEXT,
  ADD COLUMN IF NOT EXISTS converted_sa_id UUID REFERENCES stock_adjustments(id),
  ADD COLUMN IF NOT EXISTS deducted_employee_id UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS deduction_notes TEXT,
  ADD COLUMN IF NOT EXISTS deduction_paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vcl_resolve_status
  ON variance_classification_lines(resolve_status)
  WHERE variance_category = 'SHORTAGE';
