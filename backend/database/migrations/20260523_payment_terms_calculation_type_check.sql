-- payment_terms.calculation_type: allow monthly_immediate.
--
-- Production / local DB uses constraint name chk_payment_terms_calculation_rules
-- (not payment_terms_calculation_type_check). Dropping only the wrong name leaves
-- the old CHECK in place and INSERT still fails.
--
-- If the original chk_payment_terms_calculation_rules enforced more than
-- calculation_type (e.g. payment_dates vs type), restore those rules after this
-- migration or merge manually (inspect: SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'chk_payment_terms_calculation_rules').

ALTER TABLE payment_terms DROP CONSTRAINT IF EXISTS chk_payment_terms_calculation_rules;
ALTER TABLE payment_terms DROP CONSTRAINT IF EXISTS payment_terms_calculation_type_check;

ALTER TABLE payment_terms
  ADD CONSTRAINT chk_payment_terms_calculation_rules
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
