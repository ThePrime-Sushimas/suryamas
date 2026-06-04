-- ============================================================================
-- OPNAME REOPEN REQUESTS — Database Migration
-- Creates opname_reopen_requests table for the reopen request-approval workflow.
-- Extends daily_closing_counts status CHECK to include REOPENED.
-- Extends stock_movements movement_type CHECK to include IN_REVERSAL/OUT_REVERSAL.
-- ============================================================================

-- 1. Create opname_reopen_requests table
CREATE TABLE IF NOT EXISTS opname_reopen_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id    UUID NOT NULL REFERENCES daily_closing_counts(id),
  requested_by  UUID NOT NULL REFERENCES users(id),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason        TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  responded_by  UUID REFERENCES users(id),
  responded_at  TIMESTAMPTZ,
  response_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes on opname_reopen_requests
CREATE INDEX IF NOT EXISTS idx_reopen_requests_closing_id ON opname_reopen_requests(closing_id);
CREATE INDEX IF NOT EXISTS idx_reopen_requests_status ON opname_reopen_requests(status);

-- 2b. Partial unique index to prevent concurrent PENDING requests for the same session
CREATE UNIQUE INDEX IF NOT EXISTS idx_reopen_requests_pending
  ON opname_reopen_requests(closing_id) WHERE status = 'PENDING';

-- 3. Extend daily_closing_counts status CHECK to include REOPENED
ALTER TABLE daily_closing_counts
  DROP CONSTRAINT IF EXISTS daily_closing_counts_status_check,
  ADD CONSTRAINT daily_closing_counts_status_check
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'FLAGGED', 'REOPENED'));

-- 4. Extend stock_movements movement_type CHECK to include IN_REVERSAL and OUT_REVERSAL
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check,
  ADD CONSTRAINT stock_movements_movement_type_check
    CHECK (movement_type IN (
      'IN_PURCHASE', 'IN_TRANSFER', 'IN_RETURN', 'IN_PRODUCTION',
      'IN_ADJUSTMENT', 'IN_OPENING', 'IN_REVERSAL',
      'OUT_TRANSFER', 'OUT_LOAN', 'OUT_DAILY', 'OUT_ADJUSTMENT',
      'OUT_WASTE', 'OUT_PRODUCTION', 'OUT_REVERSAL'
    ));
