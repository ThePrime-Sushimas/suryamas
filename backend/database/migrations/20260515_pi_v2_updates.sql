-- Migration: Purchase Invoice v2.0 Schema Updates
ALTER TABLE purchase_invoices 
  ADD COLUMN IF NOT EXISTS auto_generated_from_gr BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS merged_from_invoice_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rejection_note TEXT; -- Alias for rejection_reason if needed

-- Index for merge tracking
CREATE INDEX IF NOT EXISTS idx_pi_merged_ids ON purchase_invoices USING GIN (merged_from_invoice_ids);
