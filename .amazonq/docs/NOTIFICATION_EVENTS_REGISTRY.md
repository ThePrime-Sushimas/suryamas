# Notification Events Registry

**Single source of truth** untuk event notifikasi in-app. Saat menambah halaman/flow approval baru:

1. Tambah event di `backend/src/modules/notifications/notification-events.ts` (`NOTIFICATION_EVENT_KEYS` + `NOTIFICATION_EVENT_CATALOG`)
2. Tambah key di `notifications.schema.ts` (`eventKeyEnum`)
3. Panggil `notificationDispatcher.dispatch(...)` di `*.service.ts` setelah transaksi sukses
4. Update tabel status di dokumen ini

Konfigurasi penerima (posisi): **Settings → Routing Notifikasi** (`/settings/notification-routing`).

> **Catatan:** Jika routing pernah "silang" setelah save (posisi A muncul di event B), buka halaman routing lalu **Simpan ulang** semua aturan — bug upsert paralel pada satu koneksi PG sudah diperbaiki (harus sequential per client).

---

## Procurement (Inventory)

| Status | Event key | Dipicu saat | Halaman frontend | Service |
|--------|-----------|-------------|------------------|---------|
| ✅ | `purchase_request.submitted` | PR create (langsung PENDING) / submit DRAFT | `/inventory/pr-approval` | `purchase-requests.service` |
| ✅ | `purchase_request.approved` | PR approve + generate PO | `/inventory/purchase-requests/:id` | `purchase-requests-approval.service` |
| ✅ | `purchase_request.rejected` | PR reject | `/inventory/purchase-requests/:id` | `purchase-requests.service` |
| ✅ | `purchase_order.submitted` | PO submit (DRAFT → PENDING_APPROVAL) | `/inventory/purchase-orders/:id` | `purchase-orders.service` |
| ✅ | `purchase_order.approved` | PO approve | `/inventory/purchase-orders/:id` | `purchase-orders.service` |
| ✅ | `purchase_order.sent` | Stock Keeper kirim PO (→ SENT) | `/inventory/purchase-orders/:id` | `purchase-orders.service` |
| ✅ | `purchase_order.ordered` | Purchasing konfirmasi order (→ ORDERED) | `/inventory/purchase-orders/:id` | `purchase-orders.service` |
| ✅ | `purchase_order.cancelled` | PO dibatalkan | `/inventory/purchase-orders/:id` | `purchase-orders.service` |
| ✅ | `goods_receipt.confirmed` | GR confirm | `/inventory/goods-receipts/:id` | `goods-receipts.service` |
| ✅ | `goods_processing.confirmed` | GP finalize confirm | `/inventory/goods-processing/:id` | `goods-processing.service` |
| ✅ | `goods_processing.rejected` | GP reject | `/inventory/goods-processing/:id` | `goods-processing.service` |
| ✅ | `purchase_invoice.submitted` | PI submit | `/inventory/purchase-invoices/:id` | `purchase-invoices.service` |
| ✅ | `purchase_invoice.approved` | PI approve | `/inventory/purchase-invoices/:id` | `purchase-invoices.service` |
| ✅ | `purchase_invoice.rejected` | PI reject | `/inventory/purchase-invoices/:id` | `purchase-invoices.service` |
| ✅ | `purchase_invoice.posted` | PI post (jurnal) | `/inventory/purchase-invoices/:id` | `purchase-invoices.service` |
| ✅ | `pricelist.approved` | Pricelist status → APPROVED | `/pricelists` | `pricelists.service` |

## Accounting

| Status | Event key | Dipicu saat | Halaman frontend | Service |
|--------|-----------|-------------|------------------|---------|
| ✅ | `journal.submitted` | Jurnal submit | `/accounting/journals/:id` | `journal-headers.service` |
| ✅ | `journal.approved` | Jurnal approve | `/accounting/journals/:id` | `journal-headers.service` |
| ✅ | `journal.rejected` | Jurnal reject | `/accounting/journals/:id` | `journal-headers.service` |
| ✅ | `journal.posted` | Jurnal post | `/accounting/journals/:id` | `journal-headers.service` |

## Planned (belum di-wire)

| Event key (usulan) | Modul | Catatan |
|--------------------|-------|---------|
| `marketplace_po.received` | Marketplace PO | Setelah receive / journal |
| `pos_import.confirmed` | POS import | Setelah confirm import |
| `bank_reconciliation.review` | Rekonsiliasi | Manual review approve/reject |
| `cash_count.deposit_confirmed` | Cash count | Deposit confirm |
| `production_order.*` | Food production | MO submit/complete — jika ada approval |
| `transfer_request.*` | Stok antar gudang | Jika modul aktif |

---

## Penerima tambahan (otomatis, di luar posisi)

Beberapa event juga mengirim ke **pembuat/submitter** via `additionalRecipientIds`:

- `purchase_request.approved` / `rejected` → pembuat PR
- `purchase_invoice.approved` / `rejected` → submitter/pembuat PI
- `journal.approved` / `rejected` → `submitted_by`
- `purchase_order.cancelled` → `created_by`

---

## Cara cek modul yang belum punya notifikasi

```bash
# Cari alur submit/approve tanpa dispatcher
rg "async (submit|approve|reject|confirm|post)" backend/src/modules --glob "*.service.ts"
rg "notificationDispatcher" backend/src/modules -l
```

Modul di hasil pertama yang tidak ada di hasil kedua = kandidat event baru.
