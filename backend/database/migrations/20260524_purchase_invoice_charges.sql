-- Additional invoice-level charges (shipping, discounts, fees) with optional VAT per charge.
-- Line-item PPN stays on purchase_invoice_lines.
-- Header: total_amount = SUM(line.total) + SUM(charge.total);
--         total_tax = SUM(line.tax_amount) + SUM(charge.tax_amount);
--         subtotal = SUM(line.subtotal) only (goods);
--         total_charges = SUM(charge.total) (signed; discounts negative).

CREATE TABLE purchase_invoice_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  charge_type VARCHAR(20) NOT NULL
    CHECK (charge_type IN ('DISCOUNT', 'SHIPPING', 'ADMIN_FEE', 'OTHER')),
  description VARCHAR(255),
  amount NUMERIC(20,4) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  total NUMERIC(20,4) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth_users(id),
  updated_by UUID REFERENCES auth_users(id)
);

CREATE INDEX idx_pi_charges_invoice ON purchase_invoice_charges(purchase_invoice_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE purchase_invoice_charges IS 'Non-GR invoice adjustments: discount (negative amount), shipping, fees; tax optional per row.';
COMMENT ON COLUMN purchase_invoice_charges.amount IS 'Pre-tax amount; use negative for trade discounts when charge_type = DISCOUNT.';
COMMENT ON COLUMN purchase_invoice_charges.total IS 'amount + tax_amount (same sign as net effect on AP).';

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS total_charges NUMERIC(20,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN purchase_invoices.total_charges IS 'Sum of purchase_invoice_charges.total (incl. tax on charges); for display and quick checks.';
