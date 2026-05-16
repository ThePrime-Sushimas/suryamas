-- ============================================================
-- MIGRATION: Marketplace PO Module (Shopee & Tokopedia)
-- Sistem: Suryamas ERP
-- Tanggal: 2026-05-16
-- ============================================================

BEGIN;

-- ============================================================
-- 1. COA BARU — Sub dari 210600 Akun Sementara Kredit
--    (Hutang ke CC Owner bersifat sementara / reimbursement)
-- ============================================================

-- Catatan: Sesuaikan company_id dan parent_id dengan data aktual
-- Parent: 210600 - Akun Sementara Kredit

INSERT INTO chart_of_accounts (
  code, name, account_type, parent_code,
  is_posting, currency, is_active,
  description, created_at
) VALUES
  ('210602', 'Utang CC Owner - Kartu 1', 'Kewajiban', '210600', true, 'IDR', true, 'Hutang reimbursement kartu kredit owner ke-1', now()),
  ('210603', 'Utang CC Owner - Kartu 2', 'Kewajiban', '210600', true, 'IDR', true, 'Hutang reimbursement kartu kredit owner ke-2', now()),
  ('210604', 'Utang CC Owner - Kartu 3', 'Kewajiban', '210600', true, 'IDR', true, 'Hutang reimbursement kartu kredit owner ke-3', now()),
  ('210605', 'Utang CC Owner - Kartu 4', 'Kewajiban', '210600', true, 'IDR', true, 'Hutang reimbursement kartu kredit owner ke-4', now()),
  ('210606', 'Utang CC Owner - Kartu 5', 'Kewajiban', '210600', true, 'IDR', true, 'Hutang reimbursement kartu kredit owner ke-5', now())
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. MASTER KARTU KREDIT OWNER
-- ============================================================

CREATE TABLE IF NOT EXISTS owner_credit_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  card_label      VARCHAR(100) NOT NULL,   -- "BCA Michael - 1234"
  bank_name       VARCHAR(100) NOT NULL,   -- "BCA", "Mandiri", dll
  last4           CHAR(4),                 -- 4 digit terakhir kartu
  coa_code        VARCHAR(20) NOT NULL,    -- e.g. "210602"
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT owner_credit_cards_company_label_key UNIQUE (company_id, card_label)
);

CREATE INDEX IF NOT EXISTS idx_owner_cc_company ON owner_credit_cards(company_id);

COMMENT ON TABLE owner_credit_cards IS
  'Master kartu kredit owner yang dipakai untuk checkout marketplace. '
  'Setiap kartu dipetakan ke 1 akun COA (sub 210600).';

-- ============================================================
-- 3. MARKETPLACE CHECKOUT SESSION
--    1 session = 1 platform + 1 CC + bisa multi cabang + multi PO
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_checkout_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_number      VARCHAR(50) NOT NULL,   -- MCO-YYYYMMDD-001
  platform            VARCHAR(20) NOT NULL CHECK (platform IN ('SHOPEE', 'TOKOPEDIA')),
  cc_id               UUID NOT NULL REFERENCES owner_credit_cards(id),
  checkout_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes               TEXT,

  -- Status flow: DRAFT → ORDERED → SHIPPED → RECEIVED → SETTLED
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','ORDERED','SHIPPED','RECEIVED','SETTLED','CANCELLED')),

  -- Platform order info
  platform_order_ids  TEXT[],              -- array nomor pesanan per cabang
  platform_receipt_url TEXT,               -- link struk/invoice marketplace

  -- Journal references (diisi otomatis saat status berubah)
  journal_ordered_id  UUID REFERENCES journal_entries(id),   -- Dr Persediaan Dlm Perjalanan / Cr Hutang CC
  journal_received_id UUID REFERENCES journal_entries(id),   -- Dr Persediaan / Cr Persediaan Dlm Perjalanan
  journal_settled_id  UUID REFERENCES journal_entries(id),   -- Dr Hutang CC / Cr Bank

  -- GR reference (dibuat otomatis saat RECEIVED)
  goods_receipt_id    UUID REFERENCES goods_receipts(id),

  -- Audit
  created_by          UUID REFERENCES users(id),
  updated_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT marketplace_sessions_number_company_key UNIQUE (company_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_mcs_company    ON marketplace_checkout_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_mcs_status     ON marketplace_checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mcs_date       ON marketplace_checkout_sessions(checkout_date DESC);
CREATE INDEX IF NOT EXISTS idx_mcs_cc         ON marketplace_checkout_sessions(cc_id);

COMMENT ON TABLE marketplace_checkout_sessions IS
  'Satu sesi checkout marketplace. Bisa mencakup beberapa cabang sekaligus. '
  'Journal di-post otomatis saat transisi status.';

-- ============================================================
-- 4. LINE ITEM PER SESSION
--    1 line = 1 PO line dari 1 cabang
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_checkout_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES marketplace_checkout_sessions(id) ON DELETE CASCADE,
  po_id               UUID NOT NULL REFERENCES purchase_orders(id),
  po_line_id          UUID NOT NULL REFERENCES purchase_order_lines(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  product_id          UUID NOT NULL REFERENCES products(id),
  qty                 NUMERIC(12,2) NOT NULL,
  unit_price_netto    NUMERIC(15,2) NOT NULL,  -- harga netto per unit (total ÷ qty, sudah include ongkir/fee)
  total_netto         NUMERIC(15,2) NOT NULL,  -- = qty × unit_price_netto
  platform_order_id   VARCHAR(100),            -- nomor pesanan shopee/tokped per item/cabang
  platform_item_id    VARCHAR(100),            -- ID item di platform
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT mpl_po_line_session_key UNIQUE (session_id, po_line_id)
);

CREATE INDEX IF NOT EXISTS idx_mcl_session    ON marketplace_checkout_lines(session_id);
CREATE INDEX IF NOT EXISTS idx_mcl_po         ON marketplace_checkout_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_mcl_branch     ON marketplace_checkout_lines(branch_id);
CREATE INDEX IF NOT EXISTS idx_mcl_product    ON marketplace_checkout_lines(product_id);

COMMENT ON TABLE marketplace_checkout_lines IS
  'Line item dalam satu sesi checkout. '
  'unit_price_netto = total bayar ÷ qty (sudah include ongkir, admin fee, dll).';

-- ============================================================
-- 5. ATTACHMENTS (bukti bayar, screenshot, invoice marketplace)
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_checkout_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES marketplace_checkout_sessions(id) ON DELETE CASCADE,
  file_type    VARCHAR(30) NOT NULL
               CHECK (file_type IN (
                 'BUKTI_BAYAR',           -- screenshot konfirmasi pembayaran
                 'SCREENSHOT_CHECKOUT',   -- screenshot keranjang/checkout
                 'INVOICE_MARKETPLACE',   -- invoice/struk dari platform
                 'OTHER'
               )),
  file_path    TEXT NOT NULL,
  file_name    VARCHAR(255),
  file_size    BIGINT,                   -- bytes
  uploaded_by  UUID REFERENCES users(id),
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mca_session ON marketplace_checkout_attachments(session_id);

COMMENT ON TABLE marketplace_checkout_attachments IS
  'Dokumen pendukung checkout marketplace. Wajib upload BUKTI_BAYAR '
  'sebelum bisa post journal ORDERED.';

-- ============================================================
-- 6. SHIPMENT / RESI PER CABANG
--    1 session bisa punya beberapa resi (per cabang)
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_shipments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES marketplace_checkout_sessions(id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES branches(id),
  tracking_number  VARCHAR(100),
  courier          VARCHAR(50),    -- JNE, SiCepat, AnterAja, dll
  shipped_at       TIMESTAMPTZ,
  received_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ms_session ON marketplace_shipments(session_id);
CREATE INDEX IF NOT EXISTS idx_ms_branch  ON marketplace_shipments(branch_id);

-- ============================================================
-- 7. SETTLEMENT RECORD — saat CC owner dilunasi perusahaan
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_settlements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES marketplace_checkout_sessions(id) ON DELETE CASCADE,
  settled_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  bank_account_id UUID REFERENCES bank_accounts(id),  -- bank yang dipakai transfer ke owner
  amount         NUMERIC(15,2) NOT NULL,
  reference_number VARCHAR(100),     -- nomor transfer / bukti pembayaran ke owner
  notes          TEXT,
  journal_id     UUID REFERENCES journal_entries(id),
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. FUNCTION: Generate session number
--    Format: MCO-{PLATFORM_2CHAR}-{YYYYMMDD}-{SEQ3}
--    Contoh: MCO-SH-20260516-001 (Shopee)
--            MCO-TK-20260516-001 (Tokopedia)
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

  -- Advisory lock untuk prevent race condition
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

-- ============================================================
-- 9. TRIGGER: update updated_at otomatis
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Terapkan ke tabel yang punya updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'marketplace_checkout_sessions',
    'marketplace_shipments',
    'owner_credit_cards'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE owner_credit_cards                ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_checkout_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_checkout_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_checkout_attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_shipments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_settlements           ENABLE ROW LEVEL SECURITY;

-- Policy: isolasi per company_id
CREATE POLICY mp_cc_company_isolation ON owner_credit_cards
  USING (company_id = current_setting('app.company_id')::UUID);

CREATE POLICY mp_session_company_isolation ON marketplace_checkout_sessions
  USING (company_id = current_setting('app.company_id')::UUID);

-- Lines, attachments, shipments, settlements mengikuti session
CREATE POLICY mp_lines_via_session ON marketplace_checkout_lines
  USING (session_id IN (
    SELECT id FROM marketplace_checkout_sessions
    WHERE company_id = current_setting('app.company_id')::UUID
  ));

CREATE POLICY mp_attach_via_session ON marketplace_checkout_attachments
  USING (session_id IN (
    SELECT id FROM marketplace_checkout_sessions
    WHERE company_id = current_setting('app.company_id')::UUID
  ));

CREATE POLICY mp_ship_via_session ON marketplace_shipments
  USING (session_id IN (
    SELECT id FROM marketplace_checkout_sessions
    WHERE company_id = current_setting('app.company_id')::UUID
  ));

CREATE POLICY mp_settle_via_session ON marketplace_settlements
  USING (session_id IN (
    SELECT id FROM marketplace_checkout_sessions
    WHERE company_id = current_setting('app.company_id')::UUID
  ));

COMMIT;
