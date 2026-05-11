# PO → Journal Flow — Final Decision Document

> Konteks lengkap untuk development Purchase Order module.
> Semua keputusan sudah final, siap untuk build.

---

## Keputusan Final

| # | Topik | Keputusan |
|---|-------|-----------|
| 1 | Purchase Price Variance COA | Buat akun baru `510303 - Selisih Harga Pembelian` |
| 2 | PO tanpa PR | **Tidak boleh** — semua PO harus dari PR yang APPROVED |
| 3 | Approval PO | Pakai sistem `/permissions` yang sudah ada, register module `purchase_orders` dengan permission type `approve` |
| 4 | Invoice verification | Tabel terpisah `invoice_verifications` — 1 GR bisa punya banyak invoice |
| 5 | Journal trigger | Dibuat saat invoice diverifikasi, bukan saat GR |

---

## Flow Lengkap PO sampai Payment

```
PR (status: APPROVED)
        ↓
Purchasing buat PO dari PR
  → Pilih supplier per line item
  → Set harga, qty, expected delivery
  → Status: DRAFT
        ↓
Approval PO (via /permissions — purchase_orders:approve)
  → Status: APPROVED → SENT (kirim ke supplier)
        ↓
Supplier kirim barang ke cabang
        ↓
Cabang input Goods Receipt (GR)
  → Cocokkan qty dengan PO line per line
  → Input harga invoice per item (bisa beda dari PO)
  → Upload foto invoice (WAJIB)
  → Input nomor invoice + tanggal invoice
  → Status GR: DRAFT → CONFIRMED
  → Stok masuk Gudang 1:
      stock_movements: IN_PURCHASE
      (stok masuk, tapi BELUM ada journal keuangan)
        ↓
Sistem otomatis hitung selisih harga per line:
  → Selisih ≤ 15% : variance_status = 'NOTICE'  → lanjut otomatis
  → Selisih > 15% : variance_status = 'DISPUTED' → butuh approval finance
        ↓
Finance input Invoice Verification
  → Bisa 1 GR punya beberapa invoice (salmon invoice terpisah, sayuran terpisah)
  → Setiap invoice diverifikasi satu per satu
  → Jika ada DISPUTED line → finance approve/reject selisih
        ↓
Invoice terverifikasi → Journal otomatis per invoice:

  DEBIT  Persediaan Bahan Baku (cabang)     = harga invoice × qty
  CREDIT Hutang Dagang (jika CREDIT/tempo)
  atau
  CREDIT Kas / Petty Cash (jika CASH)

  Jika ada selisih harga:
  DEBIT  510303 Selisih Harga Pembelian     = selisih positif (invoice > PO)
  CREDIT 510303 Selisih Harga Pembelian     = selisih negatif (invoice < PO)
        ↓
Jatuh tempo → Finance approve payment:
  DEBIT  Hutang Dagang
  CREDIT Kas / Bank
```

---

## Aturan Bisnis

### Purchase Request
- Semua PO **wajib** dari PR yang sudah APPROVED
- Tidak ada Direct PO / Emergency PO tanpa PR
- Untuk pembelian mendadak (sayuran harian): tetap buat PR dulu, proses approval bisa cepat

### Purchase Order
- Dibuat oleh Purchasing dari PR APPROVED
- 1 PR bisa jadi 1 atau lebih PO (jika multi-supplier)
- Approval PO via sistem permission yang sudah ada (`purchase_orders:approve`)
- Tanpa bukti PO → tidak ada payment

### Goods Receipt
- Dilakukan oleh tim cabang saat barang datang
- **Foto invoice wajib diupload** — pusat tidak perlu tunggu fisik
- Invoice fisik menyusul via mobil saos (seminggu sekali) → hanya untuk arsip
- 1 GR bisa dikonfirmasi partial (barang datang bertahap)

### Invoice & Selisih Harga
- Selisih ≤ 15% dari harga PO → `NOTICE` — lanjut otomatis, finance tetap dapat notifikasi
- Selisih > 15% → `DISPUTED` — finance harus review dan approve sebelum jurnal dibuat
- Selisih dicatat ke akun `510303 - Selisih Harga Pembelian`

### Invoice Verification
- 1 GR bisa punya **lebih dari 1 invoice** (supplier pisah invoice per kategori)
- Setiap invoice diverifikasi terpisah
- Setiap invoice yang terverifikasi → 1 journal entry otomatis
- Finance yang verifikasi, bukan Stock Keeper

### Payment
- Ada 2 jenis: **CASH** (petty cash, sayuran) dan **CREDIT** (tempo, supplier tetap)
- Approval payment dari Finance
- Jadwal order supplier: Senin–Jumat, cut off jam 15.00 WIB

---

## COA yang Terlibat

| Kode | Nama Akun | Tipe | Status |
|------|-----------|------|--------|
| (sesuai COA) | Persediaan Bahan Baku | Aset | ✅ Sudah ada |
| (sesuai COA) | Hutang Dagang | Liabilitas | ✅ Sudah ada |
| (sesuai COA) | Kas / Bank | Aset | ✅ Sudah ada |
| 510303 | Selisih Harga Pembelian | Beban HPP | ⬜ Perlu dibuat |

---

## Status PO

```
DRAFT
  ↓ (submit untuk approval)
PENDING_APPROVAL
  ↓ (approved)
APPROVED
  ↓ (kirim ke supplier)
SENT
  ↓ (barang mulai datang, GR partial)
PARTIAL_RECEIVED
  ↓ (semua item GR selesai)
FULLY_RECEIVED
  ↓ (semua invoice verified + journal dibuat)
CLOSED

Dari DRAFT atau SENT (belum ada GR) → bisa CANCELLED
```

---

## Schema Database

### `purchase_orders`
```sql
CREATE TABLE purchase_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  branch_id             UUID NOT NULL REFERENCES branches(id),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id),
  purchase_request_id   UUID NOT NULL REFERENCES purchase_requests(id),
  po_number             VARCHAR(50) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN (
                            'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT',
                            'PARTIAL_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED'
                          )),
  order_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  payment_type          VARCHAR(10) NOT NULL CHECK (payment_type IN ('CASH', 'CREDIT')),
  payment_terms_days    INT,
  notes                 TEXT,
  approved_by           UUID,
  approved_at           TIMESTAMPTZ,
  cancelled_reason      TEXT,
  total_amount          NUMERIC(20,4) NOT NULL DEFAULT 0,
  is_deleted            BOOLEAN NOT NULL DEFAULT false,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID,
  UNIQUE(company_id, po_number)
);

CREATE INDEX idx_purchase_orders_company ON purchase_orders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_pr ON purchase_orders(purchase_request_id) WHERE deleted_at IS NULL;
```

### `purchase_order_lines`
```sql
CREATE TABLE purchase_order_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                 UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  pr_line_id            UUID REFERENCES purchase_request_lines(id),
  product_id            UUID NOT NULL REFERENCES products(id),
  supplier_product_id   UUID REFERENCES supplier_products(id),
  qty                   NUMERIC(20,4) NOT NULL,
  qty_received          NUMERIC(20,4) NOT NULL DEFAULT 0,
  uom                   VARCHAR(20) NOT NULL,
  unit_price            NUMERIC(20,4) NOT NULL,
  total_price           NUMERIC(20,4) NOT NULL,
  notes                 TEXT,
  sort_order            INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_po_lines_po ON purchase_order_lines(po_id);
```

### `goods_receipts`
```sql
CREATE TABLE goods_receipts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  branch_id             UUID NOT NULL REFERENCES branches(id),
  po_id                 UUID NOT NULL REFERENCES purchase_orders(id),
  warehouse_id          UUID NOT NULL REFERENCES warehouses(id),
  gr_number             VARCHAR(50) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN ('DRAFT', 'CONFIRMED')),
  received_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  notes                 TEXT,
  is_deleted            BOOLEAN NOT NULL DEFAULT false,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID,
  UNIQUE(company_id, gr_number)
);

CREATE INDEX idx_goods_receipts_company ON goods_receipts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_goods_receipts_po ON goods_receipts(po_id) WHERE deleted_at IS NULL;
```

### `goods_receipt_lines`
```sql
CREATE TABLE goods_receipt_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_id                 UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  po_line_id            UUID NOT NULL REFERENCES purchase_order_lines(id),
  product_id            UUID NOT NULL REFERENCES products(id),
  qty_received          NUMERIC(20,4) NOT NULL,
  unit_price_invoice    NUMERIC(20,4) NOT NULL,
  total_price_invoice   NUMERIC(20,4) NOT NULL,
  unit_price_po         NUMERIC(20,4) NOT NULL,
  price_variance        NUMERIC(20,4) NOT NULL DEFAULT 0,
  price_variance_pct    NUMERIC(8,4) NOT NULL DEFAULT 0,
  variance_status       VARCHAR(20) NOT NULL DEFAULT 'OK'
                          CHECK (variance_status IN ('OK', 'NOTICE', 'DISPUTED')),
  notes                 TEXT
);

CREATE INDEX idx_gr_lines_gr ON goods_receipt_lines(gr_id);
CREATE INDEX idx_gr_lines_po_line ON goods_receipt_lines(po_line_id);
```

### `invoice_verifications`
```sql
CREATE TABLE invoice_verifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_id                 UUID NOT NULL REFERENCES goods_receipts(id),
  company_id            UUID NOT NULL REFERENCES companies(id),
  invoice_number        VARCHAR(100) NOT NULL,
  invoice_date          DATE NOT NULL,
  invoice_photo_url     TEXT NOT NULL,
  invoice_amount        NUMERIC(20,4) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING', 'VERIFIED', 'DISPUTED')),
  verified_by           UUID,
  verified_at           TIMESTAMPTZ,
  journal_entry_id      UUID,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID,
  updated_by            UUID
);

CREATE INDEX idx_invoice_verifications_gr ON invoice_verifications(gr_id);
CREATE INDEX idx_invoice_verifications_status ON invoice_verifications(status);
```

---

## Urutan Build

| Step | Module | Dependency |
|------|--------|-----------|
| 1 | Tambah akun 510303 di COA | Manual |
| 2 | Purchase Orders (BE + FE) | PR module done |
| 3 | Goods Receipts (BE + FE) | PO module done |
| 4 | Invoice Verifications + Journal (BE + FE) | GR module done |
| 5 | Payment (BE + FE) | Invoice verified |
