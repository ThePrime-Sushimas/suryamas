-- Add preferred_vendor_bank_account_id to general_invoice_templates
-- Allows templates to store which vendor bank account is preferred for payment.
-- If NULL, the vendor's single bank info from vendors table can be used instead.

ALTER TABLE general_invoice_templates
ADD COLUMN preferred_vendor_bank_account_id INT REFERENCES bank_accounts(id);

COMMENT ON COLUMN general_invoice_templates.preferred_vendor_bank_account_id
IS 'Preferred vendor bank account to use when generating invoice. Null = use vendor default.';