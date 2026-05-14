# Goods Processing — Per-Line Status Refactor

> **Addon** untuk `GOODS_PROCESSING_DESIGN.md`
> Perubahan: status tracking pindah dari header-level ke input-line-level.

---

## Masalah dengan Design Saat Ini

1. **Harus tunggu semua item selesai** — kalau 1 dari 5 item belum datang/belum diproses, seluruh GP tertahan
2. **Tidak bisa partial confirm** — QC harus confirm semua sekaligus
3. **Barang non-disassembly tertahan** — beras yang sudah siap harus tunggu salmon selesai dipotong

---

## Solusi: Status Per Input Line

Tambah kolom `status` di `goods_processing_inputs`. Setiap produk bisa diproses dan di-confirm independen.

### Status Flow Per Line

```
PENDING → PROCESSING → QC_REVIEW → CONFIRMED
                           ↘ REJECTED → (revisi → QC_REVIEW)
```

### GP Header Status = Derived

| Kondisi | Header Status |
|---------|---------------|
| Semua line PENDING | DRAFT |
| Semua line CONFIRMED | CONFIRMED |
| Semua line REJECTED | REJECTED |
| Ada line CONFIRMED + ada yang belum | PARTIAL |
| Sisanya (PROCESSING/QC_REVIEW tanpa CONFIRMED) | PROCESSING |

---

## Database Changes

### ALTER `goods_processing_inputs`

```sql
ALTER TABLE goods_processing_inputs
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'QC_REVIEW', 'CONFIRMED', 'REJECTED')),
  ADD COLUMN processed_by UUID,
  ADD COLUMN processed_at TIMESTAMPTZ,
  ADD COLUMN qc_confirmed_by UUID,
  ADD COLUMN qc_confirmed_at TIMESTAMPTZ,
  ADD COLUMN rejected_by UUID,
  ADD COLUMN rejected_at TIMESTAMPTZ,
  ADD COLUMN rejection_reason TEXT;
```

### ALTER `goods_processing` (header)

```sql
-- Tambah status PARTIAL
ALTER TABLE goods_processing DROP CONSTRAINT IF EXISTS goods_processing_status_check;
ALTER TABLE goods_processing ADD CONSTRAINT goods_processing_status_check
  CHECK (status IN ('DRAFT', 'PROCESSING', 'PARTIAL', 'CONFIRMED', 'REJECTED'));
```

---

## API Changes

### Endpoints Baru (Per Line)

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/goods-processing/lines/:lineId/start` | PENDING → PROCESSING (per line) |
| POST | `/goods-processing/lines/:lineId/submit-qc` | PROCESSING → QC_REVIEW (per line) |
| POST | `/goods-processing/lines/:lineId/confirm` | QC_REVIEW → CONFIRMED (+ stock movement per line) |
| POST | `/goods-processing/lines/:lineId/reject` | QC_REVIEW → REJECTED (per line) |

### Endpoints Tetap (Bulk)

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/goods-processing/bulk-confirm` | Bulk confirm multiple lines sekaligus (pass-through) |
| GET | `/goods-processing` | List GP headers (status = derived) |
| GET | `/goods-processing/:id` | Detail GP + semua lines + status per line |

### Endpoint Baru (Flat List)

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/goods-processing/lines` | Flat list semua input lines (untuk list page per-produk) |

---

## Frontend — List Page Redesign

### Sebelum (Group by GP)
```
GP-JAK-001-20260513-001 [DRAFT]
  - Ajinomoto 2 Pack
  - Black Tea 3 Pack
  - Avocado Powder 1 Pack
```

### Sesudah (Group by GP, expand/collapse, per-line status)
```
┌─────────────────────────────────────────────────────────────────┐
│ Barang Masuk                                                     │
├─────────────────────────────────────────────────────────────────┤
│ Filter: [Semua Status ▼] [Hari ini ▼]                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ▼ GP-JAK-001-20260513-001 · Wahana Inti · 13 Mei                │
│   GR: GR-JAK-001-20260513-004 · 3 item                          │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │ ✓ Ajinomoto          2 Pack    Pass-through    CONFIRMED   │ │
│   │ ⏳ Black Tea          3 Pack    Pass-through    PENDING     │ │
│   │ 🔄 Avocado Powder    1 Pack    Pass-through    QC_REVIEW   │ │
│   └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ▶ GP-JAK-001-20260513-002 · Aneka Pangan · 13 Mei [2/3 done]   │
│                                                                  │
│ ▼ GP-BOG-001-20260512-001 · Shopee · 12 Mei                     │
│   GR: GR-BOG-001-20260512-003 · 4 item                          │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │ [✓] Salmon Utuh      50 Kg    Disassembly     PROCESSING  │ │
│   │     → Fillet 35kg + Head 8kg + Waste 7kg                   │ │
│   │ [✓] Beras Sushi      200 Kg   Pass-through    PENDING     │ │
│   │ [✓] Kecap Manis      10 Ltr   Pass-through    PENDING     │ │
│   │ [✓] Minyak Goreng    20 Ltr   Pass-through    PENDING     │ │
│   │                                                             │
│   │              [Confirm 3 Pass-through]                       │ │
│   └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Fitur UI:
- **Expand/Collapse** per GP group (default: expanded untuk yang ada item pending)
- **Checkbox** per line untuk bulk confirm (pass-through only)
- **Status badge** per line (warna berbeda)
- **Progress indicator** di collapsed header: "2/3 done"
- **Inline action** per line: klik → buka detail/edit output
- **Bulk confirm button** muncul kalau ada checkbox tercentang

---

## Frontend — Detail Page Changes

Tetap sama seperti sekarang, tapi:
- Setiap input section punya **tombol aksi sendiri** (Start / Submit QC / Confirm)
- Line yang sudah CONFIRMED → read-only, tidak bisa diedit
- Line yang REJECTED → bisa edit output, submit ulang

```
┌─────────────────────────────────────────────────────────────────┐
│ GP-JAK-001-20260513-002                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ── Salmon Utuh (50 kg) ── Status: PROCESSING ──────────────────  │
│ Output:                                                          │
│   Salmon Fillet 35 kg · Salmon Head 8 kg · Waste 7 kg            │
│                                    [Submit ke QC]                │
│                                                                  │
│ ── Beras Sushi (200 kg) ── Status: CONFIRMED ✓ ────────────────  │
│ Output: Beras Sushi 200 kg (pass-through)                        │
│ Dikonfirmasi oleh: Susi · 13 Mei 14:30                           │
│                                                                  │
│ ── Kecap Manis (10 ltr) ── Status: PENDING ────────────────────  │
│ Output: Kecap Manis 10 ltr (pass-through)                        │
│                              [Mulai Proses]  [Submit ke QC]      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Service Logic Changes

### Confirm Per Line

```typescript
async confirmLine(gpId: string, lineId: string, companyId: string, userId: string) {
  const detail = await repo.findDetail(gpId, companyId)
  const line = detail.inputs.find(i => i.id === lineId)
  if (!line) throw NotFoundError
  if (line.status !== 'QC_REVIEW') throw InvalidStatusError

  // Validate outputs
  // ...

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Stock movement for this line's outputs only
    for (const out of line.outputs.filter(o => !o.is_waste)) {
      // create stock movement...
    }

    // Update line status
    await client.query(
      `UPDATE goods_processing_inputs SET status = 'CONFIRMED', qc_confirmed_by = $1, qc_confirmed_at = now() WHERE id = $2`,
      [userId, lineId]
    )

    // Recalculate header status
    await this.recalculateHeaderStatus(client, gpId)

    await client.query('COMMIT')
  } catch (e) { await client.query('ROLLBACK'); throw e }
  finally { client.release() }
}

async recalculateHeaderStatus(client: PoolClient, gpId: string) {
  const { rows } = await client.query(
    'SELECT status FROM goods_processing_inputs WHERE goods_processing_id = $1',
    [gpId]
  )
  const statuses = rows.map(r => r.status)

  let headerStatus: string
  if (statuses.every(s => s === 'CONFIRMED'))       headerStatus = 'CONFIRMED'
  else if (statuses.every(s => s === 'PENDING'))     headerStatus = 'DRAFT'
  else if (statuses.every(s => s === 'REJECTED'))    headerStatus = 'REJECTED'
  else if (statuses.some(s => s === 'CONFIRMED'))    headerStatus = 'PARTIAL'
  else                                              headerStatus = 'PROCESSING'

  await client.query('UPDATE goods_processing SET status = $1, updated_at = now() WHERE id = $2', [headerStatus, gpId])
}
```

---

## Stock Movement

Sama seperti sebelumnya, tapi **per line** bukan per GP:
- Saat line di-confirm → stock movement untuk outputs line itu saja
- Line lain yang belum confirm → belum masuk stock
- Ini memungkinkan beras masuk gudang hari ini, salmon masuk besok setelah potong

---

## Yield Summary

Header yield summary di-update setiap kali ada line yang confirmed:
```sql
UPDATE goods_processing SET
  total_input_qty = (SELECT SUM(qty_input) FROM goods_processing_inputs WHERE goods_processing_id = $1 AND status = 'CONFIRMED'),
  total_output_qty = (SELECT SUM(gpo.qty_output) FROM goods_processing_outputs gpo JOIN goods_processing_inputs gpi ON gpi.id = gpo.input_id WHERE gpi.goods_processing_id = $1 AND gpi.status = 'CONFIRMED' AND gpo.is_waste = false),
  total_waste_qty = (SELECT SUM(gpo.qty_output) FROM goods_processing_outputs gpo JOIN goods_processing_inputs gpi ON gpi.id = gpo.input_id WHERE gpi.goods_processing_id = $1 AND gpi.status = 'CONFIRMED' AND gpo.is_waste = true)
WHERE id = $1
```

---

## Migration Plan

| Step | Apa |
|------|-----|
| 1 | ALTER TABLE: tambah kolom di `goods_processing_inputs` |
| 2 | ALTER TABLE: tambah status 'PARTIAL' di `goods_processing` |
| 3 | Migrate existing data: set semua input lines status = header status |
| 4 | Update repository: query per-line status |
| 5 | Update service: per-line confirm/reject + header recalculate |
| 6 | Update controller + routes: new per-line endpoints |
| 7 | Update frontend list page: expand/collapse + per-line status |
| 8 | Update frontend detail page: per-line actions |

---

## Edge Cases

| Case | Handling |
|------|----------|
| 1 line confirmed, 2 pending → header? | PARTIAL |
| Semua line rejected → header? | REJECTED |
| Mix: 1 confirmed + 1 rejected + 1 pending | PARTIAL |
| All PROCESSING (no confirmed yet) | PROCESSING |
| Mix: PROCESSING + QC_REVIEW (no confirmed) | PROCESSING |
| User confirm pass-through tanpa edit | OK — output = input, langsung confirm |
| User edit output setelah line confirmed | Block — confirmed line read-only |
| GP header di-reject (legacy flow) | Deprecated — reject per line saja |
| Purchase Invoice cek GP confirmed | Cek per-line: semua `goods_processing_inputs` yang terkait GR lines di invoice harus `CONFIRMED`. Boundary: per GR line → per GP input (1:1 via `gr_line_id`). |
| Confirmed line reversal | Out of scope — confirmed line tidak bisa di-reverse. Jika ada dispute, buat stock adjustment terpisah. |

---

## Backward Compatibility

- Existing GP records: migrate status ke semua input lines
- Bulk confirm tetap ada — untuk pass-through lines
- Header status tetap ada — derived dari line statuses
- API `/goods-processing/:id` tetap return full detail (+ line statuses)

---

## Keuntungan

1. **Tidak perlu tunggu** — beras bisa masuk gudang hari ini, salmon besok
2. **Partial receive** — kalau 1 item belum datang, yang lain tetap jalan
3. **QC lebih fleksibel** — bisa confirm per item, tidak harus batch
4. **Tracking lebih granular** — tahu persis item mana yang tertahan dan kenapa
5. **UX lebih baik** — list page langsung lihat status per produk

---

## Related Docs

- Main design: `.amazonq/docs/GOODS_PROCESSING_DESIGN.md`
- Purchase Invoice: `.amazonq/docs/PURCHASE_INVOICE_DESIGN.md`
