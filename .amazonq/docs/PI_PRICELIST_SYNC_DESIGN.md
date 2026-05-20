# PI → Pricelist Auto-Sync — Design

> **Status:** Revised — Gap 1 = Option A (LIFO), UI = Design Rules applied  
> **Konteks:** Tim kecil (4 orang), harga fluktuatif harian, auto overwrite tanpa tombol manual.

---

## 1. Keputusan produk

| Keputusan | Pilihan |
|-----------|---------|
| Trigger | **Post PI** |
| Policy | **Auto overwrite** pricelist aktif (deactivate lama + buat baru APPROVED) |
| Tombol manual | **Tidak ada** |
| Unpost PI | **Option A — Strict LIFO** (lihat §3c) |
| Concurrency | **`SELECT … FOR UPDATE`** pada pricelist aktif |
| UOM gagal resolve | **Skip + warning** di response post (non-blocking) |
| Manual pricelist | **Auto-insert** history row (`MANUAL`) |
| UI | Riwayat perubahan + sparkline (Phase 4–5) |

---

## 2. Arsitektur data

### 2a. Tabel `pricelist_price_changes`

```sql
CREATE TABLE pricelist_price_changes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL REFERENCES companies(id),
  supplier_id              UUID NOT NULL REFERENCES suppliers(id),
  product_id               UUID NOT NULL REFERENCES products(id),
  uom_id                   UUID NOT NULL REFERENCES product_uoms(id),

  old_price                NUMERIC(20,4),
  new_price                NUMERIC(20,4) NOT NULL,
  change_amount            NUMERIC(20,4),
  change_pct               NUMERIC(8,2),

  effective_date           DATE NOT NULL,
  source                   VARCHAR(20) NOT NULL
    CHECK (source IN ('PI_POST', 'PI_UNPOST', 'MANUAL')),

  purchase_invoice_id      UUID REFERENCES purchase_invoices(id),
  purchase_invoice_line_id UUID REFERENCES purchase_invoice_lines(id),
  pricelist_id             UUID REFERENCES pricelists(id),

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID
);

CREATE INDEX idx_ppc_company_date
  ON pricelist_price_changes(company_id, effective_date DESC);
CREATE INDEX idx_ppc_supplier_product
  ON pricelist_price_changes(supplier_id, product_id, uom_id, effective_date DESC);
CREATE INDEX idx_ppc_pi
  ON pricelist_price_changes(purchase_invoice_id)
  WHERE purchase_invoice_id IS NOT NULL;
```

### 2b. Kolom baru di `pricelists`

```sql
ALTER TABLE pricelists
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
    CHECK (source IN ('MANUAL', 'PI_POST', 'PI_UNPOST')),
  ADD COLUMN IF NOT EXISTS purchase_invoice_id UUID REFERENCES purchase_invoices(id);
```

### 2c. Helper `calcChangePct`

```typescript
function calcChangePct(oldPrice: number | null, newPrice: number): number | null {
  if (oldPrice === null || oldPrice === 0) return null
  return Math.round(((newPrice - oldPrice) / oldPrice) * 100 * 100) / 100
}
```

Gunakan di service **dan** SQL `CASE WHEN old_price IS NOT NULL AND old_price != 0 …` (defense in depth).

---

## 3. Flow backend

### 3a. `syncFromPurchaseInvoice` (Gap 2 — FOR UPDATE)

Dipanggil dari dalam transaksi post PI yang sama. **Wajib** `PoolClient`, bukan `pool`.

```
1. SELECT id, price FROM pricelists
   WHERE supplier_id + product_id + uom_id + is_active + company_id
   FOR UPDATE

2. old_price = row?.price ?? null
3. IF unit_price ≈ old_price (±0.01) → return { skipped: true }

4. IF active row → UPDATE is_active=false, valid_to=invoice_date

5. INSERT pricelists baru (APPROVED, source=PI_POST, purchase_invoice_id)

6. INSERT pricelist_price_changes (source=PI_POST, pricelist_id = row baru)

7. updateProductAverageCost + updateUomBasePrices + recipe propagate
   (existing chain — sekali per product, dedupe di caller)
```

`FOR UPDATE` mencegah dua post concurrent membaca active row yang sama.

### 3b. Post PI — loop + warnings (Gap 4)

Urutan dalam **satu transaksi** (setelah journal + stock cost OK):

```typescript
interface PricelistSyncResult {
  synced: number
  skipped: number
  warnings: Array<{
    product_name: string
    uom_invoice: string
    reason: string
  }>
}
```

```
FOR EACH line:
  resolve uom_id dari uom_invoice
  IF uom tidak ditemukan → warnings.push(...); CONTINUE
  IF unit_price = 0 → skipped++; CONTINUE
  syncFromPurchaseInvoice(...)
  synced++ atau skipped++
```

**Response POST `/purchase-invoices/:id/post`:**

```typescript
{
  // ... invoice detail ...
  pricelist_sync: {
    synced: 5,
    skipped: 1,
    warnings: [
      {
        product_name: "Ayam Fillet",
        uom_invoice: "KG",
        reason: "UOM \"KG\" tidak ditemukan di master produk"
      }
    ]
  }
}
```

Frontend: toast **warning** (non-blocking) jika `warnings.length > 0`. Post tetap sukses.

### 3c. Unpost PI — **Option A: Strict LIFO** (Gap 1 — best practice)

**Konteks operasional:** Perubahan harga antar invoice jarang berdekatan (minggu/bulan), kecuali inflasi dadakan. Unpost PI lama setelah PI baru sudah overwrite pricelist = kasus langka dan berisiko merusak data PI yang masih POSTED.

**Prinsip:** Unpost **hanya boleh** jika pricelist yang dibuat saat post PI itu **masih pricelist aktif** untuk combo `(supplier, product, uom)`. Kalau sudah ada PI lebih baru yang overwrite → **block** dengan pesan jelas.

**Validasi sebelum revert** (`validateUnpostPricelistRevert`):

```typescript
// Untuk setiap ppc WHERE purchase_invoice_id = $piId AND source = 'PI_POST':
const blocked = changes.filter(
  (c) =>
    !c.pricelist_is_active ||           // pricelist dari post ini sudah tidak active
    c.has_newer_pi_post                 // ada PI_POST lain lebih baru untuk combo sama
)

if (blocked.length > 0) {
  throw new PurchaseInvoicePricelistSupersededError(blocked) // 409
  // "Salmon Fresh (KG): harga sudah diupdate Invoice INV-002 — unpost dibatalkan."
}
```

**Query `has_newer_pi_post`:**

```sql
EXISTS (
  SELECT 1 FROM pricelist_price_changes ppc2
  JOIN purchase_invoices pi2 ON pi2.id = ppc2.purchase_invoice_id
  WHERE ppc2.supplier_id = ppc.supplier_id
    AND ppc2.product_id = ppc.product_id
    AND ppc2.uom_id = ppc.uom_id
    AND ppc2.source = 'PI_POST'
    AND ppc2.purchase_invoice_id != $piId
    AND pi2.status = 'POSTED'
    AND pi2.deleted_at IS NULL
    AND (ppc2.effective_date > ppc.effective_date
         OR (ppc2.effective_date = ppc.effective_date
             AND pi2.posted_at > pi.posted_at))
)
```

**Algoritma unpost (jika validasi lolos):**

```
FOR EACH ppc WHERE purchase_invoice_id = $piId AND source = 'PI_POST':
  1. Lock active pricelist FOR UPDATE (must match ppc.pricelist_id)
  2. Deactivate pricelist dari post ini
  3. IF ppc.old_price IS NOT NULL:
       INSERT pricelist restored (price=old_price, source=PI_UNPOST, is_active=true)
     ELSE:
       // first-ever price for combo — no prior row; leave inactive until next post/manual
  4. INSERT pricelist_price_changes (PI_UNPOST)
  5. updateProductAverageCost untuk product (once per product, after loop)
```

**UX unpost diblock:** Modal/toast error list produk + link ke invoice yang supersede. User unpost PI lebih baru dulu (LIFO urutan posting), atau koreksi manual pricelist.

**Kenapa bukan Option B:** Force revert + self-heal kompleks dan destructive untuk PI unrelated; jarang dibutuhkan given pola harga jarang berdekatan.

### 3d. Average cost setelah unpost (Gap 3)

Ada **dua** average cost — jangan dicampur:

| Layer | Sumber | Saat unpost PI |
|-------|--------|----------------|
| **Gudang aktual** | `stock_balances.avg_cost` ← `recomputeStockBalanceAvgCost()` dari **semua** `stock_movements` | ✅ Sudah benar — full recalc scratch, bukan incremental. Reset movement cost → recompute. |
| **Master produk / resep** | `products.average_cost` ← latest **active pricelist** ÷ conversion_factor | Panggil **sekali per product** setelah loop revert selesai (Option A: hanya jika unpost lolos validasi) |

```typescript
// Setelah semua pricelist revert selesai (Option A — hanya jika tidak blocked):
const affectedProductIds = [...unique dari combo yang tersentuh]
for (const productId of affectedProductIds) {
  await pricelistsService.updateProductAverageCost(productId, companyId, client)
}
```

**Jangan** panggil `updateProductAverageCost` di tengah loop per-line — tunggu state pricelist final.

### 3e. Manual pricelist create (Gap 5)

Extend `createPricelist` existing:

```
IF source !== 'PI_POST':  // PI_POST insert history sendiri di syncFromPurchaseInvoice
  INSERT pricelist_price_changes (
    source = 'MANUAL',
    old_price = harga active sebelum deactivate (atau NULL),
    new_price = price baru,
    pricelist_id = row baru,
    effective_date = valid_from
  )
```

History lengkap dari Day 1 — manual dan PI satu timeline.

---

## 4. API

### Existing — extend response

| Method | Path | Tambahan |
|--------|------|----------|
| POST | `/purchase-invoices/:id/post` | `pricelist_sync` di response |

### New

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/pricelists/price-changes` | List riwayat |
| GET | `/pricelists/price-changes/chart` | Sparkline data (last N points per combo) |

Static routes **before** `/:id`.

---

## 5. UI — Design System (`.cursor/rules/Design Rules.mdc`)

Referensi visual: **Stripe Dashboard · Linear · Vercel** — dashboard quality, breathing room, hierarchy kuat.

### 5a. Layout halaman `/inventory/pricelists`

```
┌─ max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-10 ─────────────────────────┐
│  Header: "Pricelist" + subtitle muted                                       │
│  [Search rounded-2xl]  [Filter pill]                    spacing gap-4       │
├─ Section: Harga Aktif ──────────────────────────────────────────────────────┤
│  Card rounded-2xl border border-gray-100 shadow-sm (soft)                   │
│  → Pricelist cards / grouped rows (bukan plain table penuh)                 │
│  hover: transition shadow-md                                                │
├─ Section: Riwayat Perubahan Harga ──────────────────────────────────────────┤
│  Stat row (3 cards rounded-2xl): Naik · Turun · Rata-rata Δ%               │
│  Card rounded-2xl: timeline / change cards                                  │
│  Empty state ilustrasi + copy jika belum ada riwayat                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tabs (optional v1):** Segmented control `rounded-2xl` — **Aktif | Riwayat** — bukan crowded dual scroll.

### 5b. Komponen & token

| Elemen | Spec |
|--------|------|
| Container | `max-w-7xl mx-auto`, section `space-y-8` / `space-y-10` |
| Card | `rounded-2xl border border-gray-100 dark:border-gray-800 bg-white shadow-sm` |
| Radius | **`rounded-2xl`** default; `rounded-full` untuk badge/pill saja |
| Shadow | Subtle only — `shadow-sm`, hover `shadow-md transition-shadow duration-200` |
| Typography | Title `text-2xl font-semibold`; section `text-sm font-bold uppercase tracking-widest text-gray-400`; body `text-sm` |
| Spacing | Padding card `p-6 lg:p-8`; gap grid `gap-4 lg:gap-6` |
| Table alternative | **Change cards** di mobile; desktop = card rows dengan grid columns (hindari plain `<table>` penuh) |

### 5c. Stat cards (Phase 5)

Tiga kartu horizontal, `grid grid-cols-1 sm:grid-cols-3 gap-4`:

| Kartu | Icon | Nilai | Sub |
|-------|------|-------|-----|
| Naik | `TrendingUp` merah | count | "produk naik harga" |
| Turun | `TrendingDown` hijau | count | "produk turun harga" |
| Rata-rata Δ | `Percent` | % | "periode filter" |

### 5d. Riwayat — change card (bukan row table)

Setiap perubahan = **card row** `rounded-2xl p-4 hover:bg-gray-50/80 transition-colors`:

```
┌──────────────────────────────────────────────────────────────────┐
│ 20 Mei 2026          [Invoice] badge          ▼ 3,2%  (hijau)   │
│ Salmon Fresh · AB017 · Aneka Boga · Kilogram                     │
│ Rp 95.000  →  Rp 92.000  (harga lama muted, baru semibold)       │
│ Dari invoice PI-BOG-…  [Buka →]                                 │
│ ▁▂▃▅ sparkline mini (90px) ─────────────────                   │
└──────────────────────────────────────────────────────────────────┘
```

| Field | UI |
|-------|-----|
| Tanggal | `effective_date`, `text-xs font-mono text-gray-400` |
| Produk | `font-semibold` + kode monospace muted |
| Harga lama → baru | Arrow `→`, strikethrough optional on old |
| Perubahan | Pill `rounded-full` — naik `bg-red-50 text-red-700`, turun `bg-emerald-50 text-emerald-700`, new `bg-gray-100` |
| Sumber | Badge: `Invoice` indigo / `Manual` gray / `Unpost` amber |
| Link PI | `text-indigo-600 hover:underline text-xs` → `/inventory/purchase-invoices/:id` |
| Sparkline | Inline SVG ~80×24px, stroke only, no chart library |

### 5e. Supplier Product page (`/supplier-products/:id/pricelists`)

- **Hero card** `rounded-2xl`: produk + supplier, harga aktif `text-3xl font-semibold tabular-nums`
- **Chart card** `rounded-2xl p-6`: line SVG full width (90 hari, scoped)
- Riwayat — same change cards, pre-filtered

### 5f. States

| State | Pattern |
|-------|---------|
| Loading | `CardSkeleton` shimmer, `rounded-2xl` |
| Empty riwayat | Icon muted + "Belum ada perubahan harga" + hint post PI |
| Error unpost LIFO | Alert `rounded-2xl border-amber-200 bg-amber-50` + list produk + link invoice supersede |
| Post warning | Toast amber + optional alert card di PI detail |

### 5g. Post PI warning (Gap 4)

```tsx
if (result.pricelist_sync?.warnings?.length > 0) {
  toast.warning(/* product + reason */)
}
```

### 5h. Dark mode & a11y

- Card/badge: pasangan `dark:` seperti halaman PI
- Sparkline: `text-gray-400 dark:text-gray-500`
- Focus ring `ring-2 ring-indigo-500`; perubahan harga pakai ▲/▼ + warna (bukan warna saja)

---

## 6. Phase implementasi (revised)

| Phase | Scope |
|-------|--------|
| **1a** | Migration (`pricelist_price_changes` + kolom `pricelists`) |
| **1b** | `syncFromPurchaseInvoice` + FOR UPDATE + history insert |
| **1c** | Hook post PI + `pricelist_sync` response + FE warning toast |
| **2a** | Unpost Option A (LIFO validate + revert) + avg cost refresh |
| **2b** | Manual create → history row |
| **3** | API price-changes list + chart |
| **4** | UI riwayat change cards + link PI (Design Rules) |
| **5** | Stat cards + sparkline + supplier product chart panel |

---

## 7. Edge cases (updated)

| Case | Handling |
|------|----------|
| UOM tidak resolve | Warning, skip line, post tetap sukses |
| Same price ±0.01 | Skip sync, no history noise |
| Concurrent post same product | FOR UPDATE serializes |
| PI-A unpost setelah PI-B post | **Block** Option A — error + link ke PI-B |
| PI-A unpost, pricelist masih active | Revert ke old_price, history PI_UNPOST |
| Manual pricelist | History MANUAL |
| old_price = 0 atau NULL | change_pct = NULL |
| Unpost PI | Stock avg_cost: existing recompute ✓; products.average_cost: after pricelist final |

---

## 8. Out of scope (v1)

- Option B force revert / self-heal (ditolak — pakai Option A)
- Approval workflow harga
- Menu selling price sync
- COGS dari stock avg cost (modul terpisah)
- Chart library eksternal (recharts) — SVG inline only

---

## 9. Checklist approval

- [x] Auto overwrite on post
- [x] **Option A** unpost (Strict LIFO — block jika superseded)
- [x] FOR UPDATE concurrency
- [x] UOM warnings non-blocking
- [x] Manual pricelist → history
- [x] change_pct null-safe
- [x] UI spec — Design Rules (rounded-2xl, cards, spacing, empty/loading states)
- [ ] Implement Phase 1a
- [ ] Turun=hijau, Naik=merah (+ icon ▲/▼)

**Siap mulai Phase 1a code.**
