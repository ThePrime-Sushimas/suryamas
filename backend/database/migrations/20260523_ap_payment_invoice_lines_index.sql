-- Index for ap_payment_invoice_lines to speed up EXISTS subqueries in due_date filter
CREATE INDEX IF NOT EXISTS idx_ap_payment_invoice_lines_ap_payment_id
  ON ap_payment_invoice_lines(ap_payment_id);

CREATE INDEX IF NOT EXISTS idx_ap_payment_invoice_lines_purchase_invoice_id
  ON ap_payment_invoice_lines(purchase_invoice_id);
