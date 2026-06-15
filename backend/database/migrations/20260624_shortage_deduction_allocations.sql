-- Division-based shortage deduction allocations

ALTER TABLE variance_classification_lines
  ADD COLUMN IF NOT EXISTS deduction_mode VARCHAR(20)
    CHECK (deduction_mode IS NULL OR deduction_mode IN ('INDIVIDUAL', 'DIVISION'));

CREATE TABLE IF NOT EXISTS shortage_deduction_allocations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vcl_id                UUID NOT NULL REFERENCES variance_classification_lines(id) ON DELETE CASCADE,
  employee_id           UUID NOT NULL REFERENCES employees(id),
  department_id         UUID REFERENCES departments(id),
  allocation_amount     NUMERIC(15, 2) NOT NULL CHECK (allocation_amount >= 0),
  notes                 TEXT,
  deduction_paid_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vcl_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_sda_vcl ON shortage_deduction_allocations(vcl_id);
CREATE INDEX IF NOT EXISTS idx_sda_employee ON shortage_deduction_allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_sda_department ON shortage_deduction_allocations(department_id);
