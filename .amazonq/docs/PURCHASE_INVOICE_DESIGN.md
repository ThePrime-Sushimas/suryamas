# Purchase Invoice (Verifikasi Faktur Pembelian) — Design Document

> **Part 2 of 2** — Dokumen ini cover Purchase Invoice module + jurnal akuntansi.
> Part 1: `GOODS_PROCESSING_DESIGN.md` — cover Goods Processing / Barang Masuk.

---

## Tujuan

Halaman untuk **Finance** mencocokkan invoice dari supplier dengan barang yang sudah diterima (GR). Di sinilah harga, PPN, dan 3-way matching terjadi. Jurnal akuntansi baru dibuat saat invoice di-POST.

---

## Full Flow (Context)

```
GR (confirmed) → Goods Processing (QC confirmed, stock masuk cost=0)
                                    ↓
     [PURCHASE INVOICE] ← MODULE INI
       - Finance pilih GR yang sudah confirmed
       - 1 Invoice bisa cover multiple GR (dari supplier yang sama)
       - Input harga per item dari invoice supplier
       - Input PPN per line (bisa beda-beda)
       - 3-way match: PO qty vs GR qty vs Invoice qty
       - Approval flow
       - Saat POSTED:
         → Cost allocation ke Goods Processing outputs (proporsional)
         → Update stock avg_cost
         → Generate jurnal akuntansi
```

---

## Status Flow

```
DRAFT → SUBMITTED → APPROVED → POSTED
                 ↘ REJECTED → (revisi → SUBMITTED lagi)
```

| Status | Siapa | Aksi |
|--------|-------|------|
| DRAFT | Finance | Input invoice, cocokkan GR, isi harga & PPN |
| SUBMITTED | Finance | Kirim ke approver |
| APPROVED | Manager / Finance Head | Setujui → siap post jurnal |
| REJECTED | Manager / Finance Head | Kembalikan ke Finance untuk revisi |
| POSTED | System | Jurnal otomatis terbuat, cost allocated |

---

## Business Rules

### Invoice ↔ GR Relationship
- **1 Invoice → Multiple GR** (dari supplier yang sama **DAN branch yang sama**)
- **1 GR bisa di-cover oleh multiple Invoice** (partial invoice)
- GR yang bisa dipilih: status `CONFIRMED` + supplier sama + branch sama + belum fully invoiced
- **Constraint:** Semua GR dalam 1 invoice harus dari branch yang sama (untuk jurnal)

### Harga Default (Pre-fill dari Pricelist)
- Saat Finance pilih GR, harga per item **otomatis terisi dari pricelist** (latest price per supplier + product)
- Finance **koreksi** jika harga di invoice fisik berbeda dari pricelist
- Jika pricelist tidak ada untuk produk tersebut → harga default 0, Finance wajib isi manual
- Sistem highlight **variance** antara harga invoice vs harga pricelist (kuning jika beda)
- Lookup: `pricelists` WHERE `supplier_product_id` match + status APPROVED + latest `effective_date`

### PPN
- **Per line item** — bisa ada item kena pajak & tidak
- Default tax rate configurable (11% PPN Indonesia)
- Tax amount = `unit_price × qty_invoiced × tax_rate / 100`

### 3-Way Match (per line)
```
PO qty (kontrak)  ←→  GR qty (fisik diterima)  ←→  Invoice qty (tagihan supplier)
```

| Match Status | Kondisi | Artinya |
|---|---|---|
| ✅ MATCH | variance_qty = 0 | Supplier tagih sesuai yang diterima |
| ⚠️ OVER | qty_invoiced > qty_received | Supplier tagih lebih dari yang diterima |
| ⚠️ UNDER | qty_invoiced < qty_received | Supplier tagih kurang (partial invoice) |

### Approval Rules
- Invoice dengan semua lines MATCH → bisa auto-approve (configurable)
- Invoice dengan OVER lines → wajib manual approval
- Rejected invoice bisa direvisi dan submit ulang

---

## Database Schema

### `purchase_invoices` — Header

```sql
CREATE TABLE purchase_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  supplier_id         UUID NOT NULL REFERENCES suppliers(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),  -- constraint: semua GR harus dari branch ini
  invoice_number      VARCHAR(100) NOT NULL,           -- nomor invoice dari supplier
  invoice_date        DATE NOT NULL,
  due_date            DATE,                            -- jatuh tempo pembayaran
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED')),
  notes               TEXT,
  rejection_reason    TEXT,

  -- Totals (calculated)
  subtotal            NUMERIC(20,4) NOT NULL DEFAULT 0,  -- SUM(lines.subtotal)
  total_tax           NUMERIC(20,4) NOT NULL DEFAULT 0,  -- SUM(lines.tax_amount)
  total_amount        NUMERIC(20,4) NOT NULL DEFAULT 0,  -- subtotal + total_tax

  -- People & timestamps
  submitted_by        UUID,
  submitted_at        TIMESTAMPTZ,
  approved_by         UUID,
  approved_at         TIMESTAMPTZ,
  rejected_by         UUID,
  rejected_at         TIMESTAMPTZ,
  posted_by           UUID,
  posted_at           TIMESTAMPTZ,

  -- Journal link
  journal_id          UUID REFERENCES journal_headers(id),

  -- Soft delete & audit
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_by          UUID,

  UNIQUE(company_id, supplier_id, invoice_number)
);

CREATE INDEX idx_purchase_invoices_company ON purchase_invoices(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_invoices_supplier ON purchase_invoices(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_invoices_status ON purchase_invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_invoices_branch ON purchase_invoices(branch_id) WHERE deleted_at IS NULL;
```

> **Constraint branch_id:** Saat pilih GR, validasi `gr.branch_id === invoice.branch_id`. Ini memastikan jurnal punya 1 branch yang jelas. Jika supplier kirim ke 2 cabang berbeda, finance harus buat 2 invoice terpisah.

### `purchase_invoice_gr_links` — GR yang di-cover invoice ini

```sql
CREATE TABLE purchase_invoice_gr_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id   UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  goods_receipt_id      UUID NOT NULL REFERENCES goods_receipts(id),
  UNIQUE(purchase_invoice_id, goods_receipt_id)
);

CREATE INDEX idx_pi_gr_links_invoice ON purchase_invoice_gr_links(purchase_invoice_id);
CREATE INDEX idx_pi_gr_links_gr ON purchase_invoice_gr_links(goods_receipt_id);
```

### `purchase_invoice_lines` — Line items (harga dari invoice supplier)

```sql
CREATE TABLE purchase_invoice_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id   UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  gr_line_id            UUID NOT NULL REFERENCES goods_receipt_lines(id),
  product_id            UUID NOT NULL REFERENCES products(id),

  -- Qty
  qty_received          NUMERIC(20,4) NOT NULL,         -- dari GR (readonly)
  qty_invoiced          NUMERIC(20,4) NOT NULL,         -- dari supplier invoice (diisi finance)

  -- Harga
  unit_price            NUMERIC(20,4) NOT NULL DEFAULT 0,  -- harga per unit dari invoice
  subtotal              NUMERIC(20,4) NOT NULL DEFAULT 0,  -- unit_price × qty_invoiced

  -- PPN per line
  tax_rate              NUMERIC(5,2) NOT NULL DEFAULT 0,   -- % (misal 11.00)
  tax_amount            NUMERIC(20,4) NOT NULL DEFAULT 0,  -- subtotal × tax_rate / 100
  total                 NUMERIC(20,4) NOT NULL DEFAULT 0,  -- subtotal + tax_amount

  -- 3-Way Match
  qty_po                NUMERIC(20,4),                     -- qty dari PO line (readonly, for reference)
  unit_price_po         NUMERIC(20,4),                     -- harga kontrak PO (readonly, for reference)
  variance_qty          NUMERIC(20,4) NOT NULL DEFAULT 0,  -- qty_invoiced - qty_received
  variance_price        NUMERIC(20,4) NOT NULL DEFAULT 0,  -- unit_price - unit_price_po
  match_status          VARCHAR(10) NOT NULL DEFAULT 'MATCH'
                          CHECK (match_status IN ('MATCH', 'OVER', 'UNDER')),

  sort_order            INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_pi_lines_invoice ON purchase_invoice_lines(purchase_invoice_id);
CREATE INDEX idx_pi_lines_gr_line ON purchase_invoice_lines(gr_line_id);
```

---

## Invoice Number

Nomor invoice **dari supplier** (bukan auto-generate). Finance input manual dari invoice fisik/foto.

Unique constraint: `(company_id, supplier_id, invoice_number)` — 1 supplier tidak boleh punya 2 invoice dengan nomor sama.

---

## Cost Allocation Logic (saat POSTED)

### Flow

```
Purchase Invoice POSTED
  ↓
For each invoice line:
  1. Cari GR line → cari Goods Processing input → cari outputs
  2. Filter outputs yang BUKAN waste
  3. Hitung total allocable weight/qty
  4. Alokasi cost proporsional
  5. Update goods_processing_outputs.unit_cost & allocated_cost
  6. Update stock_movements.cost_per_unit
  7. Recalculate stock_balances.avg_cost
```

### Pseudocode

```typescript
async function allocateCostOnPost(invoiceId: string, client: PoolClient) {
  const invoice = await getInvoiceWithLines(invoiceId)

  // HARD VALIDATION: semua GR harus punya GP CONFIRMED
  const { rows: unconfirmedGPs } = await client.query(`
    SELECT gp.id, gp.processing_number, gp.status
    FROM purchase_invoice_gr_links pigl
    JOIN goods_processing gp ON gp.goods_receipt_id = pigl.goods_receipt_id
    WHERE pigl.purchase_invoice_id = $1 AND gp.status != 'CONFIRMED'
  `, [invoiceId])
  if (unconfirmedGPs.length > 0) {
    throw new BusinessRuleError(
      `Tidak bisa post: ${unconfirmedGPs.length} Goods Processing belum CONFIRMED (${unconfirmedGPs.map(g => g.processing_number).join(', ')})`
    )
  }

  for (const line of invoice.lines) {
    const totalCost = line.subtotal  // harga × qty (belum termasuk PPN)

    // Find GP outputs for this GR line
    const { rows: outputs } = await client.query(`
      SELECT gpo.*
      FROM goods_processing_outputs gpo
      JOIN goods_processing_inputs gpi ON gpi.id = gpo.input_id
      WHERE gpi.gr_line_id = $1 AND gpo.is_waste = false
    `, [line.gr_line_id])

    if (outputs.length === 0) {
      throw new BusinessRuleError(
        `Tidak ada output Goods Processing untuk GR line ${line.gr_line_id}. Pastikan GP sudah CONFIRMED.`
      )
    }

    // Calculate total allocable qty
    const totalAllocableQty = outputs.reduce((sum, o) => sum + Number(o.qty_output), 0)
    if (totalAllocableQty === 0) continue

    // Allocate proportionally
    for (const output of outputs) {
      const ratio = Number(output.qty_output) / totalAllocableQty
      const allocatedCost = totalCost * ratio
      const unitCost = allocatedCost / Number(output.qty_output)

      // Update GP output + link ke invoice line
      await client.query(`
        UPDATE goods_processing_outputs
        SET unit_cost = $1, allocated_cost = $2, purchase_invoice_line_id = $3
        WHERE id = $4
      `, [unitCost, allocatedCost, line.id, output.id])

      // Update stock movement cost
      if (output.stock_movement_id) {
        await client.query(`
          UPDATE stock_movements
          SET cost_per_unit = $1, total_cost = $2
          WHERE id = $3
        `, [unitCost, allocatedCost, output.stock_movement_id])
      }

      // Recalculate avg_cost for this product in warehouse
      await recalculateAvgCost(client, output.product_id, invoice.warehouse_id)
    }

    // Update qty_invoiced di GR line (untuk partial invoice tracking)
    await client.query(`
      UPDATE goods_receipt_lines
      SET qty_invoiced = COALESCE(qty_invoiced, 0) + $1
      WHERE id = $2
    `, [line.qty_invoiced, line.gr_line_id])
  }
}
```

### Recalculate Avg Cost

```typescript
async function recalculateAvgCost(client: PoolClient, productId: string, warehouseId: string) {
  // Weighted average dari IN movements yang punya cost > 0
  // Dibagi dengan current balance qty (bukan SUM IN qty, karena ada yang sudah keluar)
  const { rows } = await client.query(`
    SELECT
      sb.qty AS current_qty,
      CASE WHEN sb.qty > 0
        THEN (
          SELECT SUM(sm.qty * sm.cost_per_unit) / NULLIF(SUM(sm.qty), 0)
          FROM stock_movements sm
          WHERE sm.warehouse_id = $1 AND sm.product_id = $2
            AND sm.qty > 0 AND sm.cost_per_unit > 0
        )
        ELSE 0
      END AS new_avg_cost
    FROM stock_balances sb
    WHERE sb.warehouse_id = $1 AND sb.product_id = $2
  `, [warehouseId, productId])

  const newAvgCost = Number(rows[0]?.new_avg_cost ?? 0)

  await client.query(`
    UPDATE stock_balances SET avg_cost = $1, updated_at = now()
    WHERE warehouse_id = $2 AND product_id = $3
  `, [newAvgCost, warehouseId, productId])
}
```

> **Catatan:** Ini simplified weighted average dari semua IN movements. Untuk MVP ini cukup akurat.

---

## Jurnal Akuntansi (saat POSTED)

### Entry Pattern

```
Dr  110501 Persediaan Bahan Baku     = subtotal (per produk output)
Dr  110601 PPN Masukan               = total_tax
    Cr  210101 Hutang Dagang         = total_amount (subtotal + tax)
```

### Detail per Produk (opsional, untuk granularity)

```
Dr  110501 Persediaan - Salmon Fillet    Rp 4.069.767
Dr  110501 Persediaan - Salmon Head      Rp   930.233
Dr  110601 PPN Masukan                   Rp   550.000
    Cr  210101 Hutang Dagang             Rp 5.550.000
```

### Journal Metadata

```typescript
const journalData = {
  company_id: invoice.company_id,
  branch_id: primaryBranchId,          // dari GR pertama
  journal_date: invoice.invoice_date,
  journal_type: 'GENERAL',
  source_module: 'purchase_invoice',
  reference_type: 'purchase_invoice',
  reference_id: invoice.id,
  reference_number: invoice.invoice_number,
  description: `Faktur Pembelian ${invoice.invoice_number} - ${invoice.supplier_name}`,
  status: 'POSTED',
  is_auto: true,
}
```

---

## API Endpoints

| Method | Path | Fungsi | Permission |
|--------|------|--------|------------|
| GET | `/purchase-invoices` | List (filter: status, supplier, date) | `purchase_invoices:view` |
| POST | `/purchase-invoices` | Buat invoice baru (DRAFT) | `purchase_invoices:insert` |
| GET | `/purchase-invoices/:id` | Detail + lines + GR links | `purchase_invoices:view` |
| PUT | `/purchase-invoices/:id` | Update (DRAFT/REJECTED only) | `purchase_invoices:update` |
| DELETE | `/purchase-invoices/:id` | Soft delete (DRAFT only) | `purchase_invoices:delete` |
| POST | `/purchase-invoices/:id/submit` | DRAFT → SUBMITTED | `purchase_invoices:update` |
| POST | `/purchase-invoices/:id/approve` | SUBMITTED → APPROVED | `purchase_invoices:approve` |
| POST | `/purchase-invoices/:id/reject` | SUBMITTED → REJECTED | `purchase_invoices:approve` |
| POST | `/purchase-invoices/:id/post` | APPROVED → POSTED (+ jurnal + cost allocation) | `purchase_invoices:approve` |
| GET | `/purchase-invoices/available-grs` | GR confirmed yang belum fully invoiced (filter by supplier + branch) | `purchase_invoices:view` |

---

## Partial Invoice Tracking

### Kolom Baru di `goods_receipt_lines`

```sql
ALTER TABLE goods_receipt_lines
  ADD COLUMN qty_invoiced NUMERIC(20,4) NOT NULL DEFAULT 0;
```

Di-update saat Purchase Invoice POSTED: `qty_invoiced += qty_invoiced_in_this_invoice`

### Query: Available GRs (belum fully invoiced)

```sql
SELECT gr.*, s.supplier_name
FROM goods_receipts gr
JOIN purchase_orders po ON po.id = gr.po_id
JOIN suppliers s ON s.id = po.supplier_id
WHERE gr.company_id = $1
  AND gr.status = 'CONFIRMED'
  AND gr.deleted_at IS NULL
  AND po.supplier_id = $2          -- filter by supplier
  AND gr.branch_id = $3            -- filter by branch
  AND EXISTS (
    SELECT 1 FROM goods_receipt_lines grl
    WHERE grl.gr_id = gr.id
      AND grl.qty_invoiced < grl.qty_received  -- masih ada sisa belum di-invoice
  )
ORDER BY gr.received_date DESC
```

---

## Frontend Pages

### Routing

| Path | Page | Siapa |
|------|------|-------|
| `/inventory/purchase-invoices` | PurchaseInvoicesPage | Finance |
| `/inventory/purchase-invoices/new` | PurchaseInvoiceFormPage | Finance |
| `/inventory/purchase-invoices/:id` | PurchaseInvoiceDetailPage | Finance / Approver |
| `/inventory/purchase-invoices/:id/edit` | PurchaseInvoiceFormPage (edit) | Finance |

### PurchaseInvoicesPage — List

```
┌─────────────────────────────────────────────────────────────────┐
│ Verifikasi Invoice Pembelian                   [+ Buat Invoice]  │
├─────────────────────────────────────────────────────────────────┤
│ Filter: [Semua Status ▼] [Semua Supplier ▼] [Periode ▼]         │
│                                                                  │
│ ┌──────────┬──────────────┬────────────┬──────────┬───────────┐ │
│ │ No. Inv  │ Supplier     │ Tanggal    │ Total    │ Status    │ │
│ │ INV-001  │ Wahana Inti  │ 13-Mei-26  │ 5.550K   │ DRAFT    │ │
│ │ INV-002  │ Aneka Pangan │ 12-Mei-26  │ 12.100K  │ APPROVED │ │
│ └──────────┴──────────────┴────────────┴──────────┴───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### PurchaseInvoiceFormPage — Create/Edit

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Kembali                                                        │
│ Buat Invoice Pembelian                                           │
├─────────────────────────────────────────────────────────────────┤
│ Supplier: [Wahana Inti Makmur ▼]                                 │
│ No. Invoice: [INV-2026-001    ]  Tanggal: [13/05/2026]          │
│ Jatuh Tempo: [13/06/2026      ]  Catatan: [           ]          │
├─────────────────────────────────────────────────────────────────┤
│ Pilih Penerimaan Barang (GR):                                    │
│ [✓] GR-JAK-001-20260513-004 · 13 Mei · 1 item                  │
│ [✓] GR-JAK-001-20260510-002 · 10 Mei · 3 items                 │
│ [ ] GR-JAK-001-20260508-001 · 8 Mei · 2 items                  │
├─────────────────────────────────────────────────────────────────┤
│ Line Items:                                                      │
│ ┌──────────┬────────┬────────┬──────────┬──────┬────────┬──────┐│
│ │ Produk   │Qty GR  │Qty Inv │Harga/Unit│ PPN% │ PPN    │Total ││
│ │Salmon    │ 50 kg  │[50  ]  │[100.000] │[11 ] │55.000  │5.55M ││
│ │Beras     │200 kg  │[200 ]  │[12.000]  │[11 ] │264.000 │2.66M ││
│ └──────────┴────────┴────────┴──────────┴──────┴────────┴──────┘│
│                                                                  │
│ 3-Way Match:                                                     │
│ ┌──────────┬────────┬────────┬────────┬──────────────────────┐  │
│ │ Produk   │ PO Qty │ GR Qty │ Inv Qty│ Status               │  │
│ │ Salmon   │ 50     │ 50     │ 50     │ ✅ MATCH             │  │
│ │ Beras    │ 200    │ 200    │ 200    │ ✅ MATCH             │  │
│ └──────────┴────────┴────────┴────────┴──────────────────────┘  │
│                                                                  │
│ Subtotal:  Rp 7.400.000                                          │
│ PPN:       Rp   814.000                                          │
│ Total:     Rp 8.214.000                                          │
│                                                                  │
│                                    [Simpan Draft]  [Submit]      │
└─────────────────────────────────────────────────────────────────┘
```

### PurchaseInvoiceDetailPage — Approval View

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Kembali                                                        │
│ INV-2026-001 · Wahana Inti Makmur          Status: SUBMITTED     │
├─────────────────────────────────────────────────────────────────┤
│ Invoice: 13 Mei 2026 · Jatuh Tempo: 13 Jun 2026                 │
│ GR: GR-JAK-001-20260513-004, GR-JAK-001-20260510-002            │
├─────────────────────────────────────────────────────────────────┤
│ [Detail lines + 3-way match — readonly]                          │
│                                                                  │
│ Total: Rp 8.214.000 (incl. PPN Rp 814.000)                      │
│                                                                  │
│ 3-Way Match Summary: ✅ Semua MATCH                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ [Tolak]                                    [Approve]             │
│                                                                  │
│ (Setelah APPROVED, muncul tombol:)                               │
│                                            [Post Jurnal]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Contoh Skenario End-to-End

### Timeline

```
Hari 1: Supplier kirim 50kg salmon + 200kg beras ke cabang Condet
  → GR confirmed (qty only, no harga)
  → Goods Processing auto-created
  → Tim gudang proses salmon (potong → fillet 35kg + head 8kg + waste 7kg)
  → Beras pass-through (200kg → 200kg)
  → QC confirm → stock masuk (cost = 0)

Hari 3: Invoice fisik dari supplier sampai ke finance
  → Finance buat Purchase Invoice
  → Pilih GR-JAK-001-20260513-004
  → Input harga: Salmon 50kg @ 100.000, Beras 200kg @ 12.000
  → Input PPN: 11% per line
  → Submit → Manager approve → Post

Saat POST:
  → Cost allocation:
    - Salmon 5.000.000 → Fillet (35/43)×5jt = 4.069.767, Head (8/43)×5jt = 930.233
    - Beras 2.400.000 → Beras 200kg = 2.400.000 (pass-through, 1:1)
  → Update stock avg_cost
  → Jurnal:
    Dr Persediaan Bahan Baku    7.400.000
    Dr PPN Masukan                814.000
       Cr Hutang Dagang         8.214.000
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| Invoice masuk sebelum GP confirmed | Invoice bisa dibuat (DRAFT), tapi POST blocked sampai GP confirmed |
| 1 Invoice cover 3 GR dari supplier sama | OK — multiple GR links |
| Partial invoice (supplier tagih 30 dari 50 yang diterima) | OK — qty_invoiced < qty_received, match_status = UNDER |
| Supplier tagih lebih dari yang diterima | match_status = OVER, wajib manual approval |
| Invoice rejected, finance revisi | Status → REJECTED, finance edit, submit ulang |
| Invoice sudah POSTED, mau void | Reverse journal + reset cost allocation (future feature) |
| GR belum punya GP (edge case lama) | Block — GR harus punya GP yang CONFIRMED |
| Harga 0 di invoice line | Allowed (misal: sample gratis) |
| PPN 0% | Allowed — ada item yang tidak kena PPN |
| Supplier ganti invoice number | Unique constraint per (company, supplier, invoice_number) |
| Due date lewat | Tampilkan warning di list (overdue badge) |

---

## COA yang Terlibat

| Kode | Nama Akun | Tipe | Kapan Dipakai |
|------|-----------|------|---------------|
| 110501 | Persediaan Bahan Baku | Aset | Debit saat invoice posted |
| 110601 | PPN Masukan | Aset | Debit saat invoice posted (jika ada PPN) |
| 210101 | Hutang Dagang | Liabilitas | Credit saat invoice posted |

---

## Module Structure (Backend)

```
backend/src/modules/purchase-invoices/
├── purchase-invoices.types.ts
├── purchase-invoices.errors.ts
├── purchase-invoices.schema.ts
├── purchase-invoices.repository.ts
├── purchase-invoices.service.ts
├── purchase-invoices.controller.ts
└── purchase-invoices.routes.ts
```

---

## Permission

```typescript
PermissionService.registerModule('purchase_invoices', 'Verifikasi Invoice Pembelian')
// Actions: canView, canInsert, canUpdate, canDelete (finance)
//          canApprove (manager/finance head — approve + post)
```

---

## Build Sequence

| Step | Apa | Dependency |
|------|-----|------------|
| 1 | SQL migration: 3 tables + indexes | — |
| 2 | Types + Errors + Schema | — |
| 3 | Repository (CRUD + available GRs query) | Step 1 |
| 4 | Service (create, update, status transitions) | Step 3 |
| 5 | Service: POST logic (cost allocation + journal generation) | Step 4 + Goods Processing module |
| 6 | Controller + Routes | Step 4 |
| 7 | Frontend: PurchaseInvoicesPage (list) | Step 6 |
| 8 | Frontend: PurchaseInvoiceFormPage (create/edit) | Step 6 |
| 9 | Frontend: PurchaseInvoiceDetailPage (approval + post) | Step 6 |

---

## Sidebar Menu

```
Inventory
├── Gudang
├── Stok Gudang
├── Mutasi Stok
├── Purchase Request
├── PR Approval
├── Purchase Order
├── Penerimaan Barang (GR)
├── Barang Masuk (Goods Processing)    ← NEW
├── Verifikasi Invoice                  ← NEW
└── ...
```

---

## Catatan Penting

1. **Jurnal HANYA dibuat saat Invoice POSTED** — bukan saat GR confirm, bukan saat GP confirm
2. **Cost allocation proporsional by weight** — waste excluded dari alokasi
3. **1 Invoice bisa cover multiple GR** — tapi harus supplier yang sama
4. **PPN per line** — fleksibel, bisa ada item kena pajak & tidak
5. **3-way match informatif** — tidak blocking, tapi OVER wajib manual approval
6. **Invoice number dari supplier** — bukan auto-generate
7. **POST = final** — setelah posted, tidak bisa edit (harus void + buat ulang)
8. **GP harus CONFIRMED sebelum invoice bisa di-POST** — karena cost allocation butuh output data

---

## Hubungan Antar Module (Summary)

```
purchase_orders
    │
    └── goods_receipts (GR confirmed → auto-create GP)
            │
            ├── goods_processing (QC confirmed → stock masuk, cost=0)
            │       │
            │       └── goods_processing_outputs
            │               ↑
            │               │ cost allocation (proporsional)
            │               │
            └── purchase_invoices (POSTED → allocate cost + jurnal)
                    │
                    ├── purchase_invoice_gr_links (many-to-many)
                    │
                    └── purchase_invoice_lines (harga + PPN per item)
                            │
                            └── → journal_headers + journal_lines
```

---

## Related Docs

- Part 1: `.amazonq/docs/GOODS_PROCESSING_DESIGN.md`
- Inventory System: `.amazonq/docs/INVENTORY_SYSTEM_V2_PLAN.md`
- GR Module: `.amazonq/docs/GOODS_RECEIPT_PLAN.md`
- PO Flow: `.amazonq/docs/PO_FLOW_DECISION.md`
- Coding Patterns: `.amazonq/docs/CODING_PATTERNS.md`
