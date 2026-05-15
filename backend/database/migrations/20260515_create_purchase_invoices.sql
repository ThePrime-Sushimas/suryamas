-- Purchase Invoices module

-- Header
CREATE TABLE purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED')),
  notes TEXT,
  rejection_reason TEXT,
  subtotal NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_tax NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  submitted_by UUID REFERENCES auth_users(id),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth_users(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth_users(id),
  rejected_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth_users(id),
  posted_at TIMESTAMPTZ,
  journal_id UUID REFERENCES journal_headers(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth_users(id),
  updated_by UUID REFERENCES auth_users(id),
  UNIQUE(company_id, supplier_id, invoice_number)
);

CREATE INDEX idx_purchase_invoices_company ON purchase_invoices(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_invoices_supplier ON purchase_invoices(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_invoices_status ON purchase_invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_invoices_branch ON purchase_invoices(branch_id) WHERE deleted_at IS NULL;

-- Link GR ke invoice (many-to-many)
CREATE TABLE purchase_invoice_gr_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth_users(id),
  updated_by UUID REFERENCES auth_users(id),
  UNIQUE(purchase_invoice_id, goods_receipt_id)
);

CREATE INDEX idx_pi_gr_links_invoice ON purchase_invoice_gr_links(purchase_invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pi_gr_links_gr ON purchase_invoice_gr_links(goods_receipt_id) WHERE deleted_at IS NULL;

-- Lines
CREATE TABLE purchase_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  gr_line_id UUID NOT NULL REFERENCES goods_receipt_lines(id),
  product_id UUID NOT NULL REFERENCES products(id),
  qty_received NUMERIC(20,4) NOT NULL,
  qty_invoiced NUMERIC(20,4) NOT NULL,
  unit_price NUMERIC(20,4) NOT NULL DEFAULT 0,
  subtotal NUMERIC(20,4) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  total NUMERIC(20,4) NOT NULL DEFAULT 0,
  qty_po NUMERIC(20,4),
  unit_price_po NUMERIC(20,4),
  variance_qty NUMERIC(20,4) NOT NULL DEFAULT 0,
  variance_price NUMERIC(20,4) NOT NULL DEFAULT 0,
  match_status VARCHAR(10) NOT NULL DEFAULT 'MATCH'
    CHECK (match_status IN ('MATCH', 'OVER', 'UNDER')),
  sort_order INT NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth_users(id),
  updated_by UUID REFERENCES auth_users(id)
);

CREATE INDEX idx_pi_lines_invoice ON purchase_invoice_lines(purchase_invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pi_lines_gr_line ON purchase_invoice_lines(gr_line_id) WHERE deleted_at IS NULL;

-- Kolom baru di goods_receipt_lines untuk partial invoice tracking
ALTER TABLE goods_receipt_lines
  ADD COLUMN IF NOT EXISTS qty_invoiced NUMERIC(20,4) NOT NULL DEFAULT 0;

