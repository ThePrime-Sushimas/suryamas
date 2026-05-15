-- Migration: Add Purchase Invoice Attachments
CREATE TABLE IF NOT EXISTS purchase_invoice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT, -- INVOICE, PHOTO_BARANG, etc
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id)
);

CREATE INDEX idx_pi_attachments_invoice ON purchase_invoice_attachments(purchase_invoice_id);
