-- Stock Transfers: inter-branch and intra-branch stock transfers
-- Supports both TRANSFER (central→branch, branch→branch) and LOAN (inter-branch loan)

CREATE TABLE stock_transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  transfer_number     VARCHAR(30) NOT NULL,
  transfer_type       VARCHAR(20) NOT NULL DEFAULT 'TRANSFER'
                        CHECK (transfer_type IN ('TRANSFER', 'LOAN')),
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'CONFIRMED', 'RETURNED', 'CANCELLED')),

  -- Source & Target
  source_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  target_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  source_branch_id    UUID NOT NULL REFERENCES branches(id),
  target_branch_id    UUID NOT NULL REFERENCES branches(id),

  transfer_date       DATE NOT NULL,
  notes               TEXT,

  -- Confirm
  confirmed_at        TIMESTAMPTZ,
  confirmed_by        UUID,

  -- Return (loan only)
  returned_at         TIMESTAMPTZ,
  returned_by         UUID,

  -- Cancel
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        UUID,
  cancel_reason       TEXT,

  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,
  deleted_at          TIMESTAMPTZ,

  UNIQUE(company_id, transfer_number),
  CHECK (source_warehouse_id != target_warehouse_id)
);

CREATE INDEX idx_stock_transfers_company ON stock_transfers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_transfers_status ON stock_transfers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_transfers_source_branch ON stock_transfers(source_branch_id, transfer_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_transfers_target_branch ON stock_transfers(target_branch_id, transfer_date) WHERE deleted_at IS NULL;

CREATE TABLE stock_transfer_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_transfer_id   UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  qty                 NUMERIC(20,4) NOT NULL CHECK (qty > 0),
  cost_per_unit       NUMERIC(20,4) NOT NULL DEFAULT 0,
  notes               TEXT,
  sort_order          INT NOT NULL DEFAULT 0,

  -- Movement references (filled on confirm)
  out_movement_id     UUID,
  in_movement_id      UUID,

  -- Return movement references (loan only, filled on return)
  return_out_movement_id UUID,
  return_in_movement_id  UUID,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_transfer_lines_transfer ON stock_transfer_lines(stock_transfer_id);
