# Goods Processing & Purchase Invoice — Handoff Document

> **Status:** Goods Processing backend DONE, frontend DONE (partial).
> Purchase Invoice module BELUM ADA — perlu dibuat dari nol.
> Dokumen ini adalah panduan lengkap untuk AI berikutnya melanjutkan.

---

## 1. Status Saat Ini

### ✅ Purchase Invoice — Backend (DONE)

| File | Status |
|------|--------|
| `purchase-invoices.types.ts` | ✅ Lengkap |
| `purchase-invoices.errors.ts` | ✅ Lengkap (incl. GP confirm validation) |
| `purchase-invoices.schema.ts` | ✅ Lengkap |
| `purchase-invoices.repository.ts` | ✅ Lengkap (incl. available-grs query) |
| `purchase-invoices.service.ts` | ✅ Lengkap (incl. cost allocation & journals) |
| `purchase-invoices.controller.ts` | ✅ Lengkap |
| `purchase-invoices.routes.ts` | ✅ Lengkap |

### ✅ Goods Processing & Cost Allocation — Backend (DONE)

- **Cost Allocation Logic**: Proporsional berdasarkan berat/qty (non-waste), dengan pembulatan diserap item terakhir.
- **Stock Avg Cost**: Otomatis dihitung ulang saat invoice di-POST.
- **Journal Generation**: Dr Persediaan, Dr PPN Masukan, Cr Hutang Dagang otomatis saat POST.
- **Payment Due Date**: Menghitung `due_date` untuk term `from_invoice` saat POST.

### ❌ Yang BELUM Ada (Tugas Frontend)

1. **Purchase Invoice Pages** — List, Form (Create/Edit), dan Detail.
2. **Integration with Available GRs** — Memanggil endpoint `/available-grs` untuk memilih GR.
3. **3-Way Match UI** — Menampilkan indikator MATCH/OVER/UNDER di form/detail.
4. **Approval & Post Actions** — Tombol Submit, Approve, Reject, dan Post Jurnal di halaman Detail.

---

## 2. Flow Lengkap (Context)

```
GR Confirmed
    ↓ (auto-create)
Goods Processing [DRAFT]
    ↓ (tim gudang)
[PROCESSING] → edit outputs per input line
    ↓
[QC_REVIEW] → submit ke QC
    ↓ (QC approve)
[CONFIRMED] → stock masuk (cost = 0, avg_cost belum berubah)
    ↓
Purchase Invoice [DRAFT]
    ↓ (finance input harga + PPN dari invoice fisik)
[SUBMITTED] → [APPROVED] → [POSTED]
    ↓ saat POSTED:
    1. Cost allocation ke GP outputs (proporsional by weight)
    2. Update stock_movements.cost_per_unit
    3. Recalculate stock_balances.avg_cost
    4. Generate jurnal akuntansi
    5. Hitung payment_due_date (untuk from_invoice terms)
```

---

## 3. Payment Terms Integration

### Sudah Diimplementasi

- `purchase_orders.payment_term_id` — FK ke `payment_terms`
- `purchase_orders.payment_due_date` — tanggal jatuh tempo
- `src/utils/due-date.util.ts` — utility `calculateDueDate(term, baseDate)`
- Saat **GR Confirmed** → hitung `payment_due_date` untuk `from_delivery`, `weekly`, `fixed_date`, `fixed_date_immediate`, `monthly`

### Yang Perlu Dilakukan di Purchase Invoice

Saat Purchase Invoice POSTED, jika `calculation_type = 'from_invoice'`:
```typescript
import { calculateDueDate } from '../../utils/due-date.util'
import { purchaseOrdersRepository } from '../purchase-orders/purchase-orders.repository'

// Di purchase-invoices.service.ts → post()
const supplierTerm = await purchaseOrdersRepository.findSupplierPaymentTerm(invoice.supplier_id, client)
if (supplierTerm?.calculation_type === 'from_invoice') {
  const dueDate = calculateDueDate({
    calculation_type: 'from_invoice',
    days: supplierTerm.days,
    grace_period_days: supplierTerm.grace_period_days,
    payment_dates: supplierTerm.payment_dates,
    payment_day_of_week: supplierTerm.payment_day_of_week,
  }, invoice.invoice_date)
  await purchaseOrdersRepository.updatePaymentDueDate(client, invoice.po_id, dueDate)
}
```

---

## 4. Purchase Invoice — Spesifikasi Lengkap

### 4.1 Database Migration

```sql
-- Tabel utama
CREATE TABLE purchase_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  supplier_id         UUID NOT NULL REFERENCES suppliers(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  invoice_number      VARCHAR(100) NOT NULL,
  invoice_date        DATE NOT NULL,
  due_date            DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED')),
  notes               TEXT,
  rejection_reason    TEXT,
  subtotal            NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_tax           NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(20,4) NOT NULL DEFAULT 0,
  submitted_by        UUID,
  submitted_at        TIMESTAMPTZ,
  approved_by         UUID,
  approved_at         TIMESTAMPTZ,
  rejected_by         UUID,
  rejected_at         TIMESTAMPTZ,
  posted_by           UUID,
  posted_at           TIMESTAMPTZ,
  journal_id          UUID REFERENCES journal_headers(id),
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

-- Link GR ke invoice (many-to-many)
CREATE TABLE purchase_invoice_gr_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id   UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  goods_receipt_id      UUID NOT NULL REFERENCES goods_receipts(id),
  UNIQUE(purchase_invoice_id, goods_receipt_id)
);

CREATE INDEX idx_pi_gr_links_invoice ON purchase_invoice_gr_links(purchase_invoice_id);
CREATE INDEX idx_pi_gr_links_gr ON purchase_invoice_gr_links(goods_receipt_id);

-- Line items
CREATE TABLE purchase_invoice_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id   UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  gr_line_id            UUID NOT NULL REFERENCES goods_receipt_lines(id),
  product_id            UUID NOT NULL REFERENCES products(id),
  qty_received          NUMERIC(20,4) NOT NULL,
  qty_invoiced          NUMERIC(20,4) NOT NULL,
  unit_price            NUMERIC(20,4) NOT NULL DEFAULT 0,
  subtotal              NUMERIC(20,4) NOT NULL DEFAULT 0,
  tax_rate              NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount            NUMERIC(20,4) NOT NULL DEFAULT 0,
  total                 NUMERIC(20,4) NOT NULL DEFAULT 0,
  qty_po                NUMERIC(20,4),
  unit_price_po         NUMERIC(20,4),
  variance_qty          NUMERIC(20,4) NOT NULL DEFAULT 0,
  variance_price        NUMERIC(20,4) NOT NULL DEFAULT 0,
  match_status          VARCHAR(10) NOT NULL DEFAULT 'MATCH'
                          CHECK (match_status IN ('MATCH', 'OVER', 'UNDER')),
  sort_order            INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_pi_lines_invoice ON purchase_invoice_lines(purchase_invoice_id);
CREATE INDEX idx_pi_lines_gr_line ON purchase_invoice_lines(gr_line_id);

-- Kolom baru di goods_receipt_lines untuk partial invoice tracking
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS qty_invoiced NUMERIC(20,4) NOT NULL DEFAULT 0;
```

### 4.2 Status Flow

```
DRAFT → SUBMITTED → APPROVED → POSTED
                 ↘ REJECTED → (revisi → SUBMITTED)
```

### 4.3 Business Rules

1. **1 Invoice → Multiple GR** — dari supplier yang sama DAN branch yang sama
2. **Satuan invoice = `uom_received`** (satuan operasional, bukan satuan PO)
3. **Harga default** — pre-fill dari pricelist (latest approved price per supplier+product)
4. **PPN per line** — bisa beda-beda per item
5. **3-way match** — PO qty vs GR qty vs Invoice qty (informatif, tidak blocking kecuali OVER)
6. **GP harus CONFIRMED** sebelum invoice bisa di-POST (untuk cost allocation)
7. **POST = final** — tidak bisa edit setelah posted

### 4.4 Cost Allocation Logic (saat POSTED)

```typescript
// Untuk setiap invoice line:
// 1. Cari GP outputs via: gr_line_id → goods_processing_inputs.gr_line_id → goods_processing_outputs
// 2. Filter outputs yang BUKAN waste
// 3. Hitung total allocable qty
// 4. Alokasi proporsional — LAST ITEM ABSORBS REMAINDER (rounding rule)

const totalCost = line.subtotal  // harga × qty (belum termasuk PPN)
const outputs = await getGpOutputsForGrLine(grLineId)  // non-waste only
const totalAllocableQty = outputs.reduce((s, o) => s + o.qty_output, 0)

let allocated = 0
for (let i = 0; i < outputs.length; i++) {
  const output = outputs[i]
  let allocatedCost: number

  if (i === outputs.length - 1) {
    allocatedCost = totalCost - allocated  // last item absorbs remainder
  } else {
    const ratio = output.qty_output / totalAllocableQty
    allocatedCost = Math.round(totalCost * ratio)
    allocated += allocatedCost
  }

  const unitCost = allocatedCost / output.qty_output

  // Update GP output
  await client.query(
    'UPDATE goods_processing_outputs SET unit_cost = $1, allocated_cost = $2, purchase_invoice_line_id = $3 WHERE id = $4',
    [unitCost, allocatedCost, line.id, output.id]
  )

  // Update stock movement cost
  if (output.stock_movement_id) {
    await client.query(
      'UPDATE stock_movements SET cost_per_unit = $1, total_cost = $2 WHERE id = $3',
      [unitCost, allocatedCost, output.stock_movement_id]
    )
  }
}

// Recalculate avg_cost di stock_balances
await recalculateAvgCost(client, productId, warehouseId)
```

### 4.5 Recalculate Avg Cost

```typescript
async function recalculateAvgCost(client: PoolClient, productId: string, warehouseId: string) {
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
  await client.query(
    'UPDATE stock_balances SET avg_cost = $1, updated_at = now() WHERE warehouse_id = $2 AND product_id = $3',
    [newAvgCost, warehouseId, productId]
  )
}
```

### 4.6 Journal Entry (saat POSTED)

```
Dr  110501 Persediaan Bahan Baku     = subtotal (per produk output)
Dr  110601 PPN Masukan               = total_tax
    Cr  210101 Hutang Dagang         = total_amount (subtotal + tax)
```

COA lookup selalu filter by `company_id`:
```typescript
const { rows } = await pool.query(
  'SELECT id FROM chart_of_accounts WHERE company_id = $1 AND account_code = $2 LIMIT 1',
  [companyId, '110501']
)
```

### 4.7 API Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/purchase-invoices` | `purchase_invoices:view` |
| POST | `/purchase-invoices` | `purchase_invoices:insert` |
| GET | `/purchase-invoices/available-grs` | `purchase_invoices:view` |
| GET | `/purchase-invoices/:id` | `purchase_invoices:view` |
| PUT | `/purchase-invoices/:id` | `purchase_invoices:update` |
| DELETE | `/purchase-invoices/:id` | `purchase_invoices:delete` |
| POST | `/purchase-invoices/:id/submit` | `purchase_invoices:update` |
| POST | `/purchase-invoices/:id/approve` | `purchase_invoices:approve` |
| POST | `/purchase-invoices/:id/reject` | `purchase_invoices:approve` |
| POST | `/purchase-invoices/:id/post` | `purchase_invoices:update` |

### 4.8 Available GRs Query

```sql
-- GR yang bisa dipilih untuk invoice: CONFIRMED + supplier sama + branch sama + belum fully invoiced
SELECT gr.*, s.supplier_name
FROM goods_receipts gr
JOIN purchase_orders po ON po.id = gr.po_id
JOIN suppliers s ON s.id = po.supplier_id
WHERE gr.company_id = $1
  AND gr.status = 'CONFIRMED'
  AND gr.deleted_at IS NULL
  AND po.supplier_id = $2
  AND gr.branch_id = $3
  AND EXISTS (
    SELECT 1 FROM goods_receipt_lines grl
    WHERE grl.gr_id = gr.id
      AND grl.qty_invoiced < grl.qty_received
  )
ORDER BY gr.received_date DESC
```

---

## 5. Module Structure yang Perlu Dibuat

```
backend/src/modules/purchase-invoices/
├── purchase-invoices.types.ts
├── purchase-invoices.errors.ts
├── purchase-invoices.schema.ts
├── purchase-invoices.repository.ts
├── purchase-invoices.service.ts
├── purchase-invoices.controller.ts
└── purchase-invoices.routes.ts

frontend/src/features/purchase-invoices/
├── api/purchaseInvoices.api.ts
├── pages/PurchaseInvoicesPage.tsx
├── pages/PurchaseInvoiceFormPage.tsx
└── pages/PurchaseInvoiceDetailPage.tsx
```

---

## 6. Urutan Build

| Step | Apa | File | Status |
|------|-----|------|--------|
| 1 | DB Migration (3 tables + kolom qty_invoiced) | Run SQL di section 4.1 | ✅ DONE |
| 2 | Types + Errors + Schema | `purchase-invoices.types.ts`, ... | ✅ DONE |
| 3 | Repository (CRUD + available-grs + cost allocation helpers) | `purchase-invoices.repository.ts` | ✅ DONE |
| 4 | Service (create, update, submit, approve, reject, post) | `purchase-invoices.service.ts` | ✅ DONE |
| 5 | Controller + Routes | `purchase-invoices.controller.ts`, ... | ✅ DONE |
| 6 | Register di `app.ts` | `app.use('/api/v1/purchase-invoices', ...)` | ✅ DONE |
| 7 | Frontend: List page | `PurchaseInvoicesPage.tsx` | 🏗️ TODO |
| 8 | Frontend: Form page (create/edit) | `PurchaseInvoiceFormPage.tsx` | 🏗️ TODO |
| 9 | Frontend: Detail page (approval + post) | `PurchaseInvoiceDetailPage.tsx` | 🏗️ TODO |
| 10 | Register routes di `App.tsx` | lazy import + route | 🏗️ TODO |
| 11 | Tambah menu di `menu.config.tsx` | "Verifikasi Invoice" | 🏗️ TODO |

---

## 7. Checklist Sebelum Declare Done

- [ ] DB migration dijalankan di production
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Test: create invoice → submit → approve → post
- [ ] Verify: `goods_processing_outputs.unit_cost` ter-update setelah post
- [ ] Verify: `stock_balances.avg_cost` ter-update setelah post
- [ ] Verify: `journal_headers` ter-create dengan lines yang benar
- [ ] Verify: `purchase_orders.payment_due_date` ter-update untuk `from_invoice` terms
- [ ] Verify: `goods_receipt_lines.qty_invoiced` ter-update setelah post

---

## 8. Referensi

- Design doc lengkap: `.amazonq/docs/PURCHASE_INVOICE_DESIGN.md`
- Goods Processing design: `.amazonq/docs/GOODS_PROCESSING_DESIGN.md`
- Per-line status: `.amazonq/docs/GOODS_PROCESSING_PER_LINE_STATUS.md`
- Payment terms utility: `backend/src/utils/due-date.util.ts`
- `findSupplierPaymentTerm(supplierId, client?)`: `backend/src/modules/purchase-orders/purchase-orders.repository.ts`
- `updatePaymentDueDate(client, poId, dueDate)`: same file
- Reference controller: `backend/src/modules/branches/branches.controller.ts`
- Reference page: `frontend/src/features/products/pages/ProductsPage.tsx`
