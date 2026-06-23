-- ============================================================
-- Migration: Multi-attachment support for general invoices
-- Replaces single attachment_url column (which remains for legacy data)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.general_invoice_attachments (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL,
  file_url      text NOT NULL,
  file_name     varchar(255),
  file_size     integer,
  mime_type     varchar(100),
  description   text,
  uploaded_by   uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT gen_inv_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT gen_inv_attachments_invoice_fkey FOREIGN KEY (invoice_id)
    REFERENCES public.general_invoices (id) ON DELETE CASCADE,
  CONSTRAINT gen_inv_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by)
    REFERENCES public.auth_users (id)
);

CREATE INDEX IF NOT EXISTS idx_gen_inv_attachments_invoice
  ON public.general_invoice_attachments (invoice_id);
