-- ============================================================================
-- GOODS PROCESSING — Per-Line Status Refactor
-- ============================================================================

-- Step 1: Add status + tracking columns to goods_processing_inputs
ALTER TABLE goods_processing_inputs
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS processed_by UUID,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qc_confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS qc_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Step 2: Add CHECK constraint for line status
ALTER TABLE goods_processing_inputs DROP CONSTRAINT IF EXISTS goods_processing_inputs_status_check;
ALTER TABLE goods_processing_inputs ADD CONSTRAINT goods_processing_inputs_status_check
  CHECK (status IN ('PENDING', 'PROCESSING', 'QC_REVIEW', 'CONFIRMED', 'REJECTED', 'DONE'));

-- Step 3: Update header constraint to include PARTIAL
ALTER TABLE goods_processing DROP CONSTRAINT IF EXISTS goods_processing_status_check;
ALTER TABLE goods_processing ADD CONSTRAINT goods_processing_status_check
  CHECK (status IN ('DRAFT', 'PROCESSING', 'PARTIAL', 'QC_REVIEW', 'CONFIRMED', 'REJECTED'));

-- Step 4: Migrate existing data - set line status from header status
UPDATE goods_processing_inputs gpi SET status = 
  CASE 
    WHEN gp.status = 'DRAFT' THEN 'PENDING'
    WHEN gp.status = 'PROCESSING' THEN 'PROCESSING'
    WHEN gp.status = 'QC_REVIEW' THEN 'QC_REVIEW'
    WHEN gp.status = 'CONFIRMED' THEN 'CONFIRMED'
    WHEN gp.status = 'REJECTED' THEN 'REJECTED'
    ELSE 'PENDING'
  END
FROM goods_processing gp WHERE gp.id = gpi.goods_processing_id;

-- Step 5: Index for line status queries
CREATE INDEX IF NOT EXISTS idx_gp_inputs_status ON goods_processing_inputs(status);

-- ============================================================================
-- DONE
-- ============================================================================