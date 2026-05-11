# Inventory System V2 — Master Plan

> Rangkuman lengkap dari diskusi. Dokumen ini menjadi roadmap development.

---

## Konteks Bisnis

- **5 Cabang** restoran sushi + **1 Central Kitchen** (saos, WIP) + **1 Central Stock**
- Laporan Laba Rugi **sudah per cabang**
- POS data historis **1 tahun** tersedia untuk sync
- Menu POS **1:1** dengan sistem (auto-sync)
- COGS sedang **ditimbang ulang** untuk akurasi

---

## Masalah yang Diselesaikan

| # | Masalah | Solusi |
|---|---------|--------|
| 1 | Waste tidak terhitung | Yield factor + variance dari SO |
| 2 | Potensi fraud tim dapur | Kontrol harian + foto timbangan + audit trail |
| 3 | Input ngasal / tulis kertas dulu | Halaman prediksi (tinggal koreksi, bukan input dari nol) |
| 4 | Terima barang tanpa cek PO | GR wajib cocok PO, tanpa PO tidak ada payment |
| 5 | COGS belum akurat | Timbang ulang + yield factor + resep lengkap |
| 6 | Coverage resep rendah (1/281) | Prioritas input resep berdasarkan volume penjualan |

---

## Arsitektur Stok

```
                    ┌─────────────┐
                    │  Supplier   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌──────────────┐  ┌──────────┐  ┌──────────┐
     │ Central Stock│  │ Cabang 1 │  │ Cabang N │  ← Supplier kirim langsung
     └──────┬───────┘  └────┬─────┘  └────┬─────┘
            │               │              │
            │  Transfer     │              │
            ├───────────────┤              │
            │               │  Loan        │
            │               ├──────────────┤
            ▼               ▼              ▼
     ┌──────────────┐  ┌──────────┐  ┌──────────┐
     │Central Kitch.│  │ Gudang 1 │  │ Gudang 1 │  ← Stok tersimpan
     │ (WIP saos)   │  └────┬─────┘  └────┬─────┘
     └──────┬───────┘       │              │
            │  Distribute   │ Turun harian │
            ├───────────────┤              │
                            ▼              ▼
                       ┌──────────┐  ┌──────────┐
                       │ Ready/G2 │  │ Ready/G2 │  ← Bahan siap jual
                       └────┬─────┘  └────┬─────┘
                            │              │
                            ▼              ▼
                       ┌──────────┐  ┌──────────┐
                       │   POS    │  │   POS    │  ← Penjualan
                       └──────────┘  └──────────┘
```

---

## 4 Sumber Bahan per Cabang

| Source | Dokumen | Flow |
|--------|---------|------|
| Supplier langsung | Purchase Request → PO → GR | Supplier kirim ke cabang |
| Central Stock | Transfer Request → Transfer Out → Receive | Selasa/Rabu atau emergency Gosend |
| Central Kitchen | Production Request → Distribute | Hasil WIP (saos dll) |
| Cabang lain | Inter-branch Loan → Return/Permanent | Pinjam, wajib balikin |

---

## Cost Allocation (Model A — Cost Ikut Barang)

- Supplier → Cabang langsung → **cost masuk cabang**
- Supplier → Central → Cabang → **cost pindah saat transfer**
- Central Kitchen → Cabang → **cost WIP pindah saat distribute**
- Cabang A → Cabang B (loan) → **cost sementara di B, balik saat return**

---

## Flow PO Lengkap (sampai Journal)

```
Cabang buat Purchase Request
        ↓
Stock Keeper (2 orang) approval (salah satu cukup)
        ↓
Purchasing terima → order ke supplier
        ↓
Supplier kirim ke cabang
        ↓
Cabang terima → Goods Receipt (cocokkan PO)
        ↓
Invoice masuk → cocokkan PO + GR
        ↓
Journal otomatis:
  DEBIT  Persediaan Bahan Baku (cabang)
  CREDIT Hutang Dagang / Kas
        ↓
Pembayaran (cash langsung / tempo)
  DEBIT  Hutang Dagang
  CREDIT Kas / Bank
```

---

## Prediksi Harian

### Formula
```
Prediksi kebutuhan hari ini
= Rata-rata penjualan (7 hari + hari sejenis + weekend/tanggal merah)
× Yield factor per bahan
- Sisa Ready kemarin
= Rekomendasi ambil dari Gudang 1
```

### Auto-generate Dokumen
```
Prediksi minggu depan per cabang
→ Bandingkan stok Gudang 1
→ Tentukan source per bahan (supplier/central/kitchen)
→ Generate draft:
   - Purchase Request (supplier)
   - Transfer Request (central)
   - Production Request (WIP kitchen)
→ Tim koreksi → submit → approval
```

### Faktor Pertimbangan
- Rata-rata 7 hari terakhir
- Tren hari sejenis (Senin vs Senin)
- Weekend vs weekday
- Tanggal merah
- Event/promo (override manual)
- Sisa ready kemarin (anchor)
- Stok Gudang 1 (warning jika kurang)
- Lead time supplier
- MOQ supplier

---

## Kontrol Harian (Gudang 2 / Ready)

### Prinsip
- **Bukan timbang semua item** — hanya bahan berisiko tinggi (salmon, wagyu, udang)
- Sisanya sistem hitung otomatis dari: turun - theoretical penjualan = sisa harusnya
- Tim dapur **konfirmasi** saja (sesuai / tidak sesuai)

### PIC Harian
- Setiap divisi giliran per hari per orang
- PIC yang ambil = PIC yang timbang malam = PIC yang tanggung jawab
- Audit trail: timestamp + nama + foto timbangan

### Anomali Detection
- Input hari ini vs rata-rata 7 hari → flag jika jauh berbeda
- PIC langsung tahu malam itu, bukan tunggu SO bulanan

---

## Aturan Operasional (Time-based Rules)

### Implementasi Bertahap

**Bulan 1-2 — Mode Edukasi:**
- Input boleh kapan saja
- Sistem catat mana yang telat
- Laporan mingguan ke owner

**Bulan 3-4 — Mode Warning:**
- Lewat jam → warning + alasan wajib
- Masih bisa submit, tercatat sebagai "late input"

**Bulan 5+ — Mode Strict:**
- Lock + butuh admin override
- Tim sudah terbiasa

### Rules yang Berlaku

| Aturan | Detail |
|--------|--------|
| Pengambilan bahan max 17.00 | Lewat → butuh permission admin/superAdmin |
| Input pengambilan max 17.00 | Sama dengan atas |
| Input WIP/Produksi/Waste | Max H+1 setelah closing |
| Tidak bisa dirapel | Lupa input Senin → Selasa tidak bisa input untuk Senin |
| Cut off order supplier | Senin-Jumat jam 15.00 |

---

## Supplier Data (Sudah Ada)

Tabel `supplier_products` sudah punya:
- `price` — harga per unit
- `lead_time_days` — waktu kirim
- `min_order_qty` — MOQ
- `is_preferred` — supplier utama
- `currency` — mata uang

Yang perlu ditambah:
- Jadwal order per supplier (hari apa saja bisa order)
- Jadwal kirim per supplier
- Payment terms (cash / tempo berapa hari)

---

## Status Build Saat Ini

| Modul | Status |
|-------|--------|
| Neraca + COA + Laba Rugi per cabang | ✅ |
| WIP + Production Order | ✅ |
| Supplier + Supplier Products | ✅ |
| Menu + Menu Categories + Menu Groups | ✅ |
| POS Sync (daily) | ✅ |
| Master data COGS | 🔄 Sedang ditimbang ulang |
| Resep (recipe_lines) | 🔄 1/281 menu |
| Semua modul inventory di bawah | ⬜ |

---

## Urutan Build

### FASE 1 — Fondasi Data (Paralel)

| # | Task | Dependency | Output |
|---|------|-----------|--------|
| 1.1 | Sync POS historis 1 tahun | Tidak ada | Data prediksi siap dari hari 1 |
| 1.2 | Tambah yield factor di master bahan | Tidak ada | Kalkulasi theoretical akurat |
| 1.3 | Tandai source per bahan (supplier/central/kitchen) | Tidak ada | Sistem tahu generate dokumen apa |
| 1.4 | Tandai kategori risiko per bahan (tinggi/rendah) | Tidak ada | Kontrol harian tahu item mana |

### FASE 2 — Gudang & Stok

| # | Task | Dependency | Output |
|---|------|-----------|--------|
| 2.1 | Tabel `warehouses` (Gudang 1 per cabang + Central) | — | Lokasi stok terdefinisi |
| 2.2 | Tabel `stock_movements` + `stock_balances` | 2.1 | Mutasi & saldo stok real-time |
| 2.3 | Opening balance per gudang | 2.2 | Stok awal yang akurat |
| 2.4 | Purchase Request + Approval | 2.1 | Cabang bisa request |
| 2.5 | Purchase Order (dari approved PR) | 2.4 | Purchasing bisa order |
| 2.6 | Goods Receipt (cocokkan PO) | 2.5 | Barang masuk tercatat |
| 2.7 | Journal otomatis dari GR | 2.6 | Persediaan + Hutang |
| 2.8 | Payment (cash/tempo) | 2.7 | Hutang lunas |
| 2.9 | Transfer Request + Transfer Out/In | 2.2 | Central → Cabang |
| 2.10 | Inter-branch Loan + Return | 2.2 | Cabang ↔ Cabang |

### FASE 3 — Operasional Harian

| # | Task | Dependency | Output |
|---|------|-----------|--------|
| 3.1 | Gudang 2 / Ready per cabang | Fase 2 | Pencatatan turun barang |
| 3.2 | Halaman prediksi harian | Fase 1 + 3.1 | Rekomendasi otomatis |
| 3.3 | Konfirmasi malam (bahan risiko tinggi) | 3.1 | Kontrol harian |
| 3.4 | Foto timbangan (upload) | 3.3 | Bukti tidak bisa diperdebatkan |
| 3.5 | Anomali detection + flag | 3.3 | PIC tahu malam itu juga |
| 3.6 | Time-based rules (mode edukasi dulu) | 3.1 | Disiplin input |

### FASE 4 — Resep & Analisa

| # | Task | Dependency | Output |
|---|------|-----------|--------|
| 4.1 | Input resep 281 menu (prioritas by volume) | — | Coverage naik |
| 4.2 | Theoretical Consumption (sudah ada modul) | 4.1 | Kalkulasi akurat |
| 4.3 | Variance per cabang (actual vs theoretical) | Fase 3 + 4.2 | Deteksi masalah |
| 4.4 | Stock Opname bulanan | Fase 2 | Validasi akhir |
| 4.5 | Dashboard kontrol per cabang | 4.3 + 4.4 | Visibility owner |

### FASE 5 — Optimasi & Prediksi Lanjutan

| # | Task | Dependency | Output |
|---|------|-----------|--------|
| 5.1 | Auto-generate draft PO dari prediksi | Fase 2 + 3.2 | Purchasing otomatis |
| 5.2 | Refine yield factor dari variance data | 4.3 | Prediksi makin akurat |
| 5.3 | Alert stok hampir habis | Fase 2 | Notifikasi proaktif |
| 5.4 | Alert variance di luar batas | 4.3 | Investigasi cepat |
| 5.5 | Supplier performance tracking | Fase 2 | Evaluasi supplier |

---

## Rekomendasi Mulai Sekarang

**Kerjakan paralel:**

```
Track A: Sync POS historis (1.1)
  → Tidak blokir apapun, data langsung berguna

Track B: Fase 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7
  → Ini fondasi yang paling kritikal
  → Tanpa ini, Fase 3 (prediksi) tidak punya anchor

Track C: Input resep (4.1)
  → Bisa dikerjakan kapan saja, tidak blokir development
  → Prioritas: menu dengan volume penjualan tertinggi dulu
```

**First deliverable yang bisa dipakai:**
- Fase 2.4-2.6 selesai → cabang sudah bisa request + terima barang dengan benar
- Ini langsung solve masalah "terima barang tanpa cek PO"

---

## Database Schema (Detail)

### Fase 2A — Warehouse & Stock Foundation

#### `warehouses`

```sql
CREATE TABLE warehouses (
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

CREATE INDEX idx_warehouses_company ON warehouses(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_warehouses_branch ON warehouses(branch_id) WHERE deleted_at IS NULL;
```

**Seed data (setelah create branch Central):**
```sql
-- 5 cabang × 2 (MAIN + READY) = 10
-- 1 Central Stock = 1
-- 1 Central Kitchen = 1
-- Total: 12 warehouses
```

#### `stock_balances`

```sql
CREATE TABLE stock_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  qty             NUMERIC(20,4) NOT NULL DEFAULT 0,
  avg_cost        NUMERIC(20,4) NOT NULL DEFAULT 0,   -- weighted average cost
  last_movement_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, product_id)
);

CREATE INDEX idx_stock_balances_warehouse ON stock_balances(warehouse_id);
CREATE INDEX idx_stock_balances_product ON stock_balances(product_id);
```

> **Catatan**: `stock_balances` tidak punya `company_id` sendiri — inherit dari `warehouses.company_id` via JOIN. Ini menghindari redundansi.

#### `stock_movements`

```sql
CREATE TABLE stock_movements (
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
  qty             NUMERIC(20,4) NOT NULL,             -- positif = masuk, negatif = keluar
  cost_per_unit   NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(20,4) NOT NULL DEFAULT 0,   -- qty × cost_per_unit
  balance_after   NUMERIC(20,4) NOT NULL DEFAULT 0,   -- saldo setelah movement
  reference_type  VARCHAR(30),                        -- 'purchase_order', 'transfer_order', 'loan', 'daily_requisition', 'adjustment'
  reference_id    UUID,                               -- FK ke dokumen sumber
  notes           TEXT,
  movement_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);

CREATE INDEX idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id)
  WHERE reference_id IS NOT NULL;
```

> **Design choice**: `qty` bisa negatif (keluar) atau positif (masuk). `balance_after` di-snapshot setiap movement untuk audit trail tanpa harus recalculate.

---

### Fase 2B — Purchase Flow

#### `purchase_requests`

```sql
CREATE TABLE purchase_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  request_number  VARCHAR(30) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED')),
  request_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  needed_by_date  DATE,                               -- kapan butuh barang
  notes           TEXT,
  requested_by    UUID,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  rejected_reason TEXT,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  UNIQUE(company_id, request_number)
);

CREATE INDEX idx_purchase_requests_company ON purchase_requests(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_requests_branch ON purchase_requests(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_requests_status ON purchase_requests(status) WHERE deleted_at IS NULL;
```

#### `purchase_request_lines`

```sql
CREATE TABLE purchase_request_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  qty             NUMERIC(20,4) NOT NULL,
  uom             VARCHAR(20) NOT NULL,
  estimated_price NUMERIC(20,4),                      -- dari supplier_products.price (auto-fill)
  supplier_id     UUID REFERENCES suppliers(id),      -- preferred supplier (auto-fill)
  notes           TEXT,
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_pr_lines_request ON purchase_request_lines(request_id);
```

#### `purchase_orders`

```sql
CREATE TABLE purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),  -- cabang tujuan
  po_number       VARCHAR(30) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'SENT', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED')),
  po_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date   DATE,                               -- perkiraan barang datang
  payment_type    VARCHAR(10) NOT NULL DEFAULT 'TEMPO'
                    CHECK (payment_type IN ('CASH', 'TEMPO')),
  payment_due_date DATE,                              -- jatuh tempo (jika TEMPO)
  total_amount    NUMERIC(20,4) NOT NULL DEFAULT 0,
  notes           TEXT,
  purchase_request_id UUID REFERENCES purchase_requests(id),  -- link ke PR (nullable, bisa PO tanpa PR)
  journal_id      UUID REFERENCES journal_headers(id),
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  UNIQUE(company_id, po_number)
);

CREATE INDEX idx_purchase_orders_company ON purchase_orders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status) WHERE deleted_at IS NULL;
```

#### `purchase_order_lines`

```sql
CREATE TABLE purchase_order_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  qty_ordered     NUMERIC(20,4) NOT NULL,
  qty_received    NUMERIC(20,4) NOT NULL DEFAULT 0,   -- updated saat GR
  uom             VARCHAR(20) NOT NULL,
  unit_price      NUMERIC(20,4) NOT NULL,
  total_price     NUMERIC(20,4) NOT NULL,             -- qty_ordered × unit_price
  pr_line_id      UUID REFERENCES purchase_request_lines(id),  -- traceability ke PR
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_po_lines_po ON purchase_order_lines(po_id);
```

#### `goods_receipts`

```sql
CREATE TABLE goods_receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),  -- gudang tujuan
  po_id           UUID NOT NULL REFERENCES purchase_orders(id),
  gr_number       VARCHAR(30) NOT NULL,
  receipt_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
  notes           TEXT,
  received_by     UUID,
  confirmed_at    TIMESTAMPTZ,
  journal_id      UUID REFERENCES journal_headers(id),
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  UNIQUE(company_id, gr_number)
);

CREATE INDEX idx_goods_receipts_company ON goods_receipts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_goods_receipts_po ON goods_receipts(po_id) WHERE deleted_at IS NULL;
```

#### `goods_receipt_lines`

```sql
CREATE TABLE goods_receipt_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_id           UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  po_line_id      UUID NOT NULL REFERENCES purchase_order_lines(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  qty_received    NUMERIC(20,4) NOT NULL,
  qty_rejected    NUMERIC(20,4) NOT NULL DEFAULT 0,   -- barang rusak/tidak sesuai
  uom             VARCHAR(20) NOT NULL,
  unit_price      NUMERIC(20,4) NOT NULL,             -- dari PO line (snapshot)
  notes           TEXT,
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_gr_lines_gr ON goods_receipt_lines(gr_id);
```

---

### Fase 2C — Transfer & Loan

#### `transfer_orders`

```sql
CREATE TABLE transfer_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  from_warehouse_id   UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
  transfer_number     VARCHAR(30) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CANCELLED')),
  transfer_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  received_date       DATE,
  notes               TEXT,
  requested_by        UUID,
  approved_by         UUID,
  approved_at         TIMESTAMPTZ,
  shipped_by          UUID,
  shipped_at          TIMESTAMPTZ,
  received_by         UUID,
  received_at         TIMESTAMPTZ,
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,
  UNIQUE(company_id, transfer_number)
);

CREATE INDEX idx_transfer_orders_company ON transfer_orders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transfer_orders_from ON transfer_orders(from_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transfer_orders_to ON transfer_orders(to_warehouse_id) WHERE deleted_at IS NULL;
```

#### `transfer_order_lines`

```sql
CREATE TABLE transfer_order_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id     UUID NOT NULL REFERENCES transfer_orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  qty_requested   NUMERIC(20,4) NOT NULL,
  qty_shipped     NUMERIC(20,4),
  qty_received    NUMERIC(20,4),
  uom             VARCHAR(20) NOT NULL,
  cost_per_unit   NUMERIC(20,4) NOT NULL DEFAULT 0,   -- cost yang ikut pindah
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_transfer_lines_transfer ON transfer_order_lines(transfer_id);
```

#### `branch_loans`

```sql
CREATE TABLE branch_loans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  from_branch_id  UUID NOT NULL REFERENCES branches(id),
  to_branch_id    UUID NOT NULL REFERENCES branches(id),
  loan_number     VARCHAR(30) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'APPROVED', 'SHIPPED', 'RECEIVED', 'PARTIAL_RETURNED', 'RETURNED', 'PERMANENT', 'CANCELLED')),
  loan_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  return_due_date DATE,
  notes           TEXT,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_by      UUID,
  UNIQUE(company_id, loan_number)
);

CREATE INDEX idx_branch_loans_company ON branch_loans(company_id) WHERE deleted_at IS NULL;
```

#### `branch_loan_lines`

```sql
CREATE TABLE branch_loan_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         UUID NOT NULL REFERENCES branch_loans(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  qty_loaned      NUMERIC(20,4) NOT NULL,
  qty_returned    NUMERIC(20,4) NOT NULL DEFAULT 0,
  uom             VARCHAR(20) NOT NULL,
  cost_per_unit   NUMERIC(20,4) NOT NULL DEFAULT 0,
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_loan_lines_loan ON branch_loan_lines(loan_id);
```

---

### Fase 3 — Operational Tables

#### `daily_requisitions` (Turun barang harian)

```sql
CREATE TABLE daily_requisitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  from_warehouse_id   UUID NOT NULL REFERENCES warehouses(id),  -- MAIN
  to_warehouse_id     UUID NOT NULL REFERENCES warehouses(id),  -- READY
  requisition_date    DATE NOT NULL,
  pic_employee_id     UUID NOT NULL REFERENCES employees(id),
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
  confirmed_at        TIMESTAMPTZ,
  notes               TEXT,
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID
);

CREATE INDEX idx_daily_req_branch_date ON daily_requisitions(branch_id, requisition_date)
  WHERE deleted_at IS NULL;
```

#### `daily_requisition_lines`

```sql
CREATE TABLE daily_requisition_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id  UUID NOT NULL REFERENCES daily_requisitions(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  predicted_qty   NUMERIC(20,4) NOT NULL DEFAULT 0,   -- dari sistem prediksi
  actual_qty      NUMERIC(20,4) NOT NULL,             -- yang benar-benar diambil
  uom             VARCHAR(20) NOT NULL,
  cost_per_unit   NUMERIC(20,4) NOT NULL DEFAULT 0,
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_daily_req_lines_req ON daily_requisition_lines(requisition_id);
```

#### `daily_closing_counts` (Konfirmasi malam)

```sql
CREATE TABLE daily_closing_counts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id),  -- READY warehouse
  closing_date        DATE NOT NULL,
  pic_employee_id     UUID NOT NULL REFERENCES employees(id),
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'CONFIRMED', 'FLAGGED')),
  total_variance_cost NUMERIC(20,4) NOT NULL DEFAULT 0,
  notes               TEXT,
  confirmed_at        TIMESTAMPTZ,
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID
);

CREATE UNIQUE INDEX idx_closing_counts_unique
  ON daily_closing_counts(branch_id, closing_date)
  WHERE deleted_at IS NULL;
```

#### `daily_closing_count_lines`

```sql
CREATE TABLE daily_closing_count_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id      UUID NOT NULL REFERENCES daily_closing_counts(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  system_qty      NUMERIC(20,4) NOT NULL,             -- sisa yang harusnya (turun - theoretical)
  actual_qty      NUMERIC(20,4),                      -- hasil timbang (NULL = tidak ditimbang, pakai system_qty)
  variance_qty    NUMERIC(20,4),                      -- actual - system (NULL jika tidak ditimbang)
  cost_per_unit   NUMERIC(20,4) NOT NULL DEFAULT 0,
  variance_cost   NUMERIC(20,4),                      -- variance_qty × cost_per_unit
  photo_url       TEXT,                               -- foto timbangan (wajib untuk bahan risiko tinggi)
  is_high_risk    BOOLEAN NOT NULL DEFAULT false,     -- flag: wajib timbang
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_closing_lines_closing ON daily_closing_count_lines(closing_id);
```

---

### Tambahan di `products` (Fase 1 — kolom baru)

```sql
-- Tambah kolom untuk inventory system
ALTER TABLE products ADD COLUMN IF NOT EXISTS yield_factor NUMERIC(5,4) DEFAULT 1.0000;
  -- 1.0 = tidak ada waste, 0.7 = 30% waste (alpukat)
ALTER TABLE products ADD COLUMN IF NOT EXISTS risk_category VARCHAR(10) DEFAULT 'LOW'
  CHECK (risk_category IN ('HIGH', 'MEDIUM', 'LOW'));
  -- HIGH = wajib timbang malam (salmon, wagyu, udang)
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_source VARCHAR(20) DEFAULT 'SUPPLIER'
  CHECK (default_source IN ('SUPPLIER', 'CENTRAL_STOCK', 'CENTRAL_KITCHEN'));
  -- Sistem tahu generate dokumen apa untuk bahan ini
```

---

## Keputusan Desain (Confirmed)

### 1. Products = Global (tanpa company_id)
- `products`, `categories`, `sub_categories` sudah global — tidak perlu input 2x
- Yang per-company: `stock_balances`, `stock_movements`, `purchase_orders`, dll
- Yang per-branch: warehouse, stok, transaksi

### 2. Central Stock & Central Kitchen = Branch baru
- Dibuat sebagai record di tabel `branches` (konsisten, FK langsung nyambung)
- Ditandai via `warehouse_type` di tabel `warehouses` (bukan branch_type)
- Branch code: `CENTRAL_STOCK`, `CENTRAL_KITCHEN`

### 3. Warehouse otomatis saat tambah branch
- Setiap branch operasional → minimal 2 warehouse: MAIN + READY
- Central Stock → 1 warehouse: CENTRAL_STOCK
- Central Kitchen → 1 warehouse: CENTRAL_KITCHEN
- Tidak hardcode jumlah — bisa tambah warehouse custom jika perlu

### 4. Companies = 2 (bisa bertambah)
- `warehouses` punya `company_id` untuk multi-tenant
- `stock_balances` inherit company dari warehouse
- Products tetap global (shared across companies)

---

## Catatan Kritis

1. **Resep adalah kunci** — tanpa resep lengkap, theoretical & prediksi tidak akurat
2. **Disiplin input > fitur canggih** — implementasi bertahap (edukasi → warning → strict)
3. **Foto timbangan** — membuat data tidak bisa diperdebatkan
4. **Audit trail di setiap transaksi** — siapa, kapan, berapa
5. **Prediksi akurat dari hari 1** — karena ada historis POS 1 tahun
6. **Tidak bisa dirapel** — non-negotiable, data variance harus per hari
7. **Cost ikut barang** — setiap transfer/loan harus pindahkan cost ke cabang tujuan


---

## Implementation Status

### ✅ Completed

| Module | BE | FE | DB | Menu | Routes |
|--------|----|----|----|----|--------|
| Warehouses | ✅ | ✅ | ✅ | ✅ `/inventory/warehouses` | ✅ App.tsx |
| Stock (Balances + Movements) | ✅ | ✅ | ✅ | ✅ `/inventory/stock` + `/inventory/movements` | ✅ App.tsx |
| Opening Balance | ✅ | ✅ | — (uses stock_movements) | — (button di Stok Gudang) | ✅ `/inventory/opening-balance` |
| Stock Adjustment | ✅ | ✅ (modal) | — (uses stock_movements) | — (button di Stok Gudang) | — |
| Purchase Requests | ✅ | ✅ | ✅ | ✅ `/inventory/purchase-requests` | ✅ App.tsx |
| Purchase Orders | ✅ | ✅ | ✅ | ✅ `/inventory/purchase-orders` | ✅ App.tsx |

### ⬜ Next

| Module | Priority | Notes |
|--------|----------|-------|
| Goods Receipt | Must | Cocokkan PO, update stock |
| Transfer Orders | Must | Central → Cabang |
| Branch Loans | Should | Cabang ↔ Cabang |
| Daily Requisitions | Should | Turun barang harian (Gudang 1 → Ready) |
| Daily Closing Counts | Should | Konfirmasi malam + foto |
| Prediksi Harian | Later | Butuh semua di atas + POS historis |

### Checklist per Module (FE)

- [x] Lazy import di App.tsx
- [x] Route registered di App.tsx
- [x] Menu item di `menu.config.tsx`
- [x] Permission module registered (BE `PermissionService.registerModule`)
- [x] Permission guard di halaman (`RequirePermission`)
- [x] Permission guard di tombol aksi (`usePermissionStore.hasPermission`)
