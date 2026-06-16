---
type: module
slug: marketplace-po
status: active
domain: "[[20-DOMAINS/Purchasing/_Index|Purchasing]]"
backend_path: backend/src/modules/marketplace-po
frontend_path: frontend/src/features/marketplace-po
api_base: /api/v1/marketplace-po
permission_module: marketplace_po, owner_credit_cards, cc_owner_settlements
depends_on:
  - "[[30-MODULES/M-Purchase-Orders|M-Purchase Orders]]"
  - "[[30-MODULES/M-Goods-Receipts|M-Goods Receipts]]"
  - "[[30-MODULES/M-General-Invoices|M-General Invoices]]"
  - "[[30-MODULES/M-Accounting|M-Accounting]]"
  - "[[30-MODULES/M-Bank-Accounts|M-Bank Accounts]]"
  - "[[30-MODULES/M-Bank-Statements|M-Bank Statements]]"
used_by:
  - "[[70-FLOWS/Marketplace-Checkout-Flow]]"
  - "[[70-FLOWS/CC-Settlement-Flow]]"
related_tables:
  - owner_credit_cards (kartu kredit owner untuk checkout marketplace)
  - marketplace_checkout_sessions (sesi checkout — header)
  - marketplace_checkout_lines (line item per PO)
  - marketplace_attachments (file bukti bayar, screenshot, invoice)
  - marketplace_shipments (resi pengiriman)
  - marketplace_batch_settlements (riwayat bulk settlement)
last_updated: 2026-06-16
---

# M-Marketplace PO / Checkout

## Purpose

Module ini mengelola **pembelian via marketplace** (Shopee & Tokopedia) — dari checkout, pengiriman, penerimaan barang, hingga pelunasan kartu kredit owner.

### Business Context

Ketika perusahaan membeli barang melalui marketplace (Shopee/Tokopedia) menggunakan kartu kredit owner, alurnya:
1. **Checkout** → Catat transaksi marketplace dan buat jurnal hutang ke CC owner.
2. **Order** → Posting jurnal (debit persediaan, credit CC owner), upload bukti bayar.
3. **Ship** → Input resi, buatkan Goods Receipt (GR) otomatis per PO dalam status DRAFT.
4. **Receive** → Barang diterima (GR di-confirm oleh tim gudang).
5. **Post Receive Journal** → Jurnal penerimaan barang (debit inventory, credit marketplace payable).
6. **Settle** → Pelunasan ke bank (jurnal debit CC owner, credit bank).

Module ini juga mengelola **Owner Credit Cards** (master data kartu kredit owner + COA mapping) dan **CC Owner Settlements** (pelunasan bulk ke bank).

## Sub-Modules

| Area | Permission Module | Deskripsi |
|------|-------------------|-----------|
| **Marketplace Sessions** | `marketplace_po` | CRUD session + status workflow |
| **Owner Credit Cards** | `owner_credit_cards` | Master data kartu kredit owner |
| **CC Settlements** | `cc_owner_settlements` | Pelunasan CC + rekonsiliasi bank statement |

## Layer Map

```
Routes → Controller → Service → Repository
  Schema    handleError      Audit        SQL queries
```

### Rute API

#### Owner Credit Cards

| Method | Endpoint | Permission | Deskripsi |
|--------|----------|------------|-----------|
| GET | `/owner-credit-cards` | view | Daftar kartu kredit owner |
| POST | `/owner-credit-cards` | insert | Tambah kartu kredit |
| PUT | `/owner-credit-cards/:id` | update | Edit kartu kredit |
| DELETE | `/owner-credit-cards/:id` | delete | Hapus (soft delete) |

#### Marketplace Sessions

| Method | Endpoint | Permission | Deskripsi |
|--------|----------|------------|-----------|
| GET | `/marketplace-sessions` | view | List sessions dengan filter (platform, status, branch, date, search, pagination) |
| GET | `/marketplace-sessions/pending-po-lines` | view | PO lines yang siap di-checkout |
| GET | `/marketplace-sessions/:id` | view | Detail session (header + lines + shipments + attachments) |
| POST | `/marketplace-sessions` | insert | Buat session baru (DRAFT) |
| PUT | `/marketplace-sessions/:id` | update | Edit header session (hanya DRAFT) |
| DELETE | `/marketplace-sessions/:id/lines/:lineId` | update | Hapus line dari DRAFT session |
| DELETE | `/marketplace-sessions/:id` | delete | Batalkan DRAFT session |
| POST | `/marketplace-sessions/:id/attachments` | update | Upload attachment (BUKTI_BAYAR, SCREENSHOT_CHECKOUT, INVOICE_MARKETPLACE, OTHER) |
| DELETE | `/marketplace-sessions/:id/attachments/:attachmentId` | update | Hapus attachment |
| POST | `/marketplace-sessions/:id/order` | update | Order → DRAFT → ORDERED (post jurnal) |
| POST | `/marketplace-sessions/:id/shipments` | update | Ship → input resi + buat GR DRAFT |
| POST | `/marketplace-sessions/:id/cancel-ordered` | release | Batalkan ORDERED session |
| POST | `/marketplace-sessions/:id/cancel-shipped` | release | Batalkan SHIPPED session |
| POST | `/marketplace-sessions/:id/lines/:lineId/cancel` | update | Cancel 1 line dari SHIPPED session |
| POST | `/marketplace-sessions/:id/post-receive-journal` | update | Post jurnal penerimaan (ORDERED → RECEIVED) |
| POST | `/marketplace-sessions/:id/settle` | release | Settle → pelunasan ke bank |

#### CC Owner Settlements

| Method | Endpoint | Permission | Deskripsi |
|--------|----------|------------|-----------|
| GET | `/marketplace-settlements/summary` | view | Summary settlement |
| GET | `/marketplace-settlements/pending-general-invoices` | view | General invoice payment yang pending settle |
| POST | `/marketplace-settlements/bulk` | update | Bulk settle multiple sessions + GI payments |
| GET | `/marketplace-settlements/unreconciled-statements` | view | Bank statements yang belum di-reconcile |

## Key Business Rules

### 1. Status State Machine

```
DRAFT → ORDERED → SHIPPED → RECEIVED → SETTLED
  ↓         ↓         ↓
CANCELLED (dengan reason)
```

| Status | Arti | Bisa Di-Edit? |
|--------|------|---------------|
| `DRAFT` | Sesuai baru dibuat, bisa diedit | ✅ Ya |
| `ORDERED` | Sudah di-order di marketplace + jurnal posting | ❌ Tidak (kecuali cancel) |
| `SHIPPED` | Resi sudah diinput + GR dibuat | ❌ Tidak |
| `RECEIVED` | Barang sudah diterima (GR di-confirm) | ❌ Tidak |
| `SETTLED` | Pembayaran sudah diselesaikan | ❌ Tidak |
| `CANCELLED` | Dibatalkan dengan reason | — |

### 2. Multi-tenant
- Semua query filter `company_id`.
- Branch access diverifikasi setiap request.

### 3. Session Number
- Generate otomatis per platform & company.
- Format: `{platform}-{YYYYMM}-{XXX}`.

### 4. Jurnal Workflow
Setiap transaksi melalui journal workflow lengkap: **Create → Submit → Approve → Post** (dalam satu fungsi `postJournalWorkflow`).

| Tahap | Jurnal | Debit | Credit |
|-------|--------|-------|--------|
| **Order** | `journal_ordered_id` | 110598 (Marketplace Payable) | CC Owner COA |
| **Receive** | `journal_received_id` | 110501 (Inventory) | 110598 (Marketplace Payable) |
| **Settle** | `journal_settled_id` | CC Owner COA | Bank COA |

### 5. Cancel Mechanism
| Status Cancel | Dampak |
|---------------|--------|
| **DRAFT cancel** | Soft delete, tidak ada jurnal |
| **ORDERED cancel** | Session di-cancel + jurnal ordered di-force delete |
| **SHIPPED cancel** | Session di-cancel + jurnal ordered di-force delete + GR dihapus |
| **Cancel Line** (SHIPPED) | 1 line di-cancel + GR line dihapus + jurnal koreksi dibuat |

### 6. GR Creation on Ship
- Saat ship, sistem auto-create Goods Receipt (DRAFT) per PO.
- GR di-confirm oleh tim gudang (via modul Goods Receipts).
- Setelah GR confirm → session otomatis jadi `RECEIVED` (? — perlu dicek apakah ada trigger).

### 7. Attachment
- Upload hanya untuk session DRAFT atau ORDERED.
- File type: `BUKTI_BAYAR`, `SCREENSHOT_CHECKOUT`, `INVOICE_MARKETPLACE`, `OTHER`.
- Max 10MB, format terbatas (sesuai `DOCUMENT_UPLOAD_EXTENSIONS`).
- Attachment `BUKTI_BAYAR` **wajib ada** sebelum bisa ORDER.

### 8. Bulk Settlement
- Bisa settle multiple sessions + general invoice payments sekaligus.
- Semua item di-group per CC COA code + branch.
- Dibuatkan 1 jurnal per group.
- Concurrent-safe: sessions di-mark SETTLED eagerly + GI payments di-lock.

## Panduan Penggunaan (User Guide)

### 🖥️ Cara Membuka Halaman
1. Login ke Suryamas ERP.
2. Navigasi: **Purchasing → Marketplace PO** (atau dari dashboard shortcut).

### 👤 Setup Awal: Owner Credit Cards
Sebelum bisa checkout, admin harus setup kartu kredit owner:
1. Buka tab **Owner Credit Cards**.
2. Klik **Tambah Kartu**.
3. Isi:
   - **Nama Kartu**: misal "BCA Visa Anthony"
   - **Bank**: misal "BCA"
   - **4 Digit Akhir**: opsional
   - **Kode COA**: akun chart of accounts untuk CC ini (biasanya liabilitas)
   - **Rekening Settlement**: bank account untuk pelunasan (opsional)
4. Klik **Simpan**.

### 🛒 Alur Checkout Marketplace

#### Step 1: Buat Session (DRAFT)
1. Klik **Buat Session Baru**.
2. Pilih **Platform**: Shopee atau Tokopedia.
3. Pilih **Kartu Kredit** yang digunakan.
4. Pilih **Tanggal Checkout**.
5. Cari PO lines yang siap di-checkout (filter platform).
6. Pilih items → isi qty & harga.
7. Klik **Simpan**.
8. Session akan muncul di list dengan status **DRAFT**.

#### Step 2: Upload Bukti Bayar + Order
1. Buka detail session DRAFT.
2. Upload attachment **BUKTI_BAYAR** (wajib — screenshot/scan bukti transfer dari marketplace).
3. Klik **Order**.
4. Sistem akan:
   - Generate jurnal (debit 110598, credit CC COA).
   - Submit → Approve → Post jurnal otomatis.
   - Status session jadi **ORDERED**.

#### Step 3: Input Resi (Ship)
1. Buka session yang sudah ORDERED.
2. Klik **Input Resi**.
3. Isi: resi/tracking number, kurir, tanggal kirim.
4. Klik **Simpan**.
5. Sistem akan:
   - Simpan data shipment.
   - **Auto-create Goods Receipt (DRAFT)** per PO — langsung terlihat di modul Goods Receipts.
6. Status session jadi **SHIPPED**.

#### Step 4: Terima Barang (GR Confirm)
Ini dilakukan oleh tim gudang via **Goods Receipts**:
1. Buka GR yang auto-created.
2. Confirm barang sesuai dengan qty yang diterima.
3. Setelah GR di-confirm → session status jadi **RECEIVED**.

#### Step 5: Post Jurnal Penerimaan
1. Buka session RECEIVED.
2. Klik **Post Jurnal Penerimaan**.
3. Sistem akan:
   - Generate jurnal (debit 110501 Inventory, credit 110598 Marketplace Payable).
   - Status tetap RECEIVED (jurnal_received_id terisi).

#### Step 6: Pelunasan (Settle)
1. Buka session RECEIVED.
2. Klik **Pelunasan**.
3. Pilih **Bank Account** tujuan transfer.
4. Isi: jumlah, tanggal, nomor referensi.
5. Klik **Submit**.
6. Sistem akan:
   - Generate jurnal (debit CC COA, credit Bank COA).
   - Status session jadi **SETTLED**.

### 💰 Bulk Settlement
Untuk settle banyak session + general invoice payments sekaligus:
1. Buka tab **CC Owner Settlements**.
2. Pilih sessions dan/atau GI payments yang akan di-settle.
3. Pilih **Bank Account**.
4. Klik **Bulk Settle**.
5. Sistem akan group per CC + branch → buat 1 jurnal per group.

### ❌ Pembatalan (Cancel)

| Situasi | Cara |
|---------|------|
| **DRAFT** | Klik **Hapus** → soft delete, tidak ada efek lain |
| **ORDERED** | Klik **Batalkan** → isi alasan → session di-cancel + jurnal dihapus |
| **SHIPPED** | Klik **Batalkan** → isi alasan → session di-cancel + jurnal dihapus + GR dihapus |
| **Cancel 1 item** (SHIPPED) | Klik **Cancel Item** → line di-cancel + GR line dihapus + jurnal koreksi dibuat |

### 📎 Attachment
| Tipe File | Kegunaan |
|-----------|----------|
| `BUKTI_BAYAR` | Wajib sebelum ORDER — bukti pembayaran ke marketplace |
| `SCREENSHOT_CHECKOUT` | Opsional — screenshot halaman checkout |
| `INVOICE_MARKETPLACE` | Opsional — invoice dari marketplace |
| `OTHER` | Opsional — file lain terkait |

### 📊 View yang Tersedia
- **List Sessions**: Tabel semua session dengan filter by platform, status, branch, date range.
- **Detail Session**: Header info + lines + shipments + attachments.
- **Pending PO Lines**: PO yang sudah di-approve dan bisa di-checkout.

## Integrasi dengan Modul Lain

| Modul | Hubungan |
|-------|----------|
| **Purchase Orders** | Sumber PO lines yang di-checkout |
| **Goods Receipts** | Auto-create GR saat ship, confirm oleh tim gudang |
| **Accounting / Journals** | 3 jurnal workflow (order, receive, settle) |
| **General Invoices** | GI payments bisa ikut bulk settlement |
| **Bank Statements** | Link ke statement untuk rekonsiliasi |
| **Chart of Accounts** | COA mapping untuk CC, bank, inventory |

## Query Flow Diagram (Order Session)

```
User klik "Order"
       ↓
marketplacePoController.orderSession()
       ↓
    requireSessionDetail(id, companyIds, branchIds)
       ↓
    BEGIN TRANSACTION
       ↓
    getSessionForTransition(client, id, companyId) ← lock FOR UPDATE
       ↓
    Validasi: status === 'DRAFT', ada attachment BUKTI_BAYAR, COA CC ditemukan
       ↓
    COMMIT (lock release)
       ↓
    postJournalWorkflow(journalCreateDto, userId, companyId)
       │
       ├── journalHeadersService.create() → DRAFT
       ├── journalHeadersService.submitAsUser() → SUBMITTED
       ├── journalHeadersService.approveAsUser() → APPROVED
       └── journalHeadersService.postAsUser() → POSTED
       ↓
    BEGIN TRANSACTION
       ↓
    Lock session lagi → update status = 'ORDERED', journal_ordered_id = journal.id
       ↓
    COMMIT
       ↓
sendSuccess(res, sessionDetail)
```

## Known Gotchas / Pitfalls

- **GR Auto-created saat Ship**: GR langsung DRAFT, perlu di-confirm oleh tim gudang. Jika ada masalah dengan GR, session tidak bisa lanjut ke RECEIVED.
- **Order butuh BUKTI_BAYAR**: Pastikan upload attachment BUKTI_BAYAR dulu sebelum klik Order. Jika lupa akan error.
- **Cancel ORDERED → jurnal di-force delete**: Jurnal yang sudah di-post akan di-force delete. Ini operasi non-reversible.
- **Cancel SHIPPED → GR juga kehapus**: GR yang auto-created akan dihapus. Jika sudah ada penerimaan barang, jangan cancel.
- **Mixed branch tidak bisa**: Semua line dalam satu session harus dari cabang yang sama.
- **Session dalam 1 cabang**: Semua line dalam satu session harus dari cabang yang sama.
- **Bulk Settlement concurrent-safe**: Sessions di-mark SETTLED eagerly + GI payments di-lock. Tapi jika ada error di tengah, sessions di-revert ke RECEIVED.
- **COA harus ada**: Sistem akan validasi COA 110598, 110501, dan COA CC/Bank. Jika COA tidak ditemukan, transaksi gagal.

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
- **Flow:** [[70-FLOWS/Marketplace-Checkout-Flow]]
- **Related Module:** [[30-MODULES/M-Purchase-Orders|M-Purchase Orders]]
- **Related Module:** [[30-MODULES/M-Goods-Receipts|M-Goods Receipts]]
- **Related Module:** [[30-MODULES/M-General-Invoices|M-General Invoices]]