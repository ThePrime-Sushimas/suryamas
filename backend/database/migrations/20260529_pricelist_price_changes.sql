-- PI → Pricelist auto-sync: immutable price history + pricelist source tracking

CREATE TABLE IF NOT EXISTS pricelist_price_changes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL REFERENCES companies(id),
  supplier_id              UUID NOT NULL REFERENCES suppliers(id),
  product_id               UUID NOT NULL REFERENCES products(id),
  uom_id                   UUID NOT NULL REFERENCES product_uoms(id),

  old_price                NUMERIC(20,4),
  new_price                NUMERIC(20,4) NOT NULL,
  change_amount            NUMERIC(20,4),
  change_pct               NUMERIC(8,2),

  effective_date           DATE NOT NULL,
  source                   VARCHAR(20) NOT NULL
    CHECK (source IN ('PI_POST', 'PI_UNPOST', 'MANUAL')),

  purchase_invoice_id      UUID REFERENCES purchase_invoices(id),
  purchase_invoice_line_id UUID REFERENCES purchase_invoice_lines(id),
  pricelist_id             UUID REFERENCES pricelists(id),

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID
);

CREATE INDEX IF NOT EXISTS idx_ppc_company_date
  ON pricelist_price_changes(company_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_ppc_supplier_product
  ON pricelist_price_changes(supplier_id, product_id, uom_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_ppc_pi
  ON pricelist_price_changes(purchase_invoice_id)
  WHERE purchase_invoice_id IS NOT NULL;

ALTER TABLE pricelists
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
    CHECK (source IN ('MANUAL', 'PI_POST', 'PI_UNPOST')),
  ADD COLUMN IF NOT EXISTS purchase_invoice_id UUID REFERENCES purchase_invoices(id);
