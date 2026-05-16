-- ============================================================
-- MIGRATION: Marketplace PO Module (Shopee & Tokopedia)
-- Sistem: Suryamas ERP
-- Tanggal: 2026-05-16
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Ensure goods_receipts has source column for Marketplace flow
-- ============================================================

ALTER TABLE goods_receipts
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'SUPPLIER'
  ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_goods_receipts_source'
  ) THEN
    ALTER TABLE goods_receipts
      ADD CONSTRAINT chk_goods_receipts_source
      CHECK (source IN ('SUPPLIER', 'MARKETPLACE'));
  END IF;
END $$;

-- ============================================================
-- 1. COA BARU — Sub dari 210600 Akun Sementara Kredit (per company)
-- ============================================================

DO $$
DECLARE
  r RECORD;
  v_parent_id  UUID;
  v_created_by UUID;
  v_codes      TEXT[] := ARRAY['210602', '210603', '210604', '210605', '210606'];
  v_names      TEXT[] := ARRAY[
    'Utang CC Owner - Kartu 1',
    'Utang CC Owner - Kartu 2',
    'Utang CC Owner - Kartu 3',
    'Utang CC Owner - Kartu 4',
    'Utang CC Owner - Kartu 5'
  ];
  i INT;
BEGIN
  FOR r IN
    SELECT DISTINCT company_id
    FROM chart_of_accounts
    WHERE account_code = '210600' AND deleted_at IS NULL
  LOOP
    SELECT id, created_by
    INTO v_parent_id, v_created_by
    FROM chart_of_accounts
    WHERE company_id = r.company_id
      AND account_code = '210600'
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_parent_id IS NULL OR v_created_by IS NULL THEN
      CONTINUE;
    END IF;

    FOR i IN 1..array_length(v_codes, 1) LOOP
      INSERT INTO chart_of_accounts (
        company_id, account_code, account_name, account_type,
        normal_balance, is_header, is_postable, is_active,
        parent_account_id, created_by
      ) VALUES (
        r.company_id, v_codes[i], v_names[i], 'LIABILITY',
        'CREDIT', false, true, true,
        v_parent_id, v_created_by
      ) ON CONFLICT (company_id, account_code) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 2. MASTER KARTU KREDIT OWNER
-- ============================================================

CREATE TABLE IF NOT EXISTS owner_credit_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  card_label      VARCHAR(100) NOT NULL,
  bank_name       VARCHAR(100) NOT NULL,
  last4           CHAR(4),
  coa_code        VARCHAR(20) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth_users(id),
  updated_by      UUID REFERENCES auth_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT owner_credit_cards_company_label_key UNIQUE (company_id, card_label)
);

ALTER TABLE owner_credit_cards
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth_users(id);

CREATE INDEX IF NOT EXISTS idx_owner_cc_company ON owner_credit_cards(company_id);

COMMENT ON TABLE owner_credit_cards IS
  'Master kartu kredit owner yang dipakai untuk checkout marketplace.';

-- ============================================================
-- 3. MARKETPLACE CHECKOUT SESSION
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_checkout_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_number      VARCHAR(50) NOT NULL,
  platform            VARCHAR(20) NOT NULL CHECK (platform IN ('SHOPEE', 'TOKOPEDIA')),
  cc_id               UUID NOT NULL REFERENCES owner_credit_cards(id),
  checkout_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes               TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','ORDERED','SHIPPED','RECEIVED','SETTLED','CANCELLED')),
  platform_order_ids  TEXT[],
  platform_receipt_url TEXT,
  journal_ordered_id  UUID REFERENCES journal_headers(id),
  journal_received_id UUID REFERENCES journal_headers(id),
  journal_settled_id  UUID REFERENCES journal_headers(id),
  goods_receipt_id    UUID REFERENCES goods_receipts(id),
  created_by          UUID REFERENCES auth_users(id),
  updated_by          UUID REFERENCES auth_users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT marketplace_sessions_number_company_key UNIQUE (company_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_mcs_company ON marketplace_checkout_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_mcs_status ON marketplace_checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mcs_date ON marketplace_checkout_sessions(checkout_date DESC);
CREATE INDEX IF NOT EXISTS idx_mcs_cc ON marketplace_checkout_sessions(cc_id);

COMMENT ON TABLE marketplace_checkout_sessions IS
  'Satu sesi checkout marketplace. Bisa mencakup beberapa cabang sekaligus. ';

-- ============================================================
-- 4. LINE ITEM PER SESSION
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_checkout_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES marketplace_checkout_sessions(id) ON DELETE CASCADE,
  po_id               UUID NOT NULL REFERENCES purchase_orders(id),
  po_line_id          UUID NOT NULL REFERENCES purchase_order_lines(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  product_id          UUID NOT NULL REFERENCES products(id),
  qty                 NUMERIC(12,2) NOT NULL,
  unit_price_netto    NUMERIC(15,2) NOT NULL,
  total_netto         NUMERIC(15,2) NOT NULL,
  platform_order_id   VARCHAR(100),
  platform_item_id    VARCHAR(100),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT mpl_po_line_session_key UNIQUE (session_id, po_line_id)
);

CREATE INDEX IF NOT EXISTS idx_mcl_session ON marketplace_checkout_lines(session_id);
CREATE INDEX IF NOT EXISTS idx_mcl_po ON marketplace_checkout_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_mcl_branch ON marketplace_checkout_lines(branch_id);
CREATE INDEX IF NOT EXISTS idx_mcl_product ON marketplace_checkout_lines(product_id);

COMMENT ON TABLE marketplace_checkout_lines IS
  'Line item dalam satu sesi checkout.';

-- ============================================================
-- 5. ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_checkout_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES marketplace_checkout_sessions(id) ON DELETE CASCADE,
  file_type    VARCHAR(30) NOT NULL
               CHECK (file_type IN (
                 'BUKTI_BAYAR',
                 'SCREENSHOT_CHECKOUT',
                 'INVOICE_MARKETPLACE',
                 'OTHER'
               )),
  file_path    TEXT NOT NULL,
  file_name    VARCHAR(255),
  file_size    BIGINT,
  uploaded_by  UUID REFERENCES auth_users(id),
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mca_session ON marketplace_checkout_attachments(session_id);

COMMENT ON TABLE marketplace_checkout_attachments IS
  'Dokumen pendukung checkout marketplace.';

-- ============================================================
-- 6. SHIPMENT / RESI PER CABANG
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_shipments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES marketplace_checkout_sessions(id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES branches(id),
  tracking_number  VARCHAR(100),
  courier          VARCHAR(50),
  shipped_at       TIMESTAMPTZ,
  received_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ms_session ON marketplace_shipments(session_id);
CREATE INDEX IF NOT EXISTS idx_ms_branch ON marketplace_shipments(branch_id);

-- ============================================================
-- 7. SETTLEMENT RECORD
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_settlements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES marketplace_checkout_sessions(id) ON DELETE CASCADE,
  settled_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  bank_account_id INTEGER REFERENCES bank_accounts(id),
  amount         NUMERIC(15,2) NOT NULL,
  reference_number VARCHAR(100),
  notes          TEXT,
  journal_id     UUID REFERENCES journal_headers(id),
  created_by     UUID REFERENCES auth_users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. FUNCTION: Generate session number
-- ============================================================

CREATE OR REPLACE FUNCTION generate_marketplace_session_number(
  p_company_id UUID,
  p_platform   VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
  v_date_str   VARCHAR;
  v_platform_code VARCHAR;
  v_prefix     VARCHAR;
  v_last_seq   INT;
BEGIN
  v_date_str       := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  v_platform_code  := CASE p_platform
                        WHEN 'SHOPEE'    THEN 'SH'
                        WHEN 'TOKOPEDIA' THEN 'TK'
                        ELSE 'MP'
                      END;
  v_prefix := 'MCO-' || v_platform_code || '-' || v_date_str;

  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text || v_prefix));

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(session_number, '-', 4) AS INT)
  ), 0)
  INTO v_last_seq
  FROM marketplace_checkout_sessions
  WHERE company_id = p_company_id
    AND session_number LIKE v_prefix || '-%';

  RETURN v_prefix || '-' || LPAD((v_last_seq + 1)::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

COMMIT;

