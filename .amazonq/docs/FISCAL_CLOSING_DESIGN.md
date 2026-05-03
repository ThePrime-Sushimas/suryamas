# Fiscal Period Closing — Design Document v2

> **Revisi dari v1:** Closing journal langsung POSTED (no approval flow) + permission guard via `canRelease('fiscal_periods')` + pending journals jadi warning bukan blocker + default RE account ke 310202 + endpoint lama deprecated.

---

## 🎯 Tujuan

Menambahkan fitur **Tutup Buku (Fiscal Closing)** pada modul Fiscal Periods yang sudah ada. Saat periode ditutup, sistem otomatis:

1. Generate **closing journal entries** (tutup akun Pendapatan & Beban)
2. Transfer saldo ke **Retained Earnings** (default: `310202 - RE current period`)
3. **Lock periode** — tidak boleh ada jurnal baru di periode yang sudah closed
4. Update status fiscal period ke `is_open = false`

---

## 🔐 Permission Design

### Siapa yang boleh close periode?

| Aksi | Permission yang Dibutuhkan | Middleware |
|------|---------------------------|------------|
| Lihat closing preview | `can_view` | `canView('fiscal_periods')` |
| Eksekusi close periode | `can_release` | `canRelease('fiscal_periods')` |

**Alasan pakai `can_release` (bukan `can_approve`):**
- `can_approve` dipakai untuk aksi intermediate (misal approve jurnal biasa)
- `can_release` adalah aksi final yang tidak bisa di-undo — semantiknya tepat untuk closing

**Current role matrix untuk `fiscal_periods`:**

| Role | can_view | can_release |
|------|----------|-------------|
| Super Admin | ✅ | ✅ |
| admin | ❌ | ❌ |
| manager | ❌ | ❌ |
| Supervisor | ❌ | ❌ |
| Staff | ❌ | ❌ |

> Untuk production nanti, tinggal update `perm_role_permissions` via UI Permission Management — tidak perlu ubah kode.

### Kenapa closing journal langsung POSTED (tidak perlu approval flow)?

Closing journal adalah **system-generated**, bukan user-input. Angkanya 100% derived dari jurnal-jurnal yang sudah POSTED di periode tersebut — tidak ada discretionary input dari user. Kalau semua source journal sudah posted, hasil closing sudah pasti benar secara matematis.

Kalau pakai approval flow:
- SUBMIT → user lihat apa? Preview yang sudah ditampilkan sebelum konfirmasi. Redundant.
- APPROVE → siapa yang approve, dan atas dasar apa? Tidak ada judgment yang perlu dibuat.
- Ada **race condition**: periode masih open saat closing journal SUBMITTED, sehingga user lain bisa masih input jurnal baru.

**Safeguard sebagai pengganti approval flow:**
- Preview wajib tampil sebelum konfirmasi (closing summary + warning)
- `source_module = 'FISCAL_CLOSING'` — closing journal tidak bisa diedit/dihapus manual
- Periode di-lock **atomically** bersamaan dengan create journal (dalam 1 DB transaction)
- Full audit trail via `AuditService.log()`
- Hanya user dengan `can_release` yang bisa trigger

---

## 📋 Flow User (Step by Step)

1. User buka **Fiscal Periods** (`/accounting/fiscal-periods`)
2. Tombol **"Tutup Periode"** hanya muncul/aktif jika user punya `can_release` permission
3. User klik tombol → Modal muncul dengan **dua tahap**:

### Tahap 1 — Preview (GET closing-preview)
Modal menampilkan:
- **Ringkasan finansial**: Total Revenue, Total Expense, Net Income/Loss
- **Tabel per akun** (collapsible): account_code, account_name, net debit, net credit
- **Warning pending journals** (jika ada): `"⚠️ Terdapat X jurnal belum diposting (DRAFT/SUBMITTED/APPROVED). Jurnal tersebut tidak akan masuk dalam closing entry. Lanjutkan?"` — ini **warning, bukan blocker**
- **Dropdown Retained Earnings account** (default: 310202, user bisa ganti)
- **Input alasan tutup** (optional)

### Tahap 2 — Konfirmasi & Eksekusi (POST close-with-entries)
- User klik **"Konfirmasi Tutup Periode"**
- Backend execute dalam 1 DB transaction:
  1. Validasi hard-block (periode masih open, RE account valid)
  2. Hitung saldo Revenue & Expense dari `general_ledger_view` (hanya POSTED journal)
  3. Generate closing journal → langsung POSTED
  4. Set `fiscal_periods.is_open = false`, isi `closed_at`, `closed_by`, `close_reason`
- Response: sukses + `closing_journal_id` + link ke detail jurnal

---

## ✅ Validasi

### Hard Block (menghentikan closing)

| # | Kondisi | Error |
|---|---------|-------|
| 1 | `fiscal_periods.is_open = false` | `PERIOD_ALREADY_CLOSED` |
| 2 | RE account tidak valid / bukan tipe EQUITY | `INVALID_RETAINED_EARNINGS_ACCOUNT` |
| 3 | Tidak ada jurnal POSTED di periode | `NO_TRANSACTIONS_IN_PERIOD` |

### Warning (tampil di preview, tidak menghentikan)

| # | Kondisi | Pesan |
|---|---------|-------|
| 1 | Ada jurnal DRAFT/SUBMITTED/APPROVED | "⚠️ X jurnal belum diposting tidak akan masuk closing" |

> **Catatan:** Jurnal pending tetap ada setelah closing. Mereka tidak bisa diposting ke periode yang sudah closed — akan error `PERIOD_CLOSED` saat dicoba post. User perlu reject/delete manual, atau kita bisa tambahkan fitur bulk-reject-pending nanti sebagai enhancement.

---

## 💡 Closing Journal Logic

```
Untuk setiap akun REVENUE:
  net = total_credit - total_debit (normal balance = credit)
  → jika net > 0 (normal): Debit akun tersebut sebesar net (nol-kan)
  → jika net < 0 (abnormal, misal Discount > Revenue): Credit akun tersebut sebesar abs(net)

Untuk setiap akun EXPENSE:
  net = total_debit - total_credit (normal balance = debit)
  → jika net > 0 (normal): Credit akun tersebut sebesar net (nol-kan)
  → jika net < 0 (abnormal): Debit akun tersebut sebesar abs(net)

Net Income = total Revenue net - total Expense net
  → Jika laba (net_income > 0): Credit ke Retained Earnings
  → Jika rugi (net_income < 0): Debit ke Retained Earnings sebesar abs(net_income)
```

### Contoh Jurnal Closing (April 2026)

Asumsi:
- Total Revenue: Rp 76.936.251 (net credit)
- Total Expense: Rp 4.003.907 (net debit)
- Net Income: Rp 72.932.344

```
Journal: JG-2026-04-XXXX
Description: "Closing Entry - April 2026"
Type: GENERAL | Source: FISCAL_CLOSING | Status: POSTED (langsung)
branch_id: NULL (company-level)

Debit  410101  Sales - Food             76.936.251
Credit 410301  Bill Discount                 7.480   ← Discount punya net debit (abnormal untuk REVENUE)
Credit 410304  Material Sales Discount          20
Credit 610102  MDR Expenses              4.003.907
Debit  610801  Rounding Expense                 20   ← Expense punya net credit (abnormal untuk EXPENSE)
Credit 310202  RE current period        72.932.344   ← penyeimbang (laba)
─────────────────────────────────────────────────────
TOTAL DEBIT  = 76.936.271 ✅
TOTAL CREDIT = 76.936.271 ✅
```

---

## 🗄️ Database Changes

### Tidak ada migrasi baru
- `fiscal_periods`: semua kolom sudah ada (`is_open`, `closed_at`, `closed_by`, `close_reason`)
- `journal_headers`: `source_module` adalah varchar — `'FISCAL_CLOSING'` langsung bisa dipakai
- `journal_type GENERAL`: sudah ada di enum
- Permission system: `can_release` sudah ada di `perm_role_permissions`

---

## 📁 File yang Terdampak

### Backend — Modified (7 files)

| File | Perubahan |
|------|-----------|
| `fiscal-periods.errors.ts` | Tambah: `PENDING_JOURNALS_EXIST` (warning only, tidak digunakan sebagai throw), `INVALID_RETAINED_EARNINGS_ACCOUNT`, `NO_TRANSACTIONS_IN_PERIOD` |
| `fiscal-periods.types.ts` | Tambah: `ClosePeriodWithEntriesDto`, `PeriodClosingSummary`, `ClosingAccountLine` |
| `fiscal-periods.schema.ts` | Tambah: `closePeriodWithEntriesSchema` (retained_earnings_account_id, close_reason?) |
| `fiscal-periods.repository.ts` | Tambah: `getRevenueExpenseSummary(companyId, period)` — query dari `general_ledger_view` |
| `fiscal-periods.service.ts` | Tambah: `getClosingPreview()`, `closePeriodWithEntries()` — orchestrate validasi + journal generation + lock periode dalam 1 transaction |
| `fiscal-periods.controller.ts` | Tambah: handler `getClosingPreview`, `closePeriodWithEntries` |
| `fiscal-periods.routes.ts` | Tambah: `GET /:id/closing-preview` (canView), `POST /:id/close-with-entries` (canRelease) + **deprecate** `POST /:id/close` |

### Backend — Read-Only Reference (tidak diubah)

| File | Dipakai untuk |
|------|---------------|
| `journal-headers.repository.ts` | Create closing journal (reuse existing `create` method) |
| `chart-of-accounts.repository.ts` | Validasi RE account type = EQUITY |
| `general_ledger_view` (DB view) | Query saldo Revenue & Expense |

### Frontend — Modified (5 files)

| File | Perubahan |
|------|-----------|
| `ClosePeriodModal.tsx` | **Rewrite** — tambah dua tahap (preview + konfirmasi), tampil summary revenue/expense/net, warning pending journals, RE account dropdown, permission guard |
| `fiscalPeriods.api.ts` | Tambah: `getClosingPreview(id)`, `closePeriodWithEntries(id, dto)`. **Deprecate** `closePeriod(id)` |
| `fiscalPeriods.store.ts` | Tambah action: `getClosingPreview`, `closePeriodWithEntries` |
| `fiscal-period.types.ts` | Tambah: `PeriodClosingSummary`, `ClosingAccountLine`, `ClosePeriodWithEntriesDto` |
| `FiscalPeriodsListPage.tsx` | Tombol "Tutup Periode" hanya render jika user punya `can_release`. Tambah link ke closing journal setelah sukses |

### Frontend — New Files: Tidak ada (reuse existing components)

---

## 🔄 API Endpoints

### 1. `GET /api/fiscal-periods/:id/closing-preview`
**Permission:** `canView('fiscal_periods')`

Preview sebelum closing — hitung saldo Revenue & Expense dari jurnal POSTED saja.

**Response:**
```json
{
  "period": "2026-04",
  "period_start": "2026-04-01",
  "period_end": "2026-04-30",
  "total_revenue": 76936251,
  "total_expense": 4003907.20,
  "net_income": 72932343.80,
  "is_profit": true,
  "accounts": [
    {
      "account_id": "uuid",
      "account_code": "410101",
      "account_name": "Sales - Food",
      "account_type": "REVENUE",
      "net_debit": 0,
      "net_credit": 76936251,
      "closing_debit": 76936251,
      "closing_credit": 0
    }
  ],
  "pending_journals_count": 2,
  "posted_journals_count": 15,
  "default_retained_earnings_account_id": "uuid-of-310202"
}
```

### 2. ~~`POST /api/fiscal-periods/:id/close`~~ — **DEPRECATED**
> Endpoint lama tetap ada di routes tapi akan dikembalikan HTTP 410 Gone dengan pesan "Gunakan endpoint `/close-with-entries`". Hapus total setelah dipastikan tidak ada consumer lain.

### 3. `POST /api/fiscal-periods/:id/close-with-entries`
**Permission:** `canRelease('fiscal_periods')`

Execute closing — atomically dalam 1 DB transaction.

**Request:**
```json
{
  "retained_earnings_account_id": "uuid-of-310202",
  "close_reason": "Tutup buku April 2026"
}
```

**Response:**
```json
{
  "period": { "id": "uuid", "period": "2026-04", "is_open": false },
  "closing_journal_id": "uuid",
  "closing_journal_number": "JG-2026-04-0005",
  "net_income": 72932343.80,
  "is_profit": true,
  "lines_count": 6
}
```

---

## ⚠️ Critical Notes

1. **Closing journal langsung POSTED** — system-generated, tidak perlu approval flow. Safeguard: permission `can_release`, preview wajib, atomic transaction, audit log.
2. **`branch_id = NULL`** — closing entry adalah company-level, bukan per branch.
3. **`source_module = 'FISCAL_CLOSING'`** — supaya bisa diidentifikasi; di service `delete` dan `update` perlu guard: jurnal dengan source ini tidak bisa diedit/dihapus manual.
4. **Default RE account: `310202 - RE current period`** — user bisa ganti saat konfirmasi closing.
5. **Pending journals = warning, bukan blocker** — jurnal DRAFT/SUBMITTED/APPROVED yang ada saat closing tidak ikut di-close. Setelah periode locked, jurnal pending tersebut tidak bisa di-post (akan kena `PERIOD_CLOSED` error) — user harus reject/delete manual.
6. **Endpoint lama `POST /:id/close` dideprecate** — return HTTP 410, hapus total setelah tidak ada consumer.
7. **Periode yang sudah closed tidak bisa di-reopen** dari fitur ini — bisa ditambahkan nanti sebagai fitur terpisah dengan permission tersendiri.

---

## 📊 Execution Order

| Phase | Task | Scope |
|-------|------|-------|
| 1 | Backend: `errors.ts`, `types.ts`, `schema.ts` | Kecil |
| 2 | Backend: `repository.ts` — tambah `getRevenueExpenseSummary()` | Kecil |
| 3 | Backend: `service.ts` — `getClosingPreview()` + `closePeriodWithEntries()` | Medium (logic utama) |
| 4 | Backend: `controller.ts` + `routes.ts` + deprecate endpoint lama | Kecil |
| 5 | Frontend: types, api, store | Kecil |
| 6 | Frontend: `ClosePeriodModal.tsx` rewrite + `FiscalPeriodsListPage.tsx` | Medium |
| 7 | Testing: end-to-end dengan data April 2026, verifikasi balance closing journal | Kecil |
