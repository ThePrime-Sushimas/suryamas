-- Menu Branch Prices: per-branch selling price for menus
CREATE TABLE menu_branch_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id),
  selling_price NUMERIC(20,4) NOT NULL,
  price_type VARCHAR(20) NOT NULL DEFAULT 'DINE_IN'
    CHECK (price_type IN ('DINE_IN', 'DELIVERY', 'TAKEAWAY')),
  source VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
    CHECK (source IN ('MANUAL', 'POS_SYNC', 'IMPORT')),
  synced_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth_users(id),
  updated_by UUID REFERENCES auth_users(id),
  deleted_at TIMESTAMPTZ
);

-- CRITICAL: DB-level uniqueness — 1 active price per menu + branch + price_type
CREATE UNIQUE INDEX idx_menu_branch_prices_unique_active
  ON menu_branch_prices(menu_id, branch_id, price_type)
  WHERE is_deleted = false;

CREATE INDEX idx_menu_branch_prices_company ON menu_branch_prices(company_id) WHERE is_deleted = false;
CREATE INDEX idx_menu_branch_prices_branch ON menu_branch_prices(branch_id) WHERE is_deleted = false;
CREATE INDEX idx_menu_branch_prices_menu ON menu_branch_prices(menu_id) WHERE is_deleted = false;
