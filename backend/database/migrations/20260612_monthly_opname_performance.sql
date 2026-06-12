-- ============================================================================
-- Migration: Monthly Stock Opname Performance Fixes
-- Date: 2026-06-12
-- ============================================================================

-- Composite index for stock_movements(warehouse_id, created_at) to speed up
-- the getNetMovementsSince() query used by monthly stock opname recalculate/confirm.
-- Without this index, the query scans all movements for a warehouse and filters
-- created_at in a sequential scan, taking 7-15+ seconds on large datasets.
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_created
  ON public.stock_movements(warehouse_id, created_at DESC);
