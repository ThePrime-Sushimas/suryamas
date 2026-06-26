-- ============================================================================
-- PETTY CASH MODULE: requests, settlements, expenses
-- Request-based imprest system: cabang request modal → expense realtime → settlement
-- ============================================================================
BEGIN;

-- ─── 1. petty_cash_requests ─────────────────────────────────────────────────

CREATE TABLE petty_cash_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id),
  branch_id               UUID NOT NULL REFERENCES branches(id),
  request_number          VARCHAR(30) NOT NULL,

  status                  TEXT NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING','DISBURSED','CLOSED','REJECTED')),

  amount_requested        NUMERIC(15,2) NOT NULL,
  amount_disbursed        NUMERIC(15,2),

  carried_from_id         UUID REFERENCES petty_cash_requests(id),
  carried_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,

  petty_cash_coa_id       UUID NOT NULL REFERENCES chart_of_accounts(id),
  source_bank_account_id  INTEGER REFERENCES bank_accounts(id),

  disburse_journal_id     UUID REFERENCES journal_headers(id),

  description             TEXT,
  notes                   TEXT,

  submitted_by            UUID REFERENCES auth_users(id),
  submitted_at            TIMESTAMPTZ,
  approved_by             UUID REFERENCES auth_users(id),
  approved_at             TIMESTAMPTZ,
  rejected_by             UUID REFERENCES auth_users(id),
  rejected_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  closed_by               UUID REFERENCES auth_users(id),
  closed_at               TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID REFERENCES auth_users(id),
  updated_by              UUID REFERENCES auth_users(id),
  deleted_at              TIMESTAMPTZ,

  UNIQUE(company_id, request_number)
);

CREATE INDEX idx_pc_requests_branch
  ON petty_cash_requests(branch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_pc_requests_carried_from
  ON petty_cash_requests(carried_from_id) WHERE carried_from_id IS NOT NULL;

-- Trigger: enforce COA consistency for carried requests
CREATE OR REPLACE FUNCTION enforce_petty_cash_carry_coa_consistency()
RETURNS TRIGGER AS $$
DECLARE
  parent_coa_id UUID;
BEGIN
  IF NEW.carried_from_id IS NOT NULL THEN
    SELECT petty_cash_coa_id INTO parent_coa_id
    FROM petty_cash_requests
    WHERE id = NEW.carried_from_id;

    IF parent_coa_id IS NOT NULL AND parent_coa_id != NEW.petty_cash_coa_id THEN
      RAISE EXCEPTION
        'petty_cash_coa_id (%) harus sama dengan request asal (carried_from_id: %, coa: %)',
        NEW.petty_cash_coa_id, NEW.carried_from_id, parent_coa_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_pc_carry_coa_consistency
  BEFORE INSERT OR UPDATE ON petty_cash_requests
  FOR EACH ROW
  EXECUTE FUNCTION enforce_petty_cash_carry_coa_consistency();

-- ─── 2. petty_cash_settlements ──────────────────────────────────────────────

CREATE TABLE petty_cash_settlements (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id              UUID NOT NULL REFERENCES petty_cash_requests(id),
  company_id              UUID NOT NULL REFERENCES companies(id),
  branch_id               UUID NOT NULL REFERENCES branches(id),

  settlement_date         DATE NOT NULL DEFAULT CURRENT_DATE,

  total_disbursed         NUMERIC(15,2) NOT NULL,
  total_expenses          NUMERIC(15,2) NOT NULL,
  remaining_balance       NUMERIC(15,2) NOT NULL,

  amount_returned         NUMERIC(15,2) NOT NULL DEFAULT 0,
  carried_to_id           UUID REFERENCES petty_cash_requests(id),

  journal_id              UUID REFERENCES journal_headers(id),
  return_bank_account_id  INTEGER REFERENCES bank_accounts(id),

  notes                   TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID REFERENCES auth_users(id),
  updated_by              UUID REFERENCES auth_users(id),

  UNIQUE(request_id)
);

-- ─── 3. petty_cash_expenses ─────────────────────────────────────────────────

CREATE TABLE petty_cash_expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID NOT NULL REFERENCES petty_cash_requests(id),
  company_id        UUID NOT NULL REFERENCES companies(id),
  branch_id         UUID NOT NULL REFERENCES branches(id),

  expense_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  amount            NUMERIC(15,2) NOT NULL,
  description       TEXT,

  category_id       UUID NOT NULL REFERENCES categories(id),
  sub_category_id   UUID REFERENCES sub_categories(id),

  expense_coa_id    UUID REFERENCES chart_of_accounts(id),

  product_id        UUID REFERENCES products(id),
  product_uom_id    UUID REFERENCES product_uoms(id),
  qty               NUMERIC(15,4),
  unit_price        NUMERIC(15,2),
  warehouse_id      UUID REFERENCES warehouses(id),
  stock_movement_id UUID,

  settlement_id     UUID,

  receipt_url       TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth_users(id),
  updated_by        UUID REFERENCES auth_users(id),
  deleted_at        TIMESTAMPTZ
);

ALTER TABLE petty_cash_expenses
  ADD CONSTRAINT fk_pc_expenses_settlement
  FOREIGN KEY (settlement_id) REFERENCES petty_cash_settlements(id);

CREATE INDEX idx_pc_expenses_request
  ON petty_cash_expenses(request_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pc_expenses_product
  ON petty_cash_expenses(product_id) WHERE product_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_pc_expenses_settlement
  ON petty_cash_expenses(settlement_id) WHERE settlement_id IS NOT NULL;

COMMIT;
