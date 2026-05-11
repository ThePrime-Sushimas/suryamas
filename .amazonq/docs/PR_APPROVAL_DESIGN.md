# Purchase Request → Purchase Order Flow — Design Document (Final)

## 🎯 Tujuan

**1 halaman approval terpisah** (`/purchase-requests/:id/approve`) yang melakukan semua dalam 1 flow:

1. Review stock balance + price per item
2. Items grouped by supplier
3. Checklist items yang mau di-order
4. Set payment type & terms per supplier
5. Set expected delivery date
6. Generate multiple PO (1 per supplier)
7. Send WhatsApp ke supplier

**Status:** `PENDING_APPROVAL` → `CONVERTED` langsung (skip APPROVED)

**ATURAN:** Halaman ini TERPISAH dari PurchaseRequestDetailPage. Punya menu sendiri di sidebar.

---

## 📊 Status Flow

```
PENDING_APPROVAL → CONVERTED (+ multiple PO dibuat)
               ↘ REJECTED
               ↘ CANCELLED
```

| Status | Siapa | Halaman |
|--------|-------|---------|
| PENDING_APPROVAL | Tim Cabang buat PR | `/inventory/purchase-requests` |
| CONVERTED | Tim Office approve + generate PO | `/inventory/pr-approval` → `/:id/approve` |
| REJECTED | Tim Office reject | `/inventory/pr-approval` → `/:id/approve` |

---

## 🖥️ Menu Sidebar

```
Inventory
├── Gudang
├── Stok Gudang
├── Mutasi Stok
├── Purchase Request        ← Tim Cabang (buat PR)
├── PR Approval             ← Tim Office (review + approve + generate PO)
├── Purchase Order
└── Penerimaan Barang
```

---

## 📊 Database Schema

### Tidak Perlu Tabel Baru

- Grouping per supplier: on-the-fly dari `purchase_request_lines.supplier_id`
- Stock balance: dari `stock_balances` (existing)
- Price: dari `pricelists` (existing)
- PO langsung dibuat ke `purchase_orders`

---

## 🔐 Permission

| Aksi | Permission | Tim |
|------|-----------|-----|
| View/Create PR | `purchase_requests:view/insert` | Tim Cabang |
| Approve + Generate PO / Reject | `purchase_requests:approve` | Tim Office |
| View PO | `purchase_orders:view` | Semua |

---

## 📄 Halaman: PR Approval

### List Page

**Route:** `/inventory/pr-approval`
**Permission:** `purchase_requests:approve`

Menampilkan **hanya** PR dengan status `PENDING_APPROVAL`. Setiap row ada tombol "Review" → navigate ke `/:id/approve`.

### Detail Page (Approval + Generate PO)

**Route:** `/inventory/purchase-requests/:id/approve`
**Permission:** `purchase_requests:approve`
**Pre-condition:** PR status = PENDING_APPROVAL

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Kembali                                                        │
│                                                                  │
│ 🛡️ Review & Approve Purchase Request                            │
│ PR-SRP-20260511-001 | Serpong | 11 Mei 2026                     │
├─────────────────────────────────────────────────────────────────┤
│ Warehouse: Gudang 1 - Serpong | Dibutuhkan: 15 Mei 2026         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [✓] 📦 Supplier A  ☎️ 0812-xxx     Total: Rp 1.080.000     │ │
│ │ ┌───────────────────────────────────────────────────────────┤ │
│ │ │ [✓] Black Tea                                            │ │
│ │ │     Qty: 10 pcs | Stock: 5 ⚠️ | Harga: Rp 48.000        │ │
│ │ ├───────────────────────────────────────────────────────────┤ │
│ │ │ [✓] Avocado Powder                                       │ │
│ │ │     Qty: 20 kg | Stock: 0 🔴 | Harga: Rp 30.000         │ │
│ │ └───────────────────────────────────────────────────────────┤ │
│ │ Payment: [CREDIT ▼] | Terms: [30] hari | Delivery: [date]  │ │
│ │ Notes: [                                    ]               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⚠️ Tanpa Supplier (1 item) — tidak akan dibuatkan PO        │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ [✓ Send WhatsApp ke Supplier]                                  │
│                                                                  │
│ [Reject PR]                    [Approve & Generate PO]          │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Stock Warning: ✓ hijau (cukup), ⚠️ kuning (kurang), 🔴 merah (habis)
- Price: latest dari pricelist, fallback ke estimated_price dari PR
- Checkbox per supplier & per item
- Payment & delivery setting per supplier
- WhatsApp toggle global
- Reject: modal dengan alasan wajib

---

## 🔌 Backend Endpoints

| Method | Path | Permission | Pre-condition | Fungsi |
|--------|------|-----------|---------------|--------|
| GET | `/:id/approval-data` | `purchase_requests:approve` | status = PENDING_APPROVAL | Data grouped (stock + price) |
| POST | `/:id/approve-and-generate` | `purchase_requests:approve` | status = PENDING_APPROVAL | Approve + generate PO + send WA |
| POST | `/:id/reject` | `purchase_requests:approve` | status = PENDING_APPROVAL | Reject + alasan (existing) |

### GET `/:id/approval-data` Response

```json
{
  "success": true,
  "data": {
    "pr": { /* PurchaseRequestWithLines */ },
    "warehouse_id": "uuid",
    "warehouse_name": "Gudang 1 - Serpong",
    "supplier_groups": [
      {
        "supplier_id": "uuid",
        "supplier_name": "Supplier A",
        "supplier_phone": "628123456789",
        "items": [
          {
            "pr_line_id": "uuid",
            "product_id": "uuid",
            "product_code": "P001",
            "product_name": "Black Tea",
            "qty": 10,
            "uom": "pcs",
            "estimated_price": 50000,
            "latest_price": 48000,
            "stock_balance": 5,
            "stock_warehouse_name": "Gudang 1 - Serpong"
          }
        ],
        "total_estimated": 480000
      }
    ]
  }
}
```

### POST `/:id/approve-and-generate` Request

```json
{
  "supplier_selections": [
    {
      "supplier_id": "uuid",
      "line_ids": ["uuid-1", "uuid-2"],
      "payment_type": "CREDIT",
      "payment_terms_days": 30,
      "expected_delivery_date": "2026-05-15",
      "notes": "Urgent"
    }
  ],
  "send_whatsapp": true
}
```

### POST `/:id/approve-and-generate` Response

```json
{
  "success": true,
  "data": {
    "pr_id": "uuid",
    "po_ids": ["uuid-po-1", "uuid-po-2"],
    "whatsapp_sent": ["628123456789"],
    "whatsapp_failed": []
  },
  "message": "2 PO berhasil dibuat"
}
```

### Backend Logic (Transaction)

```
1. Lock PR row (FOR UPDATE)
2. Validate status = PENDING_APPROVAL
3. For each supplier_selection:
   a. Generate PO number
   b. Create PO header
   c. Insert PO lines (link ke PR lines)
   d. Send WhatsApp (non-blocking)
4. Update PR status → CONVERTED
5. Set approved_by, approved_at
6. Commit
7. Audit log
```

---

## 📱 WhatsApp Integration

### Provider: Fonnte API
- Endpoint: `POST https://api.fonnte.com/send`
- Auth: `Authorization: {FONNTE_TOKEN}`
- Env var: `FONNTE_TOKEN` di `.env`

### Message Template
```
🛒 *Purchase Order Baru*

Kepada: {supplier_name}
PO Number: {po_number}
Tanggal: {order_date}
Dibutuhkan: {expected_delivery_date}

*Items:*
- {product_name}: {qty} {uom} @ Rp {unit_price}
...

*Total Estimasi:* Rp {total_amount}

Mohon konfirmasi ketersediaan barang.

Terima kasih,
{branch_name}
```

### Rules
- Non-blocking — gagal kirim WA tidak rollback PO
- Hanya kirim ke supplier yang punya phone number
- Log error jika gagal

---

## 🚨 Edge Cases

| Case | Handling |
|------|----------|
| PR tanpa supplier di semua lines | Warning, tidak bisa generate PO |
| Supplier tidak punya phone | Skip WhatsApp, tetap buat PO |
| WhatsApp API error | Log error, PO tetap tersimpan |
| User uncheck semua items | Disable button "Approve & Generate PO" |
| Stock balance tidak ada | Tampilkan "0" dengan warning merah |
| Latest price tidak ada | Gunakan estimated_price dari PR |
| PR sudah CONVERTED | Tidak muncul di list, redirect jika akses langsung |
| Multiple user approve bersamaan | FOR UPDATE lock, second request fail |

---

## 📊 Audit Trail

```typescript
await AuditService.log('APPROVE_AND_GENERATE', 'purchase_request', prId, userId,
  { status: 'PENDING_APPROVAL' },
  { status: 'CONVERTED', po_ids: poIds }
)
```

---

## 🔄 Rollback Strategy

**Generate PO gagal:**
1. Transaction rollback otomatis
2. PR tetap PENDING_APPROVAL
3. User bisa retry

**WhatsApp gagal tapi PO sudah dibuat:**
1. PO tetap tersimpan
2. Log error WhatsApp
3. User bisa manual resend (future feature)

---

## 📚 Related Docs

- PO Flow Decision: `.amazonq/docs/PO_FLOW_DECISION.md`
- Inventory System: `.amazonq/docs/INVENTORY_SYSTEM_V2_PLAN.md`
- Purchase Request: `backend/src/modules/purchase-requests/`
- Purchase Order: `backend/src/modules/purchase-orders/`
