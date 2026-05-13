# Goods Processing (Barang Masuk) — Design Document

> **Part 1 of 2** — Dokumen ini cover Goods Processing module.
> Part 2: `PURCHASE_INVOICE_DESIGN.md` — cover Purchase Invoice + jurnal.

---

## Tujuan

Mencatat proses transformasi barang dari supplier **sebelum masuk warehouse**. Semua barang yang diterima di GR **wajib** melewati Goods Processing sebelum stock tercatat di sistem.

**2 tipe proses:**
1. **Pass-through** — barang langsung masuk apa adanya (beras, bumbu, dll)
2. **Disassembly** — 1 input dipecah jadi banyak output (salmon utuh → fillet + head + waste)

---

## Perbedaan dengan WIP (Existing)

| | WIP / Production Order | Goods Processing |
|---|---|---|
| Tipe | **Assembly** — banyak bahan → 1 output | **Disassembly** — 1 input → banyak output |
| Trigger | Production Order (harian, dari dapur) | GR Confirmed (barang baru datang dari supplier) |
| Tujuan | Produksi menu (saos, nasi sushi) | Proses barang mentah sebelum masuk gudang |
| Contoh | 5 bahan → 1 batch Nasi Sushi 5000gr | 50kg salmon utuh → 35kg fillet + 8kg head + 7kg waste |
| Cost source | Dari ingredients (sudah diketahui) | Dari Purchase Invoice (belum diketahui saat proses) |
| Siapa | Tim Dapur / Produksi | Tim Gudang + QC |

---

## Full Flow (Context)

```
PR → PO → GR (tim lapangan, qty dari supplier)
              ↓
     [GOODS PROCESSING] ← MODULE INI
       - Semua item GR wajib lewat sini
       - Pass-through: auto-generate, QC bisa skip/auto
       - Disassembly: manual input output + waste + foto
       - QC konfirmasi → stock masuk warehouse
              ↓
     [WAREHOUSE] — stock qty tercatat (cost masih 0)
              ↓
     [PURCHASE INVOICE] — finance input harga + PPN
       - Cost allocation proporsional ke output
       - Update avg_cost di stock
       - Generate jurnal akuntansi
```

---

## Status Flow

```
DRAFT → PROCESSING → QC_REVIEW → CONFIRMED
                         ↘ REJECTED → (revisi → QC_REVIEW lagi)
```

| Status | Siapa | Aksi |
|--------|-------|------|
| DRAFT | System | Auto-created saat GR confirmed |
| PROCESSING | Tim Gudang | Input output aktual, waste, foto timbangan |
| QC_REVIEW | Tim Gudang | Submit ke QC setelah selesai proses |
| CONFIRMED | Tim QC | QC approve → stock movement terjadi |
| REJECTED | Tim QC | Kembalikan ke tim gudang untuk revisi |

### Pass-through Shortcut

Untuk barang yang tidak perlu proses (beras, bumbu, dll):
- Status langsung: `DRAFT → QC_REVIEW → CONFIRMED`
- Skip `PROCESSING` — output = input (qty sama, produk sama)
- QC bisa bulk-confirm semua pass-through sekaligus

---

## Database Schema

### `goods_processing` — Header

```sql
CREATE TABLE goods_processing (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
  goods_receipt_id    UUID NOT NULL REFERENCES goods_receipts(id),
  processing_number   VARCHAR(50) NOT NULL,
  processing_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  processing_type     VARCHAR(20) NOT NULL DEFAULT 'PASS_THROUGH'
                        CHECK (processing_type IN ('PASS_THROUGH', 'DISASSEMBLY')),
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'PROCESSING', 'QC_REVIEW', 'CONFIRMED', 'REJECTED')),
  notes               TEXT,
  rejection_reason    TEXT,

  -- People
  processed_by        UUID,                -- tim gudang yang proses
  processed_at        TIMESTAMPTZ,
  qc_confirmed_by     UUID,                -- QC yang approve
  qc_confirmed_at     TIMESTAMPTZ,
  rejected_by         UUID,
  rejected_at         TIMESTAMPTZ,

  -- Yield summary (dihitung saat QC confirm)
  total_input_qty     NUMERIC(20,4),       -- SUM inputs
  total_output_qty    NUMERIC(20,4),       -- SUM outputs (non-waste)
  total_waste_qty     NUMERIC(20,4),       -- SUM waste
  yield_percentage    NUMERIC(5,2),        -- (total_output / total_input) × 100

  -- Soft delete & audit
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,

  UNIQUE(company_id, processing_number)
);

CREATE INDEX idx_goods_processing_company ON goods_processing(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_goods_processing_gr ON goods_processing(goods_receipt_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_goods_processing_status ON goods_processing(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_goods_processing_branch_date ON goods_processing(branch_id, processing_date) WHERE deleted_at IS NULL;
```

### `goods_processing_inputs` — Apa yang masuk (dari GR line)

```sql
CREATE TABLE goods_processing_inputs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_processing_id   UUID NOT NULL REFERENCES goods_processing(id) ON DELETE CASCADE,
  gr_line_id            UUID NOT NULL REFERENCES goods_receipt_lines(id),
  product_id            UUID NOT NULL REFERENCES products(id),
  qty_input             NUMERIC(20,4) NOT NULL,       -- qty dari GR (yang diterima)
  uom                   VARCHAR(30) NOT NULL,
  sort_order            INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_gp_inputs_processing ON goods_processing_inputs(goods_processing_id);
CREATE INDEX idx_gp_inputs_gr_line ON goods_processing_inputs(gr_line_id);
```

### `goods_processing_outputs` — Hasil setelah proses

```sql
CREATE TABLE goods_processing_outputs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_processing_id   UUID NOT NULL REFERENCES goods_processing(id) ON DELETE CASCADE,
  input_id              UUID NOT NULL REFERENCES goods_processing_inputs(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES products(id),
  qty_output            NUMERIC(20,4) NOT NULL,
  uom                   VARCHAR(30) NOT NULL,
  is_waste              BOOLEAN NOT NULL DEFAULT false,  -- true = waste, tidak masuk stock, tidak dapat cost
  waste_reason          TEXT,                            -- alasan waste (tulang, kulit, air, dll)
  photo_urls            TEXT[],                          -- foto timbangan (multiple, wajib untuk disassembly)

  -- Cost fields (diisi saat Purchase Invoice posted)
  unit_cost             NUMERIC(20,4),                   -- NULL sampai invoice posted
  allocated_cost        NUMERIC(20,4),                   -- NULL sampai invoice posted

  -- Stock movement link (diisi saat QC confirmed)
  stock_movement_id     UUID REFERENCES stock_movements(id),

  -- Link balik ke purchase invoice line (diisi saat invoice posted)
  purchase_invoice_line_id UUID REFERENCES purchase_invoice_lines(id),

  sort_order            INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_gp_outputs_processing ON goods_processing_outputs(goods_processing_id);
CREATE INDEX idx_gp_outputs_input ON goods_processing_outputs(input_id);
CREATE INDEX idx_gp_outputs_product ON goods_processing_outputs(product_id);
```

---

## Processing Number Format

```
GP-{BRANCH_CODE}-{YYYYMMDD}-{SEQ}
```

Contoh: `GP-JAK-001-20260513-001`

### Sequence Generation

Sama pattern dengan GR number — pakai advisory lock:

```typescript
async generateGpNumber(client: PoolClient, companyId: string, branchCode: string): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `GP-${branchCode}-${dateStr}`

  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${companyId}-${prefix}`])

  const { rows } = await client.query(
    `SELECT processing_number FROM goods_processing WHERE company_id = $1 AND processing_number LIKE $2 ORDER BY processing_number DESC LIMIT 1`,
    [companyId, `${prefix}-%`]
  )

  const lastSeq = rows.length > 0 ? parseInt(rows[0].processing_number.split('-').pop() || '0') : 0
  return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
}
```

---

## Auto-Create dari GR Confirm

Saat GR di-confirm, sistem otomatis buat Goods Processing:

```typescript
// Di goods-receipts.service.ts → confirm()
// Setelah update PO status, sebelum commit:

// Auto-create Goods Processing
const gpNumber = await generateGpNumber(client, companyId, branchCode)
const gp = await client.query(`
  INSERT INTO goods_processing (company_id, branch_id, warehouse_id, goods_receipt_id, processing_number, processing_date, processing_type, status, created_by)
  VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', $8) RETURNING id
`, [companyId, gr.branch_id, gr.warehouse_id, gr.id, gpNumber, gr.received_date, detectProcessingType(gr.lines), userId])

// Auto-create inputs (1 per GR line)
for (const line of gr.lines) {
  const inputId = await client.query(`
    INSERT INTO goods_processing_inputs (goods_processing_id, gr_line_id, product_id, qty_input, uom)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [gp.id, line.id, line.product_id, line.qty_received, line.uom])

  // Auto-create default output (pass-through: output = input)
  await client.query(`
    INSERT INTO goods_processing_outputs (goods_processing_id, input_id, product_id, qty_output, uom, is_waste)
    VALUES ($1, $2, $3, $4, $5, false)
  `, [gp.id, inputId, line.product_id, line.qty_received, line.uom])
}
```

### Detect Processing Type

```typescript
function detectProcessingType(lines: GRLine[]): 'PASS_THROUGH' | 'DISASSEMBLY' {
  // Cek apakah ada produk yang perlu proses (salmon, ayam, dll)
  // Bisa dari field products.requires_processing (kolom baru)
  // Atau dari hardcoded list dulu untuk MVP
  // Untuk sekarang: default PASS_THROUGH, user bisa ubah ke DISASSEMBLY di UI
  return 'PASS_THROUGH'
}
```

---

## Kolom Baru di `products`

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_processing BOOLEAN NOT NULL DEFAULT false;
-- true = salmon, ayam (perlu potong/trim sebelum masuk gudang)
-- false = beras, bumbu, dll (langsung pass-through)
```

---

## Business Rules

### Pass-through
- Output = Input (produk sama, qty sama)
- Tidak perlu foto
- QC bisa bulk-confirm
- Tidak ada waste

### Disassembly
- 1 Input → multiple outputs (produk bisa berbeda)
- Foto timbangan **wajib** per output
- Total output qty (non-waste) + waste qty harus ≤ input qty (bisa kurang karena penguapan/air)
- QC harus review satu per satu
- Waste dicatat dengan alasan

### Validasi saat Submit ke QC
```
SUM(output.qty_output WHERE is_waste = false) + SUM(output.qty_output WHERE is_waste = true) <= input.qty_input
```

Jika total output > input → error (tidak mungkin hasil lebih banyak dari bahan)

### Validasi saat QC Confirm
- Semua output harus punya qty > 0
- Disassembly: semua output non-waste harus punya foto
- Tidak boleh ada output dengan qty = 0 (hapus saja jika tidak ada)

---

## Stock Movement saat QC Confirmed

Saat QC confirm, stock masuk ke warehouse:

```typescript
// Untuk setiap output yang BUKAN waste:
for (const output of outputs.filter(o => !o.is_waste)) {
  const movement = await stockRepository.createMovement(client, {
    warehouse_id: gp.warehouse_id,
    product_id: output.product_id,
    movement_type: 'IN_PURCHASE',
    qty: output.qty_output,
    cost_per_unit: 0,              // ← belum diketahui, diisi saat invoice posted
    reference_type: 'goods_processing',
    reference_id: gp.id,
    notes: `GP ${gp.processing_number}`,
    created_by: userId,
  }, newBalance)

  // Update stock balance (qty naik, avg_cost belum berubah karena cost = 0)
  await stockRepository.upsertBalance(client, gp.warehouse_id, output.product_id, newQty, currentAvgCost)

  // Link movement ke output
  await client.query('UPDATE goods_processing_outputs SET stock_movement_id = $1 WHERE id = $2', [movement.id, output.id])
}
```

**Catatan penting:** `cost_per_unit = 0` saat ini. Akan di-update oleh Purchase Invoice module saat invoice posted (backfill cost).

---

## API Endpoints

| Method | Path | Fungsi | Permission |
|--------|------|--------|------------|
| GET | `/goods-processing` | List (filter: status, branch, date) | `goods_processing:view` |
| GET | `/goods-processing/:id` | Detail + inputs + outputs | `goods_processing:view` |
| GET | `/goods-processing/pending` | List yang perlu diproses (DRAFT/PROCESSING) | `goods_processing:view` |
| GET | `/goods-processing/qc-queue` | List yang menunggu QC (QC_REVIEW) | `goods_processing:view` |
| PUT | `/goods-processing/:id` | Update outputs (DRAFT/PROCESSING/REJECTED only) | `goods_processing:update` |
| POST | `/goods-processing/:id/start` | DRAFT → PROCESSING | `goods_processing:update` |
| POST | `/goods-processing/:id/submit-qc` | PROCESSING → QC_REVIEW | `goods_processing:update` |
| POST | `/goods-processing/:id/confirm` | QC_REVIEW → CONFIRMED (+ stock movement) | `goods_processing:approve` |
| POST | `/goods-processing/:id/reject` | QC_REVIEW → REJECTED | `goods_processing:approve` |
| POST | `/goods-processing/bulk-confirm` | Bulk QC confirm (pass-through only) | `goods_processing:approve` |

---

## Frontend Pages

### Routing

| Path | Page | Siapa |
|------|------|-------|
| `/inventory/goods-processing` | GoodsProcessingPage | Tim Gudang |
| `/inventory/goods-processing/:id` | GoodsProcessingDetailPage | Tim Gudang |
| `/inventory/goods-processing/qc` | GoodsProcessingQCPage | Tim QC |

### GoodsProcessingPage — List untuk Tim Gudang

```
┌─────────────────────────────────────────────────────────────────┐
│ Barang Masuk                                                     │
├─────────────────────────────────────────────────────────────────┤
│ Filter: [Semua Status ▼] [Hari ini ▼] [Semua Cabang ▼]          │
│                                                                  │
│ [Perlu Diproses (3)]  [Menunggu QC (1)]  [Selesai]              │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ GP-JAK-001-20260513-001          DRAFT                       │ │
│ │ GR: GR-JAK-001-20260513-004 · Wahana Inti Makmur            │ │
│ │ 1 item · Pass-through                                        │ │
│ │                                          [Proses →]          │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ GP-JAK-001-20260513-002          PROCESSING                  │ │
│ │ GR: GR-JAK-001-20260513-005 · Aneka Pangan                  │ │
│ │ 3 items · Disassembly (salmon, ayam)                         │ │
│ │                                          [Lanjut →]          │ │
│ └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### GoodsProcessingDetailPage — Proses Barang

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Kembali                                                        │
│ GP-JAK-001-20260513-002          Status: PROCESSING              │
│ GR: GR-JAK-001-20260513-005 · Wahana Inti Makmur                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ── Input: Salmon Utuh (50 kg) ─────────────────────────────────  │
│                                                                  │
│ Output:                                                          │
│ ┌────────────┬──────────┬──────────┬────────┬──────────────────┐ │
│ │ Produk     │ Qty      │ UOM      │ Waste? │ Foto             │ │
│ │ [Salmon Fillet ▼] │ [35  ]  │ kg      │ [ ]    │ [📷 Upload]    │ │
│ │ [Salmon Head ▼]   │ [8   ]  │ kg      │ [ ]    │ [📷 Upload]    │ │
│ │ [Waste ▼]         │ [7   ]  │ kg      │ [✓]    │ Tulang & kulit │ │
│ │ [+ Tambah Output]                                             │ │
│ └────────────┴──────────┴──────────┴────────┴──────────────────┘ │
│                                                                  │
│ Total Output: 43 kg (non-waste) + 7 kg (waste) = 50 kg ✓        │
│                                                                  │
│ ── Input: Beras Sushi (200 kg) ── [Pass-through] ──────────────  │
│ Output: Beras Sushi 200 kg ✓ (otomatis, tidak perlu edit)        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                              [Submit ke QC]                       │
└─────────────────────────────────────────────────────────────────┘
```

### GoodsProcessingQCPage — Review untuk QC

```
┌─────────────────────────────────────────────────────────────────┐
│ QC Review — Barang Masuk                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Pass-through (2 items)                    [✓ Confirm Semua]      │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ [✓] Beras Sushi 200 kg                                       │ │
│ │ [✓] Kecap Manis 10 liter                                     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Disassembly (perlu review detail)                                │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ GP-JAK-001-20260513-002                                      │ │
│ │ Salmon Utuh 50kg → Fillet 35kg + Head 8kg + Waste 7kg        │ │
│ │ 📷 3 foto terlampir                                           │ │
│ │                              [Tolak]  [✓ Confirm]            │ │
│ └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Contoh Skenario

### Skenario 1: Beras (Pass-through)

```
GR: Beras Sushi 200 kg
  ↓ (GR confirmed → auto-create GP)
GP Input: Beras Sushi 200 kg
GP Output: Beras Sushi 200 kg (auto-generated, same product)
  ↓ (Tim gudang submit ke QC)
  ↓ (QC bulk-confirm)
Stock: +200 kg Beras Sushi @ cost 0 (pending invoice)
```

### Skenario 2: Salmon (Disassembly)

```
GR: Salmon Utuh 50 kg
  ↓ (GR confirmed → auto-create GP)
GP Input: Salmon Utuh 50 kg
GP Output (auto-generated): Salmon Utuh 50 kg
  ↓ (Tim gudang ubah ke disassembly mode)
GP Output (manual):
  - Salmon Fillet 35 kg (foto: ✓)
  - Salmon Head 8 kg (foto: ✓)
  - Waste 7 kg (tulang + kulit, foto: ✓)
  ↓ (Submit ke QC)
  ↓ (QC review foto, confirm)
Stock: +35 kg Salmon Fillet @ cost 0
Stock: +8 kg Salmon Head @ cost 0
(Waste tidak masuk stock)
```

### Skenario 3: Cost Allocation (saat Invoice posted)

```
Purchase Invoice: Salmon Utuh 50 kg @ Rp 100.000 = Rp 5.000.000

Allocable output: Fillet 35kg + Head 8kg = 43kg (waste excluded)

Allocation:
  Fillet: (35/43) × 5.000.000 = Rp 4.069.767 → unit_cost = 116.279/kg
  Head:   (8/43)  × 5.000.000 = Rp   930.233 → unit_cost = 116.279/kg
  Waste:  Rp 0

Update stock_movements.cost_per_unit + stock_balances.avg_cost
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| GR punya 5 items, 1 perlu disassembly | 1 GP dengan mixed: 4 pass-through + 1 disassembly |
| Output qty > input qty | Block — validasi error |
| Output qty < input qty (penguapan) | OK — selisih dianggap natural loss |
| QC reject | Status → REJECTED, tim gudang revisi output, submit ulang |
| GP belum confirmed tapi invoice sudah masuk | Invoice bisa dibuat, tapi cost allocation pending sampai GP confirmed |
| Produk output belum ada di master | Harus buat dulu di master products (misal: "Salmon Fillet" sebagai produk terpisah) |
| 1 GR → 1 GP (always) | Tidak bisa split 1 GR jadi multiple GP |
| GP sudah confirmed, mau revisi | Tidak bisa — harus void GP + buat ulang (atau adjustment) |
| Barang rejected di GR (qty_rejected) | Tidak masuk GP input — hanya qty_received yang masuk |

---

## Relasi dengan Module Lain

```
goods_receipts (GR confirmed)
    │
    ├── 1:1 → goods_processing (auto-created)
    │              │
    │              ├── goods_processing_inputs (dari GR lines)
    │              │
    │              └── goods_processing_outputs
    │                      │
    │                      ├── stock_movements (saat QC confirmed, cost=0)
    │                      │
    │                      └── ← purchase_invoice_lines (cost allocation saat posted)
    │
    └── purchase_invoice_gr_links (link ke invoice)
```

---

## Module Structure (Backend)

```
backend/src/modules/goods-processing/
├── goods-processing.types.ts
├── goods-processing.errors.ts
├── goods-processing.schema.ts
├── goods-processing.repository.ts
├── goods-processing.service.ts
├── goods-processing.controller.ts
└── goods-processing.routes.ts
```

---

## Permission

```typescript
PermissionService.registerModule('goods_processing', 'Barang Masuk / Goods Processing')
// Actions: canView, canUpdate (tim gudang), canApprove (QC)
```

---

## Build Sequence

| Step | Apa | Dependency |
|------|-----|------------|
| 1 | SQL migration: 3 tables + index + kolom `requires_processing` di products | — |
| 2 | Types + Errors + Schema | — |
| 3 | Repository | Step 1 |
| 4 | Service (create from GR, update outputs, status transitions, stock movement) | Step 3 |
| 5 | Controller + Routes | Step 4 |
| 6 | Modify GR confirm → auto-create GP | Step 4 |
| 7 | Frontend: GoodsProcessingPage (list) | Step 5 |
| 8 | Frontend: GoodsProcessingDetailPage (proses + edit output) | Step 5 |
| 9 | Frontend: GoodsProcessingQCPage (review + confirm) | Step 5 |

---

## Catatan Penting

1. **Stock masuk saat QC confirmed** — bukan saat GR confirmed
2. **Cost = 0 dulu** — diisi oleh Purchase Invoice module saat posted
3. **1 GR = 1 GP** — tidak bisa split
4. **Pass-through = mayoritas barang** — harus cepat & mudah (bulk confirm)
5. **Disassembly = hanya salmon & ayam** — perlu foto + QC review detail
6. **Waste dicatat** — untuk tracking yield accuracy & supplier evaluation
7. **`requires_processing` di products** — flag untuk auto-detect tipe GP

---

## Related Docs

- Part 2: `.amazonq/docs/PURCHASE_INVOICE_DESIGN.md`
- Inventory System: `.amazonq/docs/INVENTORY_SYSTEM_V2_PLAN.md`
- GR Module: `.amazonq/docs/GOODS_RECEIPT_PLAN.md`
- PO Flow: `.amazonq/docs/PO_FLOW_DECISION.md`
