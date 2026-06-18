-- ============================================================
-- Migration: Asset Photos
-- Allows 1-5 photos per fixed asset, stored in R2 bucket 'asset-photos'
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS asset_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id),
  file_path     TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     INTEGER NOT NULL DEFAULT 0,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  uploaded_by   UUID REFERENCES auth_users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_photos_asset ON asset_photos(fixed_asset_id);
CREATE INDEX idx_asset_photos_company ON asset_photos(company_id);

COMMENT ON TABLE asset_photos IS 'Photos attached to fixed assets. Max 5 per asset, stored in R2 bucket asset-photos.';

COMMIT;
