CREATE TABLE IF NOT EXISTS printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID REFERENCES branches(id),
  printer_name VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  port INTEGER NOT NULL DEFAULT 9100,
  paper_width INTEGER NOT NULL DEFAULT 80,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_printers_company ON printers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_printers_branch ON printers(branch_id) WHERE deleted_at IS NULL;
