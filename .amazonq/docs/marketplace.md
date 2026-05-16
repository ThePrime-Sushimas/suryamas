# SPEC: Marketplace PO Module — Suryamas ERP

## Konteks Sistem

Suryamas adalah ERP untuk bisnis F&B multi-cabang. Stack:
- **Backend**: Node.js + Express + TypeScript, PostgreSQL via `pg` Pool (bukan Supabase JS client)
- **Frontend**: React + TypeScript + TanStack Query + Tailwind CSS
- **Auth**: JWT, tenant isolation via `company_id`
- **Pattern**: Controller → Service → Repository
- **Storage**: Supabase Storage (bucket `invoices`) untuk file attachment

Modul yang sudah ada dan relevan:
- `purchase_orders` + `purchase_order_lines` — PO sudah terbentuk saat approval
- `goods_receipts` + `goods_receipt_lines` — GR modul lengkap (confirm → stok masuk → journal)
- `journal_entries` + `journal_entry_lines` — double-entry accounting
- `chart_of_accounts` — COA sudah ada, lihat bagian COA di bawah
- `bank_accounts` — master rekening bank perusahaan

---

## Latar Belakang Bisnis

Purchase Order di Suryamas terbagi 2 jalur setelah approve:

### Jalur 1 — PO Supplier Biasa
```
PO Approve → GR (barang masuk) → Purchase Invoice → Journal → Bayar
```
Sudah selesai dibangun.

### Jalur 2 — PO Marketplace (Shopee & Tokopedia) ← MODUL INI
```
PO Approve → Checkout & Bayar CC → Ordered → Shipped → GR (auto) → Settled (lunasi CC)
```
Beda dengan jalur 1: **bayar dulu, barang belakangan**. Pembayaran menggunakan kartu kredit owner (bukan rekening perusahaan langsung). Perusahaan nanti reimburse CC owner via transfer bank.

**Alur operasional admin:**
1. Lihat daftar PO marketplace yang pending (filter supplier = Shopee / Tokopedia)
2. Rekap item per cabang
3. Buka aplikasi Shopee/Tokopedia, masukkan ke keranjang per cabang, checkout + payment pakai CC owner
4. Kembali ke Suryamas: buat "Checkout Session", input total bayar, pilih CC yang dipakai, upload bukti bayar
5. Post journal → status jadi ORDERED
6. Input nomor resi saat barang dikirim → status SHIPPED
7. Konfirmasi barang tiba → GR dibuat otomatis → status RECEIVED → journal barang masuk
8. Transfer ke owner untuk lunasi CC → status SETTLED → journal settlement

---

## Struktur Database (sudah dimigrasikan)

### Tabel Baru

```sql
owner_credit_cards                 -- master 5 CC owner
marketplace_checkout_sessions      -- 1 sesi checkout (1 platform, 1 CC, multi cabang)
marketplace_checkout_lines         -- line item per PO line
marketplace_checkout_attachments   -- bukti bayar, screenshot, invoice
marketplace_shipments              -- resi per cabang
marketplace_settlements            -- record pelunasan CC owner
```

### Relasi Penting
```
purchase_order_lines
    ↓ (dipilih saat buat session)
marketplace_checkout_lines
    ↓ (many)
marketplace_checkout_sessions
    ↓ (saat RECEIVED)
goods_receipts                     -- GR dibuat otomatis, source = 'MARKETPLACE'
```

### Field Kritis di marketplace_checkout_sessions
```typescript
status: 'DRAFT' | 'ORDERED' | 'SHIPPED' | 'RECEIVED' | 'SETTLED' | 'CANCELLED'
platform: 'SHOPEE' | 'TOKOPEDIA'
cc_id: UUID                        // FK ke owner_credit_cards
total_amount: number               // total yang dibayar ke marketplace
journal_ordered_id: UUID | null    // diisi saat transisi ke ORDERED
journal_received_id: UUID | null   // diisi saat transisi ke RECEIVED
journal_settled_id: UUID | null    // diisi saat transisi ke SETTLED
goods_receipt_id: UUID | null      // diisi saat transisi ke RECEIVED
```

### Field Kritis di marketplace_checkout_lines
```typescript
unit_price_netto: number   // total_bayar ÷ qty (sudah include ongkir, admin fee, dll)
total_netto: number        // = qty × unit_price_netto
```
**Catatan**: harga netto digunakan sebagai harga pokok barang. Tidak ada akun terpisah untuk ongkir/fee — sudah dibebankan ke harga barang.

---

## COA yang Digunakan

### Sudah Ada (langsung pakai):
| Kode | Nama | Dipakai saat |
|------|------|--------------|
| `110598` | Persediaan Dalam Perjalanan | Checkout → ORDERED (debit) dan RECEIVED (kredit) |
| `110501` | Bahan Baku | RECEIVED: barang masuk stok (debit) |
| `110503` | Peralatan Dapur & Perlengkapan | RECEIVED: jika produk bukan bahan baku |

### Baru Ditambahkan (via migration):
| Kode | Nama | Dipakai saat |
|------|------|--------------|
| `210602` | Utang CC Owner - Kartu 1 | ORDERED (kredit), SETTLED (debit) |
| `210603` | Utang CC Owner - Kartu 2 | sama |
| `210604` | Utang CC Owner - Kartu 3 | sama |
| `210605` | Utang CC Owner - Kartu 4 | sama |
| `210606` | Utang CC Owner - Kartu 5 | sama |

Kode COA aktual per kartu diambil dari `owner_credit_cards.coa_code`.

---

## Journal Entries yang Harus Di-post Otomatis

### Saat Status → ORDERED
```
DEBIT  110598  Persediaan Dalam Perjalanan    total_amount
KREDIT 21060x  Hutang CC Owner - [kartu]      total_amount

Keterangan: "Checkout Marketplace [PLATFORM] - [session_number]"
```

### Saat Status → RECEIVED (barang tiba, GR dibuat)
```
DEBIT  110501  Bahan Baku                     total_amount
KREDIT 110598  Persediaan Dalam Perjalanan    total_amount

Keterangan: "Barang Masuk Marketplace - [session_number] - GR [gr_number]"
```
> Akun debit (110501 vs 110503) ditentukan dari `products.product_category` atau flag di produk.
> Untuk simplifikasi awal: default ke `110501` kecuali ada flag `is_equipment = true` di produk.

### Saat Status → SETTLED (CC owner dilunasi)
```
DEBIT  21060x  Hutang CC Owner - [kartu]      amount
KREDIT 11020x  Bank [rekening yang dipilih]   amount

Keterangan: "Pelunasan CC Owner - [session_number] - Ref: [reference_number]"
```

---

## API Endpoints yang Harus Dibuat

### Master CC Owner

```
GET    /api/owner-credit-cards              — list CC (company scoped)
POST   /api/owner-credit-cards              — tambah CC baru
PUT    /api/owner-credit-cards/:id          — update label/status
DELETE /api/owner-credit-cards/:id          — soft delete (is_active = false)
```

### Marketplace Sessions

```
GET    /api/marketplace-sessions            — list dengan filter & pagination
POST   /api/marketplace-sessions            — buat session baru (status DRAFT)
GET    /api/marketplace-sessions/:id        — detail + lines + attachments + shipments
PUT    /api/marketplace-sessions/:id        — update header (hanya DRAFT)
DELETE /api/marketplace-sessions/:id        — cancel (hanya DRAFT)

-- Transisi status (masing-masing post journal otomatis)
POST   /api/marketplace-sessions/:id/order    — DRAFT → ORDERED (wajib ada BUKTI_BAYAR)
POST   /api/marketplace-sessions/:id/ship     — ORDERED → SHIPPED (input resi)
POST   /api/marketplace-sessions/:id/receive  — SHIPPED → RECEIVED (auto-create GR)
POST   /api/marketplace-sessions/:id/settle   — RECEIVED → SETTLED (input bank + ref)

-- Attachments
POST   /api/marketplace-sessions/:id/attachments          — upload file
DELETE /api/marketplace-sessions/:id/attachments/:attId   — hapus (hanya DRAFT/ORDERED)

-- Shipments
POST   /api/marketplace-sessions/:id/shipments            — tambah resi
PUT    /api/marketplace-sessions/:id/shipments/:shipId    — update resi
```

### Query Params untuk GET /api/marketplace-sessions
```
platform: 'SHOPEE' | 'TOKOPEDIA'
status: 'DRAFT' | 'ORDERED' | 'SHIPPED' | 'RECEIVED' | 'SETTLED'
branch_id: UUID
cc_id: UUID
date_from: YYYY-MM-DD
date_to: YYYY-MM-DD
search: string (cari session_number atau platform_order_id)
page: number
limit: number
```

### Helper Endpoint
```
GET /api/marketplace-sessions/pending-po-lines
    ?platform=SHOPEE&branch_id=xxx
    — ambil PO lines yang belum masuk session mana pun
    — dipakai saat admin mau buat session baru, untuk populate pilihan item
```

---

## Business Rules & Validasi

### Saat Buat Session (DRAFT)
- `platform` wajib diisi
- `cc_id` wajib, harus aktif
- `checkout_date` default hari ini
- Lines: minimal 1 item
- `po_line_id` tidak boleh sudah ada di session lain yang masih aktif (status bukan CANCELLED)
- `total_netto` per line = `qty × unit_price_netto`
- `total_amount` session = SUM semua `total_netto` lines

### Saat ORDERED
- Wajib ada minimal 1 attachment dengan `file_type = 'BUKTI_BAYAR'`
- Post journal ORDERED (lihat di atas)
- Update `journal_ordered_id`

### Saat SHIPPED
- Input minimal 1 resi di `marketplace_shipments`
- `tracking_number` wajib untuk setiap `branch_id` yang ada di lines

### Saat RECEIVED
- Auto-create `goods_receipt` dengan:
  ```
  source = 'MARKETPLACE'
  po_id = (ambil dari lines, jika multi PO maka 1 GR per PO)
  warehouse_id = warehouse default cabang
  received_date = hari ini
  invoice_number = session_number
  ```
- Auto-create `goods_receipt_lines` dari `marketplace_checkout_lines`
  ```
  qty_po_uom = line.qty
  qty_received = line.qty
  uom_received = product.default_uom
  unit_price_invoice = line.unit_price_netto
  ```
- Confirm GR otomatis (status GR langsung CONFIRMED, stok masuk)
- Post journal RECEIVED
- Update `journal_received_id` dan `goods_receipt_id`

> **Catatan**: GR dari marketplace skip validasi attachment (karena bukti bayar ada di marketplace session).
> Flag `source = 'MARKETPLACE'` di `goods_receipts` dipakai untuk skip validasi ini.

### Saat SETTLED
- Input `bank_account_id` (rekening yang dipakai transfer ke owner)
- Input `reference_number` (nomor transfer)
- Input `settled_date`
- `amount` default dari `session.total_amount`, bisa dioverride jika ada selisih
- Post journal SETTLED
- Update `journal_settled_id`

---

## Auto-create GR: Detail Implementasi

```typescript
// Di marketplace.service.ts, fungsi receiveSession()
async receiveSession(sessionId: string, companyId: string, userId: string) {
  const session = await repo.findWithLines(sessionId, companyId)

  // Group lines by po_id (1 GR per PO)
  const linesByPo = groupBy(session.lines, 'po_id')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const grIds: string[] = []

    for (const [poId, lines] of Object.entries(linesByPo)) {
      const po = await getPo(poId)
      const warehouse = await getDefaultWarehouse(lines[0].branch_id, companyId)

      // Buat GR
      const grNumber = await generateGrNumber(client, companyId, po.branch_code)
      const gr = await insertGR(client, {
        company_id: companyId,
        branch_id: po.branch_id,
        po_id: poId,
        warehouse_id: warehouse.id,
        gr_number: grNumber,
        received_date: today(),
        invoice_number: session.session_number,
        source: 'MARKETPLACE',          // ← flag penting
        status: 'CONFIRMED',            // ← langsung confirmed
        created_by: userId,
      })

      // Buat GR lines
      for (const line of lines) {
        await insertGRLine(client, {
          gr_id: gr.id,
          po_line_id: line.po_line_id,
          product_id: line.product_id,
          qty_po_uom: line.qty,
          uom_po: line.uom,
          qty_received: line.qty,
          uom_received: line.uom,
          conversion_factor: 1,
          unit_price_invoice: line.unit_price_netto,
          unit_price_po: line.unit_price_po,  // dari PO line
          qty_rejected: 0,
          variance_status: 'OK',
        })
      }

      // Update PO line qty_received
      for (const line of lines) {
        await incrementPoLineQtyReceived(client, line.po_line_id, line.qty)
      }
      await resolveAndUpdatePoStatus(client, poId, userId)

      grIds.push(gr.id)
    }

    // Post journal RECEIVED
    const journalId = await postJournalReceived(client, session, companyId, userId)

    // Update session
    await client.query(
      `UPDATE marketplace_checkout_sessions
       SET status = 'RECEIVED',
           journal_received_id = $1,
           goods_receipt_id = $2,
           updated_by = $3,
           updated_at = now()
       WHERE id = $4`,
      [journalId, grIds[0], userId, sessionId]
      // Jika multi GR, simpan array atau GR pertama sebagai referensi utama
    )

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
```

---

## Perubahan di Tabel Existing

### goods_receipts — tambah kolom `source`
```sql
ALTER TABLE goods_receipts
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'SUPPLIER'
  CHECK (source IN ('SUPPLIER', 'MARKETPLACE'));
```

GR dari marketplace: `source = 'MARKETPLACE'`
GR biasa: `source = 'SUPPLIER'` (default, tidak perlu diubah)

### Efek di GR confirm service:
```typescript
// Skip validasi attachment jika source = MARKETPLACE
if (gr.source !== 'MARKETPLACE') {
  const attachments = await repo.findAttachments(id)
  if (attachments.length === 0) {
    throw new BusinessRuleError('Upload minimal 1 dokumen sebelum konfirmasi')
  }
}
```

---

## Frontend — Halaman yang Dibutuhkan

### 1. `/inventory/marketplace-po` — List Page
- Tabel semua session dengan filter: platform, status, branch, date range
- Kolom: Session #, Platform (badge), Tanggal, Total, CC yang dipakai, Status, # Items
- Status badge berwarna per tahap
- Tombol "Buat Session Baru"
- Quick stats di atas: total per status

### 2. `/inventory/marketplace-po/new` — Form Buat Session
- Pilih Platform (Shopee / Tokopedia) — toggle besar
- Pilih CC Owner — dropdown dengan nama kartu + last 4 digit
- Tanggal checkout
- Section "Pilih Item dari PO":
  - Filter cabang
  - Daftar PO lines yang belum di-session (dari endpoint `pending-po-lines`)
  - Checkbox untuk pilih item
  - Input qty dan unit_price_netto per item
- Total otomatis dari sum lines
- Catatan (opsional)

### 3. `/inventory/marketplace-po/:id` — Detail Page
- Header: info session, status, timeline progress
- Tabs:
  - **Item** — tabel lines per cabang
  - **Resi** — input/edit tracking per cabang
  - **Lampiran** — upload/delete attachment
  - **Journal** — tampilkan jurnal yang sudah di-post (read-only)
- Action button berubah sesuai status:
  - DRAFT → "Upload Bukti Bayar + Konfirmasi Order"
  - ORDERED → "Input Resi + Tandai Dikirim"
  - SHIPPED → "Konfirmasi Barang Diterima"
  - RECEIVED → "Lunasi CC Owner"
  - SETTLED → (read-only, tampilkan semua info)

### 4. Settings: `/settings/owner-credit-cards`
- CRUD sederhana untuk master CC owner
- Field: Label, Bank, Last4, COA account

---

## Komponen UI yang Perlu Dibuat

```
MarketplaceSessionList          — list page dengan filter
MarketplaceSessionForm          — form buat session baru
MarketplaceSessionDetail        — detail page
  ├─ SessionHeader              — info + status badge + action button
  ├─ SessionTimeline            — progress bar status
  ├─ SessionItemsTab            — tabel lines per cabang
  ├─ SessionShipmentsTab        — input resi per cabang
  ├─ SessionAttachmentsTab      — upload/view dokumen
  └─ SessionJournalTab          — tampil journal entries
OrderConfirmModal               — konfirmasi post journal ORDERED
ReceiveConfirmModal             — konfirmasi terima barang + auto GR
SettleModal                     — form pilih bank + input ref number
OwnerCreditCardSettings         — CRUD CC owner
```

---

## Tipe TypeScript

```typescript
export type MarketplacePlatform = 'SHOPEE' | 'TOKOPEDIA'
export type MarketplaceSessionStatus = 'DRAFT' | 'ORDERED' | 'SHIPPED' | 'RECEIVED' | 'SETTLED' | 'CANCELLED'

export interface OwnerCreditCard {
  id: string
  company_id: string
  card_label: string
  bank_name: string
  last4: string | null
  coa_code: string
  is_active: boolean
  sort_order: number
}

export interface MarketplaceCheckoutSession {
  id: string
  company_id: string
  session_number: string
  platform: MarketplacePlatform
  cc_id: string
  cc_label?: string           // dari JOIN
  cc_coa_code?: string        // dari JOIN
  checkout_date: string
  total_amount: number
  notes: string | null
  status: MarketplaceSessionStatus
  platform_order_ids: string[] | null
  journal_ordered_id: string | null
  journal_received_id: string | null
  journal_settled_id: string | null
  goods_receipt_id: string | null
  created_by: string | null
  created_by_name?: string    // dari JOIN
  created_at: string
  updated_at: string
  // Aggregates
  line_count?: number
  branch_count?: number
}

export interface MarketplaceCheckoutLine {
  id: string
  session_id: string
  po_id: string
  po_number?: string          // dari JOIN
  po_line_id: string
  branch_id: string
  branch_name?: string        // dari JOIN
  product_id: string
  product_name?: string       // dari JOIN
  product_code?: string       // dari JOIN
  qty: number
  unit_price_netto: number
  total_netto: number
  platform_order_id: string | null
  notes: string | null
}

export interface MarketplaceShipment {
  id: string
  session_id: string
  branch_id: string
  branch_name?: string
  tracking_number: string | null
  courier: string | null
  shipped_at: string | null
  received_at: string | null
}

export interface MarketplaceAttachment {
  id: string
  session_id: string
  file_type: 'BUKTI_BAYAR' | 'SCREENSHOT_CHECKOUT' | 'INVOICE_MARKETPLACE' | 'OTHER'
  file_path: string
  file_name: string | null
  uploaded_at: string
}

export interface CreateMarketplaceSessionDto {
  platform: MarketplacePlatform
  cc_id: string
  checkout_date: string
  total_amount: number
  notes?: string
  lines: {
    po_id: string
    po_line_id: string
    branch_id: string
    product_id: string
    qty: number
    unit_price_netto: number
    platform_order_id?: string
  }[]
}

export interface SettleSessionDto {
  bank_account_id: string
  reference_number: string
  settled_date: string
  amount: number
  notes?: string
}
```

---

## Urutan Development yang Disarankan

1. **Migration SQL** (sudah ada di file `001_marketplace_po.sql`)
2. **ALTER goods_receipts** tambah kolom `source`
3. **Backend**:
   - `owner-credit-cards` CRUD (simple, tidak ada logic kompleks)
   - `marketplace-sessions` Repository (query + insert)
   - `marketplace-sessions` Service (business logic + journal posting)
   - `marketplace-sessions` Controller + Router
4. **Frontend**:
   - Settings CC Owner (simple CRUD)
   - List page
   - Form buat session
   - Detail page (tabs)
   - Modal-modal action
5. **Testing**: pastikan journal ter-post benar dan GR auto-create berjalan

---

## Catatan Penting untuk AI

1. **Jangan gunakan Supabase JS client** untuk query kompleks — pakai `pg` Pool langsung
2. **Semua journal** harus double-entry (debit = kredit), gunakan fungsi journal yang sudah ada di sistem
3. **GR auto-create** harus ikut pola yang ada di `goods-receipts.service.ts` — jangan buat logika stok sendiri
4. **File upload** ke Supabase Storage bucket `invoices`, path: `marketplace/{session_id}/{filename}`
5. **Signed URL** untuk akses file: endpoint `/storage/signed-url?path=...&bucket=invoices`
6. **Tenant isolation**: semua query wajib include `company_id`
7. **Nomor session** di-generate via fungsi `generate_marketplace_session_number()` yang sudah ada di DB
8. **COA untuk debit stok** (saat RECEIVED): cek `products.requires_processing` atau kategori produk untuk tentukan apakah `110501` atau `110503`
