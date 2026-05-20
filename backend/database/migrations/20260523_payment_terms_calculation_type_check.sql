-- Ensure payment_terms.calculation_type allows monthly_immediate when a CHECK exists.
-- Safe if no constraint: DROP IF EXISTS is no-op; ADD defines allowed values.

ALTER TABLE payment_terms DROP CONSTRAINT IF EXISTS payment_terms_calculation_type_check;

ALTER TABLE payment_terms
  ADD CONSTRAINT payment_terms_calculation_type_check
  CHECK (
    calculation_type IN (
      'from_invoice',
      'from_delivery',
      'fixed_date',
      'fixed_date_immediate',
      'weekly',
      'monthly',
      'monthly_immediate'
    )
  );
