-- Migration: create_reconciliation_logs.sql
-- Create table for tracking reconciliation actions

CREATE TABLE IF NOT EXISTS bank_reconciliation_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(50) NOT NULL, -- 'MANUAL_RECONCILE', 'AUTO_MATCH', 'UNDO'
  statement_id BIGINT,
  aggregate_id VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_company ON bank_reconciliation_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_statement ON bank_reconciliation_logs(statement_id);

COMMENT ON TABLE bank_reconciliation_logs IS 'Audit logs for bank reconciliation activities';
