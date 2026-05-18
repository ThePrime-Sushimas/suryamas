-- ============================================================
-- Migration: Product Output Templates + GP Output Return Flag
-- Date: 2026-05-17
-- ============================================================

-- ------------------------------------------------------------
-- 1. Output template per product
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_output_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  output_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  output_uom        TEXT NOT NULL,
  suggested_pct     NUMERIC(5,2) NULL
                      CHECK (suggested_pct > 0 AND suggested_pct <= 100),
  sort_order        INT NOT NULL DEFAULT 0,
  notes             TEXT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID NULL REFERENCES auth_users(id),
  UNIQUE (product_id, output_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_output_templates_product_id
  ON product_output_templates (product_id);

-- ------------------------------------------------------------
-- 2. Return-flag + condition columns on goods_processing_outputs
-- ------------------------------------------------------------
ALTER TABLE goods_processing_outputs
  ADD COLUMN IF NOT EXISTS condition_status TEXT NULL
    CHECK (condition_status IN ('OK','DAMAGED','SHORTAGE')),
  ADD COLUMN IF NOT EXISTS actual_qty NUMERIC(12,4) NULL,
  ADD COLUMN IF NOT EXISTS actual_uom TEXT NULL,
  ADD COLUMN IF NOT EXISTS flagged_for_return BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS return_resolved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS return_resolved_by UUID NULL
    REFERENCES auth_users(id);

-- ------------------------------------------------------------
-- 3. Partial index for fast return-item queries
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_gp_outputs_flagged_return
  ON goods_processing_outputs(flagged_for_return)
  WHERE flagged_for_return = true;