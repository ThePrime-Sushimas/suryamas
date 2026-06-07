-- Production Requests: Branch requests production items (e.g. sauce) from central
-- Flow: DRAFT → ACCEPTED → RECEIVED
-- Lines reference products (finished goods linked to WIP via wip_items.output_product_id)
-- Qty is in transfer unit (Tin, Pack, Batch, etc.)

CREATE TABLE production_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  request_number        VARCHAR(30) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN ('DRAFT', 'ACCEPTED', 'RECEIVED', 'CANCELLED')),

  -- Requesting branch (cabang yang minta)
  requesting_branch_id  UUID NOT NULL REFERENCES branches(id),
  -- Fulfilling branch (central/pabrik yang produksi)
  fulfilling_branch_id  UUID NOT NULL REFERENCES branches(id),

  request_date          DATE NOT NULL,
  notes                 TEXT,

  -- Accept
  accepted_at           TIMESTAMPTZ,
  accepted_by           UUID,
  accept_notes          TEXT,

  -- Receive
  received_at           TIMESTAMPTZ,
  received_by           UUID,
  receive_notes         TEXT,

  -- Cancel
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          UUID,
  cancel_reason         TEXT,

  -- Link to stock transfer (filled when central ships)
  stock_transfer_id     UUID REFERENCES stock_transfers(id),

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID,
  deleted_at            TIMESTAMPTZ,

  UNIQUE(company_id, request_number),
  CHECK (requesting_branch_id != fulfilling_branch_id)
);

CREATE INDEX idx_production_requests_company ON production_requests(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_requests_status ON production_requests(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_requests_requesting ON production_requests(requesting_branch_id, request_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_requests_fulfilling ON production_requests(fulfilling_branch_id, request_date) WHERE deleted_at IS NULL;

CREATE TABLE production_request_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_request_id UUID NOT NULL REFERENCES production_requests(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES products(id),
  qty                   NUMERIC(20,4) NOT NULL CHECK (qty > 0),
  qty_approved          NUMERIC(20,4),
  uom                   VARCHAR(50) NOT NULL,
  notes                 TEXT,
  sort_order            INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_production_request_lines_request ON production_request_lines(production_request_id);
