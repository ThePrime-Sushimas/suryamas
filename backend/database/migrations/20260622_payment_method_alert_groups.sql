-- Migration: Add payment method alert groups (combined thresholds)
-- Allows alerting on the combined total of multiple payment methods

CREATE TABLE IF NOT EXISTS payment_method_alert_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  payment_method_ids INT[] NOT NULL,
  threshold_amount NUMERIC(15,2) NOT NULL,
  telegram_chat_id VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_date DATE,
  last_triggered_amount NUMERIC(15,2) DEFAULT 0,
  created_by UUID REFERENCES auth_users(id),
  updated_by UUID REFERENCES auth_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pmag_company ON payment_method_alert_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_pmag_active ON payment_method_alert_groups(company_id, is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE payment_method_alert_groups IS 'Combined payment method alert thresholds - alerts when the sum of multiple payment methods exceeds a threshold';
COMMENT ON COLUMN payment_method_alert_groups.payment_method_ids IS 'Array of payment_method IDs whose daily totals are summed for threshold comparison';
