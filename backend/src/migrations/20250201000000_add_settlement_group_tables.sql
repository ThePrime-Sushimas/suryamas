-- =====================================================
-- SETTLEMENT GROUP FEATURE MIGRATION SCRIPT
-- Bulk Settlement Reconciliation (Many Aggregates → 1 Bank Statement)
-- Run ini untuk production database
-- =====================================================

BEGIN TRANSACTION;

-- =====================================================
-- 1. Create bank_settlement_groups table
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_settlement_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  bank_statement_id bigint NOT NULL REFERENCES bank_statements(id),
  settlement_number VARCHAR(50) UNIQUE NOT NULL,
  settlement_date DATE NOT NULL,
  payment_method VARCHAR(50),
  bank_name VARCHAR(100),
  total_statement_amount DECIMAL(18,2) NOT NULL CHECK (total_statement_amount > 0),
  total_allocated_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  difference DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING', 'RECONCILED', 'DISCREPANCY', 'UNDO')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT chk_positive_statement_amount CHECK (total_statement_amount > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_settlement_company ON bank_settlement_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_settlement_statement ON bank_settlement_groups(bank_statement_id);
CREATE INDEX IF NOT EXISTS idx_bank_settlement_status ON bank_settlement_groups(status);
CREATE INDEX IF NOT EXISTS idx_bank_settlement_date ON bank_settlement_groups(settlement_date);
CREATE INDEX IF NOT EXISTS idx_bank_settlement_number ON bank_settlement_groups(settlement_number);
CREATE INDEX IF NOT EXISTS idx_bank_settlement_created ON bank_settlement_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_settlement_deleted ON bank_settlement_groups(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- 2. Create bank_settlement_aggregates table
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_settlement_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_group_id UUID NOT NULL REFERENCES bank_settlement_groups(id) ON DELETE CASCADE,
  aggregate_id UUID NOT NULL REFERENCES aggregated_transactions(id),
  branch_name VARCHAR(200),
  branch_code VARCHAR(50),
  allocated_amount DECIMAL(18,2) NOT NULL,
  original_amount DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(settlement_group_id, aggregate_id),
  CONSTRAINT chk_positive_allocated_amount CHECK (allocated_amount > 0),
  CONSTRAINT chk_positive_original_amount CHECK (original_amount > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_settlement_agg_group ON bank_settlement_aggregates(settlement_group_id);
CREATE INDEX IF NOT EXISTS idx_bank_settlement_agg_aggregate ON bank_settlement_aggregates(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_bank_settlement_agg_branch ON bank_settlement_aggregates(branch_name);
CREATE INDEX IF NOT EXISTS idx_bank_settlement_agg_created ON bank_settlement_aggregates(created_at);

-- =====================================================
-- 3. Auto-generate settlement number function
-- Format: SET-YYYYMMDD-XXX
-- =====================================================
CREATE OR REPLACE FUNCTION generate_settlement_number(p_settlement_date DATE)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_next_seq INTEGER;
  v_result VARCHAR(50);
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(settlement_number FROM '([0-9]+)$') AS INTEGER)),
    0
  ) + 1 INTO v_next_seq
  FROM bank_settlement_groups
  WHERE settlement_date = p_settlement_date;
  
  v_result := 'SET-' || TO_CHAR(p_settlement_date, 'YYYYMMDD') || '-' || LPAD(v_next_seq::TEXT, 3, '0');
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. Auto-update timestamps function
-- =====================================================
CREATE OR REPLACE FUNCTION update_bank_settlement_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bank_settlement_groups_updated_at ON bank_settlement_groups;
CREATE TRIGGER update_bank_settlement_groups_updated_at
BEFORE UPDATE ON bank_settlement_groups
FOR EACH ROW EXECUTE FUNCTION update_bank_settlement_groups_updated_at();

-- =====================================================
-- 5. Auto-generate settlement number on INSERT
-- =====================================================
CREATE OR REPLACE FUNCTION set_bank_settlement_number_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.settlement_number IS NULL THEN
    NEW.settlement_number := generate_settlement_number(NEW.settlement_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_bank_settlement_number ON bank_settlement_groups;
CREATE TRIGGER set_bank_settlement_number
BEFORE INSERT ON bank_settlement_groups
FOR EACH ROW EXECUTE FUNCTION set_bank_settlement_number_on_insert();

-- =====================================================
-- 6. Add foreign key constraint untuk bank_statement_id
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_bank_settlement_groups_bank_statement'
  ) THEN
    ALTER TABLE bank_settlement_groups
    ADD CONSTRAINT fk_bank_settlement_groups_bank_statement
    FOREIGN KEY (bank_statement_id)
    REFERENCES bank_statements(id);
  END IF;
END $$;

-- =====================================================
-- 7. Add foreign key constraint untuk aggregate_id
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_bank_settlement_aggregates_aggregate'
  ) THEN
    ALTER TABLE bank_settlement_aggregates
    ADD CONSTRAINT fk_bank_settlement_aggregates_aggregate
    FOREIGN KEY (aggregate_id)
    REFERENCES aggregated_transactions(id);
  END IF;
END $$;

COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (jika perlu undo)
-- =====================================================
-- BEGIN;
-- DROP TABLE IF EXISTS bank_settlement_aggregates CASCADE;
-- DROP TABLE IF EXISTS bank_settlement_groups CASCADE;
-- DROP FUNCTION IF EXISTS generate_settlement_number(DATE);
-- DROP FUNCTION IF EXISTS update_bank_settlement_groups_updated_at();
-- DROP FUNCTION IF EXISTS set_bank_settlement_number_on_insert();
-- COMMIT;
