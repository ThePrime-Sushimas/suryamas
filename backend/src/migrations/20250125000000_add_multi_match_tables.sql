-- =====================================================
-- MULTI-MATCH FEATURE MIGRATION SCRIPT
-- Run ini untuk production database
-- =====================================================

BEGIN TRANSACTION;

-- =====================================================
-- 1. Create bank_reconciliation_groups table
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_reconciliation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  aggregate_id UUID NOT NULL REFERENCES aggregated_transactions(id),
  total_bank_amount DECIMAL(18,2) NOT NULL,
  aggregate_amount DECIMAL(18,2) NOT NULL,
  difference DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  notes TEXT,
  reconciled_by VARCHAR(100),
  reconciled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_recon_groups_company ON bank_reconciliation_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_recon_groups_aggregate ON bank_reconciliation_groups(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_recon_groups_status ON bank_reconciliation_groups(status);
CREATE INDEX IF NOT EXISTS idx_recon_groups_created_at ON bank_reconciliation_groups(created_at DESC);

-- =====================================================
-- 2. Create bank_reconciliation_group_details table
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_reconciliation_group_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES bank_reconciliation_groups(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES bank_statements(id),
  amount DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, statement_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_recon_group_details_group ON bank_reconciliation_group_details(group_id);
CREATE INDEX IF NOT EXISTS idx_recon_group_details_statement ON bank_reconciliation_group_details(statement_id);

-- =====================================================
-- 3. Add column ke bank_statements
-- =====================================================
ALTER TABLE bank_statements
ADD COLUMN IF NOT EXISTS reconciliation_group_id UUID REFERENCES bank_reconciliation_groups(id);

-- =====================================================
-- 4. Add constraint untuk memastikan statement tidak double-matched
-- =====================================================
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_single_match') THEN
      ALTER TABLE bank_statements
      ADD CONSTRAINT check_single_match 
      CHECK (
        (reconciliation_id IS NULL AND reconciliation_group_id IS NULL) OR
        (reconciliation_id IS NOT NULL AND reconciliation_group_id IS NULL) OR
        (reconciliation_id IS NULL AND reconciliation_group_id IS NOT NULL)
      );
   END IF;
END $$;

-- =====================================================
-- 5. Add trigger untuk auto-update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_bank_reconciliation_groups_updated_at ON bank_reconciliation_groups;
CREATE TRIGGER update_bank_reconciliation_groups_updated_at 
BEFORE UPDATE ON bank_reconciliation_groups
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. Optimasi Tambahan untuk Production
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_recon_groups_compound ON bank_reconciliation_groups(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_unreconciled ON bank_statements(company_id, is_reconciled, transaction_date DESC) WHERE is_reconciled = false;
CREATE INDEX IF NOT EXISTS idx_recon_groups_active ON bank_reconciliation_groups(company_id, status) WHERE deleted_at IS NULL;

COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (jika perlu undo)
-- =====================================================
-- BEGIN;
-- DROP TABLE IF EXISTS bank_reconciliation_group_details CASCADE;
-- DROP TABLE IF EXISTS bank_reconciliation_groups CASCADE;
-- ALTER TABLE bank_statements DROP COLUMN IF EXISTS reconciliation_group_id;
-- ALTER TABLE bank_statements DROP CONSTRAINT IF EXISTS check_single_match;
-- COMMIT;

