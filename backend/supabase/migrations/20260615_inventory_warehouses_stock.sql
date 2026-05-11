-- ============================================================================
-- INVENTORY SYSTEM V2 — Phase 2A: Warehouses & Stock Foundation
-- ============================================================================

-- 1. Create Central Stock & Central Kitchen as branches
-- Dynamic: get first active company instead of hardcoding
INSERT INTO branches (id, company_id, branch_code, branch_name, status, address, city, province, country, jam_buka, jam_tutup, hari_operasional, created_by)
SELECT gen_random_uuid(), c.id, 'CENTRAL_STOCK', 'Central Stock', 'active', '-', '-', '-', 'Indonesia', '08:00', '17:00', '["Senin","Selasa","Rabu","Kamis","Jumat"]'::jsonb, NULL
FROM companies c WHERE c.status = 'active' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO branches (id, company_id, branch_code, branch_name, status, address, city, province, country, jam_buka, jam_tutup, hari_operasional, created_by)
SELECT gen_random_uuid(), c.id, 'CENTRAL_KITCHEN', 'Central Kitchen', 'active', '-', '-', '-', 'Indonesia', '08:00', '17:00', '["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"]'::jsonb, NULL
FROM companies c WHERE c.status = 'active' LIMIT 1
ON CONFLICT DO NOTHING;

-- 2. Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  warehouse_code  VARCHAR(30) NOT NULL,
  warehouse_name  VARCHAR(100) NOT NULL,
  warehouse_type  VARCHAR(20) NOT NULL DEFAULT 'MAIN'
                    CHECK (warehouse_type IN ('MAIN', 'READY', 'CENTRAL_STOCK', 'CENTRAL_KITCHEN')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  UNIQUE(company_id, warehouse_code)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_company ON warehouses(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_warehouses_branch ON warehouses(branch_id) WHERE deleted_at IS NULL;

-- 3. Create stock_balances table
CREATE TABLE IF NOT EXISTS stock_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  qty             NUMERIC(20,4) NOT NULL DEFAULT 0,
  avg_cost        NUMERIC(20,4) NOT NULL DEFAULT 0,
  last_movement_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_warehouse ON stock_balances(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_product ON stock_balances(product_id);

-- 4. Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  movement_type   VARCHAR(20) NOT NULL
                    CHECK (movement_type IN (
                      'IN_PURCHASE', 'IN_TRANSFER', 'IN_RETURN', 'IN_PRODUCTION',
                      'IN_ADJUSTMENT', 'IN_OPENING',
                      'OUT_TRANSFER', 'OUT_LOAN', 'OUT_DAILY', 'OUT_ADJUSTMENT',
                      'OUT_WASTE', 'OUT_PRODUCTION'
                    )),
  qty             NUMERIC(20,4) NOT NULL,
  cost_per_unit   NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(20,4) NOT NULL DEFAULT 0,
  balance_after   NUMERIC(20,4) NOT NULL DEFAULT 0,
  reference_type  VARCHAR(30),
  reference_id    UUID,
  notes           TEXT,
  movement_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- 5. Alter products — add inventory columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS yield_factor NUMERIC(5,4) DEFAULT 1.0000;
ALTER TABLE products ADD COLUMN IF NOT EXISTS risk_category VARCHAR(10) DEFAULT 'LOW';
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_source VARCHAR(20) DEFAULT 'SUPPLIER';

-- Add CHECK constraints (only if not exists — wrap in DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_risk_category') THEN
    ALTER TABLE products ADD CONSTRAINT chk_products_risk_category
      CHECK (risk_category IN ('HIGH', 'MEDIUM', 'LOW'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_default_source') THEN
    ALTER TABLE products ADD CONSTRAINT chk_products_default_source
      CHECK (default_source IN ('SUPPLIER', 'CENTRAL_STOCK', 'CENTRAL_KITCHEN'));
  END IF;
END $$;

-- 6. Seed warehouses for existing branches (dynamic company lookup)
-- MAIN + READY for each operational branch
INSERT INTO warehouses (company_id, branch_id, warehouse_code, warehouse_name, warehouse_type)
SELECT
  b.company_id,
  b.id,
  b.branch_code || '-MAIN',
  'Gudang Utama ' || b.branch_name,
  'MAIN'
FROM branches b
WHERE b.branch_code NOT IN ('CENTRAL_STOCK', 'CENTRAL_KITCHEN')
  AND b.status = 'active'
ON CONFLICT (company_id, warehouse_code) DO NOTHING;

INSERT INTO warehouses (company_id, branch_id, warehouse_code, warehouse_name, warehouse_type)
SELECT
  b.company_id,
  b.id,
  b.branch_code || '-READY',
  'Gudang Ready ' || b.branch_name,
  'READY'
FROM branches b
WHERE b.branch_code NOT IN ('CENTRAL_STOCK', 'CENTRAL_KITCHEN')
  AND b.status = 'active'
ON CONFLICT (company_id, warehouse_code) DO NOTHING;

-- Central Stock warehouse
INSERT INTO warehouses (company_id, branch_id, warehouse_code, warehouse_name, warehouse_type)
SELECT
  b.company_id,
  b.id,
  'CENTRAL-STOCK',
  'Central Stock',
  'CENTRAL_STOCK'
FROM branches b
WHERE b.branch_code = 'CENTRAL_STOCK'
ON CONFLICT (company_id, warehouse_code) DO NOTHING;

-- Central Kitchen warehouse
INSERT INTO warehouses (company_id, branch_id, warehouse_code, warehouse_name, warehouse_type)
SELECT
  b.company_id,
  b.id,
  'CENTRAL-KITCHEN',
  'Central Kitchen',
  'CENTRAL_KITCHEN'
FROM branches b
WHERE b.branch_code = 'CENTRAL_KITCHEN'
ON CONFLICT (company_id, warehouse_code) DO NOTHING;

-- 7. Partial index for fast opening balance duplicate check
CREATE INDEX IF NOT EXISTS idx_stock_movements_opening
  ON stock_movements(warehouse_id, product_id)
  WHERE movement_type = 'IN_OPENING';
