# GR UOM Conversion (Dual UOM) — Design Document

> **Masalah:** Satuan PO (Ekor) ≠ satuan operasional GR/GP (KG/Gram).
> Salmon dibeli per Ekor, ditimbang saat terima dalam KG, dipecah di GP dalam Gram.
> Invoice dibayar per satuan timbang (KG), bukan per Ekor.

---

## Flow Setelah Perubahan

```
PO: 5 Ekor Salmon @ Rp 200.000/Ekor (kontrak)
  ↓
GR Form:
  - PO Line: Salmon 5 Ekor (readonly)
  - Qty Diterima (satuan PO): [2] Ekor ← berapa unit PO yang datang
  - Hasil Timbang: [7.2] KG ← aktual setelah timbang (satuan operasional)
  - UOM Received: KG
  ↓
PO Tracking: qty_received += 2 Ekor → sisa 3 Ekor
  ↓
Goods Processing: 7.2 KG (= 7200 Gram) → pecah ke output
  - Fillet: 5000 Gram
  - Head: 1200 Gram
  - Waste: 1000 Gram
  ↓
Purchase Invoice: 7.2 KG × Rp xxx/KG (bayar per satuan timbang)
```

---

## Kapan Dual UOM Berlaku?

**HANYA jika satuan PO berbeda dari satuan operasional.**

| Produk | UOM PO | UOM Operasional | Perlu Konversi? |
|--------|--------|-----------------|-----------------|
| Badan Salmon | Ekor | KG | ✅ Ya |
| Ayam | Ekor | KG | ✅ Ya |
| Beras Sushi | KG | KG | ❌ Tidak (sama) |
| Avocado Powder | Gram | Gram | ❌ Tidak (sama) |
| Kecap | Botol | Mililiter | ✅ Ya (jika perlu timbang isi) |

**Rule:** Jika `uom_po === uom_received` → field konversi hidden, `qty_received = qty_po_uom`.

---

## Database Changes

### ALTER `goods_receipt_lines`

```sql
-- Kolom baru untuk dual UOM
ALTER TABLE goods_receipt_lines
  ADD COLUMN qty_po_uom NUMERIC(20,4),           -- qty dalam satuan PO (misal: 2 Ekor)
  ADD COLUMN uom_po VARCHAR(30),                 -- satuan PO (Ekor)
  ADD COLUMN uom_received VARCHAR(30),           -- satuan operasional (KG)
  ADD COLUMN conversion_factor NUMERIC(20,6);    -- aktual: 1 unit PO = ? unit received (misal: 3.6)

-- Backfill existing data: qty_po_uom = qty_received, uom_po = uom dari PO line
-- (karena sebelumnya semua GR pakai satuan yang sama dengan PO)
UPDATE goods_receipt_lines grl
SET
  qty_po_uom = grl.qty_received,
  uom_po = pol.uom,
  uom_received = pol.uom,
  conversion_factor = 1
FROM purchase_order_lines pol
WHERE grl.po_line_id = pol.id AND grl.qty_po_uom IS NULL;

-- Setelah backfill, set NOT NULL
ALTER TABLE goods_receipt_lines ALTER COLUMN qty_po_uom SET NOT NULL;
ALTER TABLE goods_receipt_lines ALTER COLUMN uom_po SET NOT NULL;
ALTER TABLE goods_receipt_lines ALTER COLUMN uom_received SET NOT NULL;
ALTER TABLE goods_receipt_lines ALTER COLUMN conversion_factor SET NOT NULL;
ALTER TABLE goods_receipt_lines ALTER COLUMN conversion_factor SET DEFAULT 1;

-- Safety constraint
ALTER TABLE goods_receipt_lines ADD CONSTRAINT chk_conversion_factor_positive CHECK (conversion_factor > 0);
```

---

## Field Semantics

| Field | Arti | Contoh (Salmon) | Contoh (Beras) |
|-------|------|-----------------|----------------|
| `qty_po_uom` | Berapa unit PO yang diterima | 2 (Ekor) | 200 (KG) |
| `uom_po` | Satuan PO (**snapshot** dari `purchase_order_lines.uom` saat GR dibuat) | Ekor | KG |
| `qty_received` | Qty aktual dalam satuan operasional | 7.2 (KG) | 200 (KG) |
| `uom_received` | Satuan operasional (untuk GP & Invoice) | KG | KG |
| `conversion_factor` | 1 unit PO = ? unit received | 3.6 (1 Ekor = 3.6 KG) | 1 |

### `uom_po` — Intentional Snapshot

`uom_po` adalah **denormalized snapshot** dari `purchase_order_lines.uom` saat GR dibuat. Alasan:
- GR adalah dokumen historis — harus bisa dibaca tanpa JOIN ke PO
- Jika PO di-edit setelah GR dibuat, GR tetap menunjukkan satuan yang berlaku saat penerimaan
- Konsisten dengan pattern snapshot lain di sistem (misal `unit_price_po` di GR lines)

### Relasi Antar Field

```
qty_received = qty_po_uom × conversion_factor

Contoh: 2 Ekor × 3.6 = 7.2 KG
```

**Catatan:** `conversion_factor` di sini adalah **aktual** (hasil timbang), bukan estimasi dari `product_uoms`. Estimasi dari `product_uoms` hanya untuk suggest default di form.

---

## `qty_rejected` — Dalam Satuan Apa?

### Keputusan: `qty_rejected` dalam satuan PO (`uom_po`)

**Flow rejection:**
1. Barang datang 5 Ekor
2. Sebelum timbang, 1 ekor terlihat busuk → reject
3. User input: `qty_po_uom = 4`, `qty_rejected = 1` (keduanya dalam Ekor)
4. 4 ekor yang diterima ditimbang → `qty_received = 14.8 KG`

**Rule:**
- `qty_rejected` selalu dalam `uom_po` (satuan PO)
- `qty_po_uom + qty_rejected` ≤ qty yang datang (tapi tidak di-enforce di DB karena "qty yang datang" tidak disimpan)
- `qty_received` = hasil timbang dari `qty_po_uom` yang diterima (bukan dari total yang datang)
- Rejection terjadi **sebelum** timbang — barang yang ditolak tidak ditimbang

**Jika rejection setelah timbang** (edge case: timbang dulu baru ketahuan busuk):
- User kurangi `qty_po_uom` dan `qty_received` sesuai
- Atau: biarkan masuk GP, lalu catat sebagai waste di GP (lebih akurat)

---

## PO Tracking Logic

PO tracking tetap pakai satuan PO:

```typescript
// Saat GR confirm:
await incrementPoLineQtyReceived(client, poLineId, line.qty_po_uom)
// BUKAN qty_received — karena PO line qty dalam satuan PO (Ekor)
```

Sisa PO = `po_line.qty - po_line.qty_received` (dalam satuan PO).

---

## Goods Processing Input

GP input menggunakan `qty_received` + `uom_received` (satuan operasional):

```typescript
// Saat auto-create GP dari GR confirm:
await client.query(
  `INSERT INTO goods_processing_inputs (goods_processing_id, gr_line_id, product_id, qty_input, uom)
   VALUES ($1, $2, $3, $4, $5)`,
  [gpId, line.id, line.product_id, line.qty_received, line.uom_received]
)
// GP input: 7.2 KG (bukan 2 Ekor)
```

---

## Purchase Invoice

Invoice menggunakan `qty_received` + `uom_received`:

```
Invoice line:
  qty_invoiced: 7.2 (KG)
  unit_price: user-entered dari invoice fisik supplier (misal Rp 55.000/KG)
  total: Rp 396.000
```

**`unit_price_invoice` adalah USER-ENTERED** — diketik dari invoice fisik supplier, bukan derived/calculated. Ini menghindari masalah rounding dari pembagian harga PO.

---

## Price Variance Calculation — Canonical Method

**Metode yang dipilih: Compare Total (bukan per-unit)**

```typescript
// Total PO value untuk qty ini:
const poTotal = line.qty_po_uom * poLine.unit_price
// Contoh: 2 × 200.000 = 400.000

// Total Invoice value:
const invoiceTotal = line.qty_received * line.unit_price_invoice
// Contoh: 7.2 × 55.000 = 396.000

// Variance:
const variance = invoiceTotal - poTotal
// 396.000 - 400.000 = -4.000 (invoice lebih murah)

// Variance percentage (terhadap PO total):
const variancePct = poTotal > 0 ? Math.abs(variance / poTotal) * 100 : 0
// 4.000 / 400.000 × 100 = 1.0%
```

**Alasan pilih compare total:**
- Menghindari floating-point error dari pembagian per-unit
- Lebih intuitif: "PO bilang 400rb, invoice bilang 396rb, selisih 4rb"
- Tidak perlu convert harga antar satuan

---

## Cost Allocation Rounding Rule

Saat Purchase Invoice posted, cost dialokasi proporsional ke GP outputs:

```typescript
// Rounding rule: LAST ITEM ABSORBS REMAINDER
let allocated = 0
for (let i = 0; i < outputs.length; i++) {
  if (i === outputs.length - 1) {
    // Last non-waste item gets remainder
    output.allocated_cost = totalCost - allocated
  } else {
    const ratio = output.qty_output / totalAllocableQty
    output.allocated_cost = Math.round(totalCost * ratio)
    allocated += output.allocated_cost
  }
  output.unit_cost = output.allocated_cost / output.qty_output
}
```

Ini memastikan `SUM(allocated_cost) === totalCost` selalu exact, tanpa selisih rounding.

---

## Conversion Factor Validation

### Backend Validation (Hard Block)

```typescript
// 1. Must be positive (also enforced by DB CHECK constraint)
if (conversionFactor <= 0) throw new BusinessRuleError('Conversion factor harus > 0')

// 2. Reasonable range: 50% to 200% of estimated (from product_uoms)
const estimated = getEstimatedConversionFactor(productId, uomPo, uomReceived)
if (estimated > 0) {
  const ratio = conversionFactor / estimated
  if (ratio < 0.5 || ratio > 2.0) {
    throw new BusinessRuleError(
      `Konversi aktual (${conversionFactor}) terlalu jauh dari estimasi (${estimated}). ` +
      `Range yang diizinkan: ${(estimated * 0.5).toFixed(2)} - ${(estimated * 2.0).toFixed(2)}`
    )
  }
}
// Jika tidak ada estimasi (product_uoms kosong), skip range check
```

### Frontend Warning (Soft, Non-blocking)

```typescript
// Warning kuning jika deviasi > 10% dari estimasi
const deviation = Math.abs(actual - estimated) / estimated * 100
if (deviation > 10) showWarning(`Berat aktual berbeda ${deviation.toFixed(0)}% dari estimasi`)
```

---

## UOM Received — Validation

### Backend Validation

`uom_received` harus ada di `product_uoms` untuk produk tersebut (active, not deleted):

```typescript
// Validate uom_received exists for this product
const validUoms = await getActiveProductUoms(productId)
const receivedUom = validUoms.find(u => u.unit_name === uomReceived)
if (!receivedUom) {
  throw new BusinessRuleError(`UOM "${uomReceived}" tidak terdaftar untuk produk ini`)
}
```

Ini mencegah user memilih UOM yang tidak relevan (misal "Botol" untuk salmon). Tidak perlu enforce hierarki — cukup pastikan UOM terdaftar di `product_uoms` produk tersebut.

---

## Frontend GR Form Changes

### Saat UOM PO ≠ UOM Received (Salmon: Ekor → KG)

```
┌─────────────────────────────────────────────────────────────────┐
│ Badan Salmon                                                     │
│                                                                  │
│ PO: 5 Ekor @ Rp 200.000                                         │
│ Sisa: 3 Ekor                                                    │
│                                                                  │
│ Qty Diterima (Ekor): [2    ]  ← berapa ekor yang datang         │
│ Qty Ditolak (Ekor):  [0    ]  ← reject sebelum timbang          │
│ Hasil Timbang:       [7.2  ]  [KG ▼]  ← aktual setelah timbang  │
│                                                                  │
│ Konversi aktual: 1 Ekor = 3.600 KG                              │
│ ⚠️ Estimasi sistem: 1 Ekor ≈ 3.500 KG (deviasi 2.9%)            │
│                                                                  │
│ Harga Invoice (/KG): [55.000]  ← dari invoice fisik supplier    │
│ Total: Rp 396.000                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Saat UOM PO = UOM Received (Beras: KG → KG)

```
┌─────────────────────────────────────────────────────────────────┐
│ Beras Sushi                                                      │
│                                                                  │
│ PO: 200 KG @ Rp 12.000                                          │
│ Sisa: 200 KG                                                    │
│                                                                  │
│ Qty Diterima (KG): [200  ]  ← langsung, tidak perlu konversi    │
│ Qty Ditolak (KG):  [0    ]                                       │
│                                                                  │
│ Harga Invoice (/KG): [12.000]                                    │
│ Total: Rp 2.400.000                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Auto-Suggest Conversion Factor

Saat user input `qty_po_uom`, sistem suggest `qty_received` berdasarkan `product_uoms.conversion_factor`:

```typescript
// Lookup: product_uoms WHERE product_id AND unit_name matches PO UOM
// Badan Salmon: Ekor → conversion_factor = 3500 (Gram per Ekor)
//
// Jika uom_received = KG, cari conversion_factor KG = 1000 (Gram per KG)
// Estimasi: qty_po_uom × (poUomCF / receivedUomCF)
// 2 × (3500 / 1000) = 7.0 KG (estimasi)
// User override ke 7.2 KG (aktual timbang)
```

---

## Impact ke Module Lain

### 1. Goods Processing
- Input qty = `gr_line.qty_received` dalam `uom_received` → **tidak berubah**
- GP sudah terima qty dalam satuan operasional

### 2. Purchase Invoice
- Invoice line qty = `gr_line.qty_received` dalam `uom_received` → **tidak berubah**
- Finance input harga per `uom_received` (per KG)
- Cost allocation ke GP outputs tetap proporsional by weight

### 3. Stock Movement
- Stock masuk dalam `uom_received` → **tidak berubah**
- `stock_balances` sudah track per product (base unit internally)

### 4. PO Status Tracking
- **BERUBAH:** `incrementPoLineQtyReceived` pakai `qty_po_uom` (bukan `qty_received`)
- Sisa PO dihitung dalam satuan PO

### 5. Pending Qty Calculation ⚠️ BREAKING CHANGE
- **BERUBAH:** `findPendingQtyByPo` harus SUM `qty_po_uom` (bukan `qty_received`)
- Karena PO line qty dalam satuan PO
- **Impact:** Frontend GR form yang menampilkan "sisa qty" harus pakai field baru ini
- Setelah migration + backfill, hasilnya sama (karena backfill set `qty_po_uom = qty_received`)

---

## Backend Changes Summary

### Schema (`goods-receipts.schema.ts`)

```typescript
const lineSchema = z.object({
  po_line_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_po_uom: z.number().positive(),              // NEW: qty dalam satuan PO
  qty_received: z.number().positive(),            // qty dalam satuan operasional
  uom_received: z.string().max(30),               // NEW: satuan operasional
  unit_price_invoice: z.number().min(0),          // harga per uom_received (user-entered)
  qty_rejected: z.number().min(0).optional().default(0),
  reject_reason: z.string().max(50).nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
})
```

### Types (`goods-receipts.types.ts`)

```typescript
export interface GoodsReceiptLine {
  // ... existing fields ...
  qty_po_uom: number           // NEW
  uom_po: string               // NEW (snapshot)
  uom_received: string         // NEW
  conversion_factor: number    // NEW
}

export interface CreateGoodsReceiptLineDto {
  // ... existing fields ...
  qty_po_uom: number           // NEW
  uom_received: string         // NEW
}
```

### Repository Changes

1. `insertLines` — include new columns (`qty_po_uom`, `uom_po`, `uom_received`, `conversion_factor`)
2. `replaceLines` — include new columns
3. `findPendingQtyByPo` — SUM `qty_po_uom` instead of `qty_received`
4. LINE_SELECT — include new columns (`grl.qty_po_uom, grl.uom_po, grl.uom_received, grl.conversion_factor`)

### Service Changes

1. `create` — calculate `conversion_factor = qty_received / qty_po_uom`, set `uom_po` from PO line, validate conversion range
2. `confirm` — use `qty_po_uom` for PO tracking, `qty_received` + `uom_received` for GP input
3. Validation: `qty_po_uom` must not exceed remaining PO qty (in PO UOM)
4. Variance: use compare-total method

---

## Edge Cases

| Case | Handling |
|------|----------|
| UOM PO = UOM received (beras KG→KG) | `qty_po_uom = qty_received`, `conversion_factor = 1`, hide konversi UI |
| Conversion factor > 200% estimasi | Hard block — BusinessRuleError |
| Conversion factor 10-50% off estimasi | Warning di UI (kuning), tidak blocking |
| User input qty_received tapi lupa qty_po_uom | Required field, form tidak bisa submit |
| Salmon 1 ekor tapi berat beda-beda | Normal — conversion_factor per GR line (aktual timbang) |
| Partial receive: 2 dari 5 ekor | `qty_po_uom = 2`, PO sisa 3 ekor |
| Reject 1 dari 3 ekor sebelum timbang | `qty_po_uom = 2`, `qty_rejected = 1`, timbang 2 ekor saja |
| Edit GR draft | Semua field editable termasuk konversi |
| Existing GR data (sebelum migration) | Backfill: `qty_po_uom = qty_received`, `conversion_factor = 1` |
| Product tanpa product_uoms record | Default: `uom_received = uom_po`, `conversion_factor = 1`, skip range validation |

---

## Migration Strategy

1. **ALTER TABLE** — tambah kolom nullable dulu
2. **Backfill** — set existing data (semua conversion_factor = 1 karena sebelumnya sama)
3. **SET NOT NULL + CHECK** — setelah backfill
4. **Deploy backend** — handle new fields
5. **Deploy frontend** — show konversi UI

---

## Build Sequence — 2 Steps

### Step 1: DB Migration + Backend (semua backend changes)

| # | Apa | Detail |
|---|-----|--------|
| 1.1 | SQL migration | ALTER TABLE + backfill + NOT NULL + CHECK constraint |
| 1.2 | Types update | Tambah fields di interface + DTO |
| 1.3 | Schema update | Tambah `qty_po_uom`, `uom_received` di lineSchema |
| 1.4 | Repository update | `insertLines`, `replaceLines`, `findPendingQtyByPo`, LINE_SELECT |
| 1.5 | Service update | `create` (calc conversion_factor, validate range), `confirm` (use qty_po_uom for PO tracking, uom_received for GP), variance calc |
| 1.6 | Build + test | `npx tsc`, test endpoint create GR + confirm |

**Expected result Step 1:**
- Backend menerima `qty_po_uom` + `uom_received` dari frontend
- Jika frontend belum update, backend fallback: `qty_po_uom = qty_received`, `uom_received = uom dari PO line`
- PO tracking pakai `qty_po_uom`
- GP input pakai `qty_received` + `uom_received`
- Existing flow tidak break (backward compatible via fallback)

### Step 2: Frontend (GR form + detail page)

| # | Apa | Detail |
|---|-----|--------|
| 2.1 | GR Form | Tambah field `qty_po_uom`, `uom_received` dropdown, auto-suggest, hide jika sama |
| 2.2 | GR Detail | Tampilkan dual qty: "2 Ekor (7.2 KG)", harga per uom_received |
| 2.3 | Test E2E | Create GR salmon Ekor→KG, confirm, cek GP input dalam KG, cek PO sisa dalam Ekor |

**Expected result Step 2:**
- User bisa input salmon: 2 Ekor → timbang 7.2 KG
- Sistem suggest estimasi dari product_uoms
- Warning jika deviasi > 10%
- Beras/bumbu: field konversi hidden (UOM sama)

---

## Contoh End-to-End

```
1. PO: Badan Salmon 5 Ekor @ Rp 200.000/Ekor

2. GR #1:
   - qty_po_uom: 2 Ekor
   - qty_rejected: 0
   - qty_received: 7.2 KG (aktual timbang)
   - uom_received: KG (user pilih dari dropdown, atau default stock unit)
   - conversion_factor: 3.6 (= 7.2 / 2)
   - unit_price_invoice: Rp 55.000/KG (dari invoice fisik supplier)
   - total_price_invoice: Rp 396.000
   - Variance: 396.000 - (2 × 200.000) = -4.000 (1.0%, NOTICE)
   → PO: qty_received = 2, sisa = 3 Ekor

3. GR #1 Confirmed → GP auto-created:
   - GP Input: 7.2 KG Badan Salmon (dari qty_received + uom_received)
   - GP Output (default pass-through): 7.2 KG
   - Tim gudang ubah ke disassembly:
     - Salmon Fresh: 5.0 KG
     - Salmon Skin: 1.2 KG
     - Waste (tulang): 1.0 KG

4. Purchase Invoice:
   - GR Line: 7.2 KG × Rp 55.000/KG = Rp 396.000
   - Cost allocation ke GP outputs (last item absorbs remainder):
     - Salmon Fresh: round(5.0/6.2 × 396.000) = Rp 319.355
     - Salmon Skin: 396.000 - 319.355 = Rp 76.645
     - Waste: Rp 0
   - Total allocated: 319.355 + 76.645 = 396.000 ✓ (exact)

5. GR #2 (minggu depan):
   - qty_po_uom: 3 Ekor
   - qty_received: 10.5 KG
   - conversion_factor: 3.5
   → PO: qty_received = 5, sisa = 0 → FULLY_RECEIVED
```

---

## Related Docs

- GR Module: `.amazonq/docs/GOODS_RECEIPT_PLAN.md`
- Goods Processing: `.amazonq/docs/GOODS_PROCESSING_DESIGN.md`
- Purchase Invoice: `.amazonq/docs/PURCHASE_INVOICE_DESIGN.md`
- PO Flow: `.amazonq/docs/PO_FLOW_DECISION.md`
- UOM Contract: `.amazonq/rules/CODING_PATTERNS.md` (section UOM & Cost Calculation)
