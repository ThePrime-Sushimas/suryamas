-- Migration: Create fiscal period closing snapshots (immutable, versioned)
--
-- Architecture:
-- 1 header table (metadata + summary) + 3 child tables (report line items)
-- All tables are immutable after INSERT, except header.is_latest which
-- toggles to false when a newer version is created.
--
-- Immutability enforced via BEFORE UPDATE triggers.

-- ============================================================
-- 1. HEADER TABLE
-- ============================================================

CREATE TABLE fiscal_period_closing_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_period_id      UUID NOT NULL REFERENCES fiscal_periods(id),
  company_id            UUID NOT NULL REFERENCES companies(id),
  version               INT NOT NULL,
  closing_journal_id    UUID REFERENCES journal_headers(id),
  is_latest             BOOLEAN NOT NULL DEFAULT true,
  net_income            NUMERIC(20,4) NOT NULL,
  total_revenue         NUMERIC(20,4) NOT NULL,
  total_expense         NUMERIC(20,4) NOT NULL,
  closed_by             UUID NOT NULL REFERENCES auth_users(id),
  closed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fiscal_period_id, version)
);

CREATE INDEX idx_closing_snapshots_period ON fiscal_period_closing_snapshots(fiscal_period_id);
CREATE INDEX idx_closing_snapshots_latest ON fiscal_period_closing_snapshots(fiscal_period_id, is_latest) WHERE is_latest = true;

-- ============================================================
-- 2. TRIAL BALANCE LINES
-- ============================================================

CREATE TABLE closing_snapshot_trial_balance_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id           UUID NOT NULL REFERENCES fiscal_period_closing_snapshots(id) ON DELETE CASCADE,
  account_id            UUID NOT NULL,
  account_code          VARCHAR(20) NOT NULL,
  account_name          TEXT NOT NULL,
  account_type          VARCHAR(20) NOT NULL,
  parent_account_code   VARCHAR(20),
  parent_account_name   TEXT,
  branch_id             UUID,
  branch_name           TEXT,
  currency              VARCHAR(3) NOT NULL DEFAULT 'IDR',
  opening_debit         NUMERIC(20,4) NOT NULL DEFAULT 0,
  opening_credit        NUMERIC(20,4) NOT NULL DEFAULT 0,
  period_debit          NUMERIC(20,4) NOT NULL DEFAULT 0,
  period_credit         NUMERIC(20,4) NOT NULL DEFAULT 0,
  closing_debit         NUMERIC(20,4) NOT NULL DEFAULT 0,
  closing_credit        NUMERIC(20,4) NOT NULL DEFAULT 0,
  pos_debit             NUMERIC(20,4) NOT NULL DEFAULT 0,
  pos_credit            NUMERIC(20,4) NOT NULL DEFAULT 0,
  bank_debit            NUMERIC(20,4) NOT NULL DEFAULT 0,
  bank_credit           NUMERIC(20,4) NOT NULL DEFAULT 0,
  other_debit           NUMERIC(20,4) NOT NULL DEFAULT 0,
  other_credit          NUMERIC(20,4) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshot_tb_lines_snapshot ON closing_snapshot_trial_balance_lines(snapshot_id);
CREATE INDEX idx_snapshot_tb_lines_account ON closing_snapshot_trial_balance_lines(account_id);

-- ============================================================
-- 3. INCOME STATEMENT LINES
-- ============================================================

CREATE TABLE closing_snapshot_income_statement_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id           UUID NOT NULL REFERENCES fiscal_period_closing_snapshots(id) ON DELETE CASCADE,
  account_id            UUID NOT NULL,
  account_code          VARCHAR(20) NOT NULL,
  account_name          TEXT NOT NULL,
  account_type          VARCHAR(20) NOT NULL, -- REVENUE or EXPENSE
  parent_account_id     UUID,
  parent_account_code   VARCHAR(20),
  parent_account_name   TEXT,
  group_label           TEXT,
  branch_id             UUID,
  branch_name           TEXT,
  currency              VARCHAR(3) NOT NULL DEFAULT 'IDR',
  debit_amount          NUMERIC(20,4) NOT NULL DEFAULT 0,
  credit_amount         NUMERIC(20,4) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshot_is_lines_snapshot ON closing_snapshot_income_statement_lines(snapshot_id);
CREATE INDEX idx_snapshot_is_lines_account ON closing_snapshot_income_statement_lines(account_id);

-- ============================================================
-- 4. BALANCE SHEET LINES
-- ============================================================

CREATE TABLE closing_snapshot_balance_sheet_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id           UUID NOT NULL REFERENCES fiscal_period_closing_snapshots(id) ON DELETE CASCADE,
  account_id            UUID NOT NULL,
  account_code          VARCHAR(20) NOT NULL,
  account_name          TEXT NOT NULL,
  account_type          VARCHAR(20) NOT NULL, -- ASSET, LIABILITY, EQUITY
  parent_account_id     UUID,
  parent_account_code   VARCHAR(20),
  parent_account_name   TEXT,
  group_label           TEXT,
  branch_id             UUID,
  branch_name           TEXT,
  currency              VARCHAR(3) NOT NULL DEFAULT 'IDR',
  debit_amount          NUMERIC(20,4) NOT NULL DEFAULT 0,
  credit_amount         NUMERIC(20,4) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshot_bs_lines_snapshot ON closing_snapshot_balance_sheet_lines(snapshot_id);
CREATE INDEX idx_snapshot_bs_lines_account ON closing_snapshot_balance_sheet_lines(account_id);

-- ============================================================
-- 5. IMMUTABILITY TRIGGERS
-- ============================================================

-- Header: only is_latest may change (dynamic comparison using jsonb)
CREATE OR REPLACE FUNCTION enforce_closing_snapshot_header_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Compare all columns EXCEPT is_latest using jsonb diff
  IF (to_jsonb(NEW) - 'is_latest') IS DISTINCT FROM (to_jsonb(OLD) - 'is_latest') THEN
    RAISE EXCEPTION 'fiscal_period_closing_snapshots is immutable except for is_latest column'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_closing_snapshot_header_immutability
  BEFORE UPDATE ON fiscal_period_closing_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION enforce_closing_snapshot_header_immutability();

-- Child tables: completely immutable (no UPDATE allowed)
CREATE OR REPLACE FUNCTION prevent_closing_snapshot_line_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Closing snapshot lines are immutable — UPDATE is not allowed'
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_tb_line_update
  BEFORE UPDATE ON closing_snapshot_trial_balance_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_closing_snapshot_line_update();

CREATE TRIGGER trg_prevent_is_line_update
  BEFORE UPDATE ON closing_snapshot_income_statement_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_closing_snapshot_line_update();

CREATE TRIGGER trg_prevent_bs_line_update
  BEFORE UPDATE ON closing_snapshot_balance_sheet_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_closing_snapshot_line_update();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE fiscal_period_closing_snapshots IS
  'Immutable versioned snapshots of financial reports at fiscal closing. '
  'Only is_latest column may be updated (toggled to false when a newer version is created).';

COMMENT ON TABLE closing_snapshot_trial_balance_lines IS
  'Trial balance line items frozen at closing time. Completely immutable.';

COMMENT ON TABLE closing_snapshot_income_statement_lines IS
  'Income statement line items frozen at closing time. Completely immutable.';

COMMENT ON TABLE closing_snapshot_balance_sheet_lines IS
  'Balance sheet line items frozen at closing time. Completely immutable.';
