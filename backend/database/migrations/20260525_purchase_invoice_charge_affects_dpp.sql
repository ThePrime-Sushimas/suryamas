-- When affects_dpp is true on a DISCOUNT charge, goods VAT is recomputed from
-- (sum(line.subtotal) + sum(discount amounts)) at the uniform line tax rate,
-- then allocated back to lines proportionally. Requires all lines same tax_rate.

ALTER TABLE purchase_invoice_charges
  ADD COLUMN IF NOT EXISTS affects_dpp BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN purchase_invoice_charges.affects_dpp IS
  'True only for DISCOUNT: reduces aggregate goods DPP before VAT; line tax_amount reallocated (uniform PPN % across lines).';
