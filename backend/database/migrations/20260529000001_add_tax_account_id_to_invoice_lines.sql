-- Migration: Add tax_account_id to general_invoice_lines and general_invoice_template_lines
-- Purpose: Allow tax amounts to be posted to a separate tax account (e.g. PPN Masukan)
-- If tax_account_id is NULL, tax is bundled into the main account (current behavior).

ALTER TABLE general_invoice_lines
  ADD COLUMN tax_account_id uuid REFERENCES chart_of_accounts(id);

COMMENT ON COLUMN general_invoice_lines.tax_account_id IS
  'Optional COA for tax (e.g. PPN Masukan 1106xx). If NULL, tax is included in the main account debit.';

-- Also add to template lines so templates can pre-configure the tax account
ALTER TABLE general_invoice_template_lines
  ADD COLUMN tax_account_id uuid REFERENCES chart_of_accounts(id);

COMMENT ON COLUMN general_invoice_template_lines.tax_account_id IS
  'Optional default COA for tax when generating invoices from this template.';
