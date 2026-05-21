-- ============================================================
-- Migration: AP Payments Module
-- Pembayaran hutang dagang (multi-invoice, partial pay)
-- ============================================================

CREATE TABLE ap_payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id),
  branch_id               UUID NOT NULL REFERENCES branches(id),
  payment_number          TEXT NOT NULL,
  supplier_id             UUID NOT NULL REFERENCES suppliers(id),
  bank_account_id         INTEGER NOT NULL REFERENCES bank_accounts(id),
  payment_method          TEXT NOT NULL CHECK (
                            payment_method IN ('TRANSFER', 'CASH', 'CHECK', 'GIRO')
                          ),
  total_amount            NUMERIC(20,4) NOT NULL CHECK (total_amount > 0),
  payment_date            DATE,
  notes                   TEXT,
  rejection_reason        TEXT,

  status                  TEXT NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN (
                            'DRAFT',
                            'PENDING_APPROVAL',
                            'APPROVED',
                            'REJECTED',
                            'PAID',
                            'RECONCILED'
                          )),

  -- Bukti bayar
  proof_url               TEXT,
  proof_uploaded_at       TIMESTAMPTZ,
  proof_uploaded_by       UUID REFERENCES auth_users(id),

  -- Approval audit
  requested_by            UUID REFERENCES auth_users(id),
  requested_at            TIMESTAMPTZ,
  approved_by             UUID REFERENCES auth_users(id),
  approved_at             TIMESTAMPTZ,
  rejected_by             UUID REFERENCES auth_users(id),
  rejected_at             TIMESTAMPTZ,
  paid_by                 UUID REFERENCES auth_users(id),
  paid_at                 TIMESTAMPTZ,

  -- Rekonsiliasi
  bank_statement_id       BIGINT REFERENCES bank_statements(id),
  journal_id              UUID REFERENCES journal_headers(id),
  reconciled_at           TIMESTAMPTZ,
  reconciled_by           UUID REFERENCES auth_users(id),

  -- Soft delete
  is_deleted              BOOLEAN NOT NULL DEFAULT false,
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID REFERENCES auth_users(id),
  updated_by              UUID REFERENCES auth_users(id),

  UNIQUE(company_id, payment_number)
);

CREATE TABLE ap_payment_invoice_lines (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ap_payment_id           UUID NOT NULL REFERENCES ap_payments(id) ON DELETE CASCADE,
  purchase_invoice_id     UUID NOT NULL REFERENCES purchase_invoices(id),
  amount_paid             NUMERIC(20,4) NOT NULL CHECK (amount_paid > 0),
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(ap_payment_id, purchase_invoice_id)
);

-- Indexes
CREATE INDEX idx_ap_payments_company
  ON ap_payments(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_ap_payments_supplier
  ON ap_payments(supplier_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_ap_payments_branch
  ON ap_payments(branch_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_ap_payments_status
  ON ap_payments(status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_ap_payments_payment_number
  ON ap_payments(company_id, payment_number)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_ap_payments_bank_stmt
  ON ap_payments(bank_statement_id)
  WHERE bank_statement_id IS NOT NULL;

CREATE INDEX idx_ap_payment_lines_invoice
  ON ap_payment_invoice_lines(purchase_invoice_id);

CREATE INDEX idx_ap_payment_lines_payment
  ON ap_payment_invoice_lines(ap_payment_id);

-- Triggers
CREATE TRIGGER ap_payments_updated_at
  BEFORE UPDATE ON ap_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER ap_payment_invoice_lines_updated_at
  BEFORE UPDATE ON ap_payment_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
