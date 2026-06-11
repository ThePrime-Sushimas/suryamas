-- ============================================================================
-- Monthly Stock Opname Tables
-- ============================================================================

-- Header SO bulanan
CREATE TABLE IF NOT EXISTS monthly_stock_opname (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  opname_number varchar(50),
  opname_date date NOT NULL,
  scope varchar(20) NOT NULL DEFAULT 'ALL_PRODUCTS'
    CHECK (scope IN ('ALL_PRODUCTS', 'BY_POSITION')),
  position_id uuid REFERENCES positions(id),
  status varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'REOPENED')),
  pic_user_id uuid NOT NULL,
  snapshot_taken_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid,
  reopened_at timestamptz,
  reopened_by uuid,
  notes text,
  total_lines integer NOT NULL DEFAULT 0,
  completed_lines integer NOT NULL DEFAULT 0,
  total_selisih_value numeric(20,4) NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- Lines SO bulanan
CREATE TABLE IF NOT EXISTS monthly_stock_opname_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id uuid NOT NULL REFERENCES monthly_stock_opname(id),
  product_id uuid NOT NULL,
  product_code varchar(50),
  product_name varchar(200),
  uom varchar(50),
  snapshot_qty numeric(20,4) NOT NULL DEFAULT 0,
  movement_during_so numeric(20,4) NOT NULL DEFAULT 0,
  expected_qty numeric(20,4) NOT NULL DEFAULT 0,
  actual_qty numeric(20,4),
  selisih_qty numeric(20,4),
  selisih_value numeric(20,4),
  cost_per_unit numeric(20,4) NOT NULL DEFAULT 0,
  investigasi_note text,
  photo_url text,
  out_movement_id uuid,
  in_movement_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reopen requests
CREATE TABLE IF NOT EXISTS monthly_opname_reopen_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id uuid NOT NULL REFERENCES monthly_stock_opname(id),
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  responded_by uuid,
  responded_at timestamptz,
  response_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monthly_stock_opname_branch_date ON monthly_stock_opname (branch_id, opname_date);
CREATE INDEX IF NOT EXISTS idx_monthly_stock_opname_warehouse_status ON monthly_stock_opname (warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_monthly_stock_opname_lines_opname ON monthly_stock_opname_lines (opname_id);
CREATE INDEX IF NOT EXISTS idx_monthly_opname_reopen_opname ON monthly_opname_reopen_requests (opname_id);

-- Unique constraint: one opname per branch+warehouse+date+position (excluding deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_stock_opname_unique_session
  ON monthly_stock_opname (branch_id, warehouse_id, opname_date, COALESCE(position_id, '00000000-0000-0000-0000-000000000000'))
  WHERE is_deleted = false;
