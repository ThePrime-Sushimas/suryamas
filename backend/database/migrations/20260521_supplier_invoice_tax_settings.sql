-- Supplier invoice & tax defaults for Purchase Invoice auto-draft from GR
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS requires_invoice BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_bypass_reason VARCHAR(32),
  ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 11;

COMMENT ON COLUMN suppliers.requires_invoice IS 'When false, GR confirm skips auto PI draft';
COMMENT ON COLUMN suppliers.invoice_bypass_reason IS 'marketplace | cash | informal — only when requires_invoice is false';
COMMENT ON COLUMN suppliers.default_tax_rate IS 'Default PPN % for PI lines created from GR';
