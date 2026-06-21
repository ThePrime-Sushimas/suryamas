-- Defense-in-depth: prevent duplicate depreciation runs for the same company+period.
-- Application logic already prevents this via idempotency check (findPostedRun) inside
-- a FOR UPDATE transaction, but this constraint provides a definitive DB-level guarantee
-- that no race condition can create duplicate posted runs.
--
-- Partial index: only applies to POSTED runs (allows multiple draft/cancelled runs if
-- that pattern is ever introduced). Matches the application check semantics exactly.

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_depr_runs_company_period_posted
  ON asset_depreciation_runs (company_id, fiscal_period_id)
  WHERE status = 'POSTED';
