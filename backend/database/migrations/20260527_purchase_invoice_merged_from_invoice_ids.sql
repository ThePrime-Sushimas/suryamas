-- Ensures PI merge tracking column exists.
-- Some databases never ran 20260515_pi_v2_updates.sql; merge uses this column in
-- purchase-invoices.repository.ts (updateMasterInvoiceAfterMerge).
ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS merged_from_invoice_ids UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_pi_merged_ids ON purchase_invoices USING GIN (merged_from_invoice_ids);
