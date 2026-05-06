-- Migration: Add payment method alert history table
-- File: migrations/20260506_add_payment_method_alert_history.sql

CREATE TABLE IF NOT EXISTS payment_method_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES payment_method_alerts(id) ON DELETE CASCADE,
  payment_method_id INT NOT NULL REFERENCES payment_methods(id),
  payment_method_name VARCHAR(255) NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  triggered_date DATE NOT NULL,
  triggered_amount NUMERIC(15,2) NOT NULL,
  threshold_amount NUMERIC(15,2) NOT NULL,
  branch_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  telegram_chat_id VARCHAR(50) NOT NULL,
  telegram_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_alert_history_alert_id ON payment_method_alert_history(alert_id);
CREATE INDEX idx_alert_history_company_date ON payment_method_alert_history(company_id, triggered_date DESC);
CREATE INDEX idx_alert_history_payment_method ON payment_method_alert_history(payment_method_id, triggered_date DESC);
CREATE INDEX idx_alert_history_triggered_date ON payment_method_alert_history(triggered_date DESC);

-- Add comment
COMMENT ON TABLE payment_method_alert_history IS 'History of all payment method alerts that have been sent';
COMMENT ON COLUMN payment_method_alert_history.branch_breakdown IS 'JSON array of branch totals: [{"branch_name": "...", "amount": 123.45}]';