# Goods Receipt — Feature Plan

## 🎯 Fitur yang Akan Diterapkan

### 1. Partial Receive vs Reject/Return — Perbedaan

| | Partial Receive | Reject/Return |
|---|---|---|
| **Apa** | Barang datang tapi tidak semua (misal order 20, datang 15) | Barang datang tapi ditolak karena rusak/tidak sesuai |
| **Qty di GR** | qty_received = 15 (terima yang datang) | qty_received = 15, qty_rejected = 5 (tolak yang rusak) |
| **Stok** | +15 masuk gudang | +15 masuk gudang, 5 tidak masuk |
| **PO Status** | PARTIAL_RECEIVED (masih ada sisa 5 yang belum datang) | Tergantung — bisa PARTIAL atau FULLY jika semua sudah "diproses" |
| **Follow up** | Supplier kirim sisa 5 di pengiriman berikutnya → GR baru | Supplier ganti barang / potong invoice / credit note |
| **Contoh** | "Salmon order 20kg, baru datang 15kg, sisanya besok" | "Salmon datang 20kg tapi 5kg busuk, ditolak" |

**Kesimpulan:** Dua hal berbeda yang bisa terjadi bersamaan. Order 20 → datang 18 (partial) → 3 dari 18 rusak (reject) → masuk gudang cuma 15.

### Implementasi

**Partial Receive** — sudah ada secara mekanik:
- GR form sudah bisa input qty < qty_ordered
- Backend sudah update PO status ke PARTIAL_RECEIVED jika belum semua diterima
- User bisa buat GR baru untuk sisa qty di kemudian hari

**Reject/Return** — perlu tambah:
- Tambah field `qty_rejected` per line di GR
- Tambah field `reject_reason` per line (dropdown: Rusak, Expired, Tidak Sesuai, Lainnya)
- Di form: kolom baru "Ditolak" di samping "Diterima"
- Stok yang masuk = `qty_received` (yang ditolak tidak masuk)
- Report: bisa lihat history reject per supplier (untuk evaluasi supplier)

---

### 2. Notes/Catatan per GR

**Saat ini:** Field `notes` ada di backend payload tapi tidak ada input di frontend form.

**Implementasi:**
- Tambah textarea "Catatan" di form header (di bawah row invoice)
- Contoh isi: "Barang datang terlambat 2 hari", "Kemasan ada yang penyok"
- Tampilkan di GR detail page

---

### 3. Print/Export GR

**Tujuan:** Cetak bukti penerimaan barang untuk arsip fisik / tanda tangan.

**Implementasi:**
- Tombol "Cetak" di GR detail page (hanya muncul jika status CONFIRMED)
- Buka print window dengan format:
  ```
  ┌─────────────────────────────────────────┐
  │ BUKTI PENERIMAAN BARANG                 │
  │ No: GR-JAK-001-20260512-001             │
  │ Tanggal: 12 Mei 2026                    │
  │ PO: PO-JAK-001-20260512-001             │
  │ Supplier: Aneka Pangan                  │
  │ Gudang: Gudang Utama SUSHIMAS CONDET    │
  ├─────────────────────────────────────────┤
  │ No │ Produk    │ Qty │ UOM │ Harga      │
  │ 1  │ Salmon    │ 15  │ kg  │ Rp 48.000  │
  │ 2  │ Tuna      │ 10  │ kg  │ Rp 35.000  │
  ├─────────────────────────────────────────┤
  │ Total Invoice: Rp 1.070.000             │
  ├─────────────────────────────────────────┤
  │ Diterima oleh:          Diketahui:      │
  │                                         │
  │ _______________    _______________       │
  │ (Nama)             (Nama)               │
  └─────────────────────────────────────────┘
  ```
- Pakai `window.print()` — simple, no library needed

---

### 4. Responsive

**Saat ini:** GR form dan detail page pakai table yang overflow di mobile.

**Implementasi:**
- GR Form: card layout di mobile untuk items (sama pattern seperti PR Approval)
- GR List: card layout di mobile (sama pattern seperti PR Approval list)
- GR Detail: stack layout di mobile
- Breakpoint: `sm:` (640px)

---

### 5. Edit GR (Draft)

**Saat ini:** GR draft hanya bisa dihapus, tidak bisa diedit.

**Implementasi:**
- Tombol "Edit" di GR detail page (hanya status DRAFT)
- Navigate ke `/inventory/goods-receipts/:id/edit`
- Form sama seperti create, tapi pre-populated dari data existing
- Bisa ubah: qty_received, harga invoice, no invoice, tanggal, foto, notes
- Tidak bisa ubah: PO reference, warehouse (harus hapus & buat ulang jika salah PO)
- Backend: endpoint `PUT /goods-receipts/:id` (validate status = DRAFT)

---

## 📊 Prioritas Implementasi

| # | Fitur | Effort | Impact |
|---|-------|--------|--------|
| 1 | Notes/Catatan | Rendah | Medium — 1 field di form |
| 2 | Responsive | Medium | High — usability mobile |
| 3 | Edit GR Draft | Medium | High — user sering salah input |
| 4 | Print/Export | Rendah | Medium — kebutuhan arsip |
| 5 | Reject/Return | Medium | Medium — quality control |

---

## 📝 Database Changes Needed

```sql
-- Untuk Reject/Return (nanti)
ALTER TABLE goods_receipt_lines ADD COLUMN qty_rejected NUMERIC(20,4) DEFAULT 0;
ALTER TABLE goods_receipt_lines ADD COLUMN reject_reason VARCHAR(50); -- 'DAMAGED', 'EXPIRED', 'WRONG_ITEM', 'OTHER'
ALTER TABLE goods_receipt_lines ADD COLUMN reject_notes TEXT;
```

Untuk fitur lain (Notes, Edit, Print) — tidak perlu perubahan DB karena field `notes` sudah ada.

---

## 🔍 Fitur Tambahan yang Perlu Dipertimbangkan

### 6. Attachment/Foto Multiple (Delivery Note, Surat Jalan)

**Saat ini:** Upload 1 foto invoice saja.

**Kebutuhan real:** GR biasanya perlu lampirkan:
- Foto barang yang diterima
- Delivery Order dari supplier
- Surat Jalan
- Foto invoice

**Implementasi:**
- Tambah tabel `goods_receipt_attachments` (gr_id, file_type, file_path, uploaded_at)
- `file_type`: 'INVOICE', 'DELIVERY_NOTE', 'SURAT_JALAN', 'PHOTO_BARANG', 'OTHER'
- UI: section upload multiple files dengan label per type
- Existing `invoice_photo_url` di-migrate ke tabel baru atau tetap sebagai shortcut

```sql
CREATE TABLE goods_receipt_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  file_type VARCHAR(30) NOT NULL, -- 'INVOICE', 'DELIVERY_NOTE', 'SURAT_JALAN', 'PHOTO_BARANG', 'OTHER'
  file_path TEXT NOT NULL,
  file_name VARCHAR(255),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID
);
```

---

### 7. Notifikasi ke Purchasing

**Kebutuhan:** Saat GR di-confirm, purchasing perlu tahu barang sudah diterima — terutama untuk partial receive agar bisa follow up sisa ke supplier.

**Implementasi (opsi):**
- **WhatsApp (wa.me)** — sama pattern seperti PO "Kirim ke Purchasing". Setelah confirm GR, modal muncul untuk kirim WA ke purchasing.
- **Telegram Bot** — sudah ada infrastructure Telegram notification. Tambah trigger saat GR confirmed.
- **In-app notification** — badge/counter di sidebar untuk purchasing.

**Pesan contoh:**
```
✅ Barang Diterima

GR: GR-JAK-001-20260512-001
PO: PO-JAK-001-20260512-001
Supplier: Aneka Pangan
Cabang: SUSHIMAS CONDET

Diterima: 15 dari 20 item
Status PO: PARTIAL_RECEIVED

Sisa belum datang:
- Salmon: 5 kg
- Tuna: 3 kg

Mohon follow up ke supplier.
```

---

### 8. Validasi Harga vs PO (Threshold Warning)

**Saat ini:** Variance detection sudah ada (OK / NOTICE / DISPUTED) di GR detail. Tapi di form input, user bisa langsung input harga berapapun tanpa warning.

**Improvement:**
- Di GR form: saat user ubah harga invoice, tampilkan warning real-time jika selisih > threshold
- Threshold configurable (default 5% atau 15%)
- Warna border input: hijau (OK), kuning (>5%), merah (>15%)
- Tidak blocking — tetap bisa submit, tapi user aware

**Sudah partial implemented:** Backend sudah hitung `price_variance_pct` dan set `variance_status`. Yang kurang: warning di form saat input.

---

### 9. GR Tanpa PO (Non-PO Receipt)

**Kebutuhan:** Pembelian spontan tanpa PO — barang datang tapi tidak ada PO-nya. Sering terjadi di restoran (beli dadakan di pasar).

**Implementasi:**
- Tombol "Terima Tanpa PO" di GR list page
- Form mirip GR biasa tapi tanpa pilih PO:
  - Pilih supplier manual
  - Pilih gudang manual
  - Input items manual (search product + qty + harga)
- `po_id` nullable di `goods_receipts` table
- Tetap buat stok movement + jurnal saat confirm
- Report: bisa filter GR yang tanpa PO (untuk audit — kenapa beli tanpa PO?)

```sql
-- goods_receipts.po_id sudah nullable? Cek constraint
ALTER TABLE goods_receipts ALTER COLUMN po_id DROP NOT NULL;
```

**Catatan:** Ini edge case tapi penting. Bisa ditambah approval flow khusus untuk non-PO receipt (misal harus approve oleh manager karena bypass proses normal).

---

## ❓ Klarifikasi yang Perlu Dijawab

### Edit GR Draft — Backend Status

**Jawaban:** Endpoint `PUT /goods-receipts/:id` **belum ada**. Perlu dibuat:
- Controller: `update` method
- Service: validate status = DRAFT, update header + lines
- Repository: `update` + `replaceLines`

### Reject/Return — Alur Supplier Response

**Untuk sekarang:** Cukup dicatat di `reject_notes` per line. Belum perlu modul Credit Note terpisah.

**Nanti (future):** Bisa tambah:
- Status per rejected item: 'PENDING_REPLACEMENT', 'CREDIT_NOTE_ISSUED', 'RESOLVED'
- Link ke Credit Note document (jika supplier potong invoice)
- Tapi ini scope accounting, bukan inventory — bisa di-phase terpisah

### Print — Harga Ditampilkan atau Tidak?

**Rekomendasi:** Buat 2 versi print:
1. **Bukti Terima (Gudang)** — tanpa harga. Untuk tanda tangan penerima.
2. **Laporan GR (Finance)** — dengan harga + total. Untuk arsip accounting.

Atau: 1 template, harga di-hide by default, ada toggle "Tampilkan Harga" sebelum print.

---

## 📊 Prioritas Implementasi (Updated)

| # | Fitur | Effort | Impact | Status |
|---|-------|--------|--------|--------|
| 1 | Notes/Catatan | Rendah | Medium | ✅ DONE |
| 2 | Responsive | Medium | High | ✅ DONE |
| 3 | Edit GR Draft | Medium | High | ✅ DONE |
| 4 | Print/Export | Rendah | Medium | ✅ DONE |
| 5 | Reject/Return | Medium | Medium | ✅ DONE (DB + UI + schema) |
| 6 | Multiple Attachments | Medium | Medium | TODO |
| 7 | Notifikasi Purchasing | Rendah | Medium | TODO |
| 8 | Harga Warning di Form | Rendah | Low | Partial (backend done) |
| 9 | GR Tanpa PO | High | Medium | TODO (edge case) |
