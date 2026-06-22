-- Migration: Add group alert support to payment_method_alert_history
-- Allows logging history for combined/grouped payment method alerts

-- 1. Make payment_method_id nullable (group alerts don't have a single PM)
ALTER TABLE payment_method_alert_history
  ALTER COLUMN payment_method_id DROP NOT NULL;

-- 2. Add alert_group_id column
ALTER TABLE payment_method_alert_history
  ADD COLUMN IF NOT EXISTS alert_group_id UUID REFERENCES payment_method_alert_groups(id) ON DELETE SET NULL;

-- 3. Add alert_group_name for denormalized display (same pattern as payment_method_name)
ALTER TABLE payment_method_alert_history
  ADD COLUMN IF NOT EXISTS alert_group_name VARCHAR(255);

-- 4. Check constraint: exactly one of payment_method_id or alert_group_id must be non-null
ALTER TABLE payment_method_alert_history
  ADD CONSTRAINT chk_alert_history_source
  CHECK (
    (payment_method_id IS NOT NULL AND alert_group_id IS NULL)
    OR
    (payment_method_id IS NULL AND alert_group_id IS NOT NULL)
  );

-- 5. Index for group history lookups
CREATE INDEX IF NOT EXISTS idx_alert_history_group_id
  ON payment_method_alert_history(alert_group_id) WHERE alert_group_id IS NOT NULL;
