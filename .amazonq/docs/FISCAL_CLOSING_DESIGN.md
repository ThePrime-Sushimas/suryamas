# Fiscal Period Closing — Design Document v2

> **Revisi dari v1:** Closing journal langsung POSTED (no approval flow) + permission guard via `canRelease('fiscal_periods')` + pending journals jadi warning bukan blocker + default RE account ke 310202 + endpoint lama deprecated.
> 
> **Status:** Backend Phase 1–4 ✅ DONE (clean compile). Frontend Phase 5–6 🔄 IN PROGRESS.

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

## 🖥️ Frontend Permission System

Permission user tersedia di frontend via `usePermissionStore` dari `branch_context/store/permission.store.ts`.

```typescript
// Pattern yang sudah dipakai di journal module:
// hooks/useJournalPermissions.ts
const hasPermission = usePermissionStore(state => state.hasPermission)
canPost: hasPermission('journals', 'release')

// Untuk fiscal closing — pakai pattern yang sama:
const hasPermission = usePermissionStore(state => state.hasPermission)
const canClose = hasPermission('fiscal_periods', 'release')
```

**`PermissionAction` type:**
```typescript
type PermissionAction = 'view' | 'insert' | 'update' | 'delete' | 'approve' | 'release'
```

**Di-load otomatis** oleh `PermissionProvider` saat `currentBranch.role_id` berubah, dan di-clear saat logout.

**Hook tersedia:**
- `usePermissionStore(state => state.hasPermission)` — low-level, dipakai di hooks
- `usePermission(module, action)` — shorthand hook di `branch_context/hooks/usePermission.ts`

**Catatan:** `FiscalPeriodsListPage` saat ini hardcode `canUpdate={true}` dan `canDelete={true}` ke `FiscalPeriodTable`. Ini perlu diganti dengan actual permission check sekalian saat Phase 6.

---

## 🐛 Known Issues / Backlog

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | `getRevenueExpenseSummary` tidak filter `source_module != 'FISCAL_CLOSING'` — bisa double-count kalau preview dipanggil setelah closing journal sudah ada di periode yang masih open (edge case) | Low | Backlog — tambah `AND (glv.source_module IS NULL OR glv.source_module != 'FISCAL_CLOSING')` di query |
| 2 | Jurnal pending setelah periode di-close harus di-reject/delete manual | Low | Backlog — enhancement: bulk-reject-pending-journals-in-closed-period |

---

## 📁 File yang Terdampak

### Backend — Modified (8 files) ✅ DONE



| File | Perubahan | Status |
|------|-----------|--------|
| `fiscal-periods.errors.ts` | Tambah: `InvalidRetainedEarningsAccountError`, `NoTransactionsInPeriodError`, `ClosingJournalExistsError` + factory methods | ✅ |
| `fiscal-periods.types.ts` | Tambah: `ClosePeriodWithEntriesDto`, `ClosingAccountLine`, `PeriodClosingSummary`, `ClosePeriodWithEntriesResult` | ✅ |
| `fiscal-periods.schema.ts` | Tambah: `closePeriodWithEntriesSchema`, `closingPreviewSchema` | ✅ |
| `fiscal-periods.repository.ts` | Tambah: `getRevenueExpenseSummary()`, `hasClosingJournal()`, `getDefaultRetainedEarningsAccount()` | ✅ |
| `fiscal-periods.service.ts` | Tambah: `getClosingPreview()`, `closePeriodWithEntries()` (atomic transaction) | ✅ |
| `fiscal-periods.controller.ts` | Tambah: handler `getClosingPreview`, `closePeriodWithEntries` | ✅ |
| `fiscal-periods.routes.ts` | Tambah: `GET /:id/closing-preview` (canView), `POST /:id/close-with-entries` (canRelease). Endpoint lama `POST /:id/close` tetap ada (deprecated) | ✅ |
| `journal-headers.service.ts` | Guard `forceDelete`: jurnal `source_module = 'FISCAL_CLOSING'` tidak bisa di-force delete | ✅ |

### Frontend — Read-Only Reference (tidak diubah)

| File | Dipakai untuk |
|------|---------------|
| `journal-headers.repository.ts` | Create closing journal (via raw SQL di service, bukan reuse method) |
| `chart_of_accounts` table | Validasi RE account type = EQUITY (via raw pool.query di service) |
| `general_ledger_view` (DB view) | Query saldo Revenue & Expense |

### Frontend — Modified (5 files) 🔄 IN PROGRESS

| File | Perubahan | Status |
|------|-----------|--------|
| `fiscal-period.types.ts` | Tambah: `PeriodClosingSummary`, `ClosingAccountLine`, `ClosePeriodWithEntriesDto`, `ClosePeriodWithEntriesResult` | 🔄 |
| `fiscalPeriods.api.ts` | Tambah: `getClosingPreview(id)`, `closePeriodWithEntries(id, dto)`. Deprecate (keep but unused): `close(id, dto)` | 🔄 |
| `fiscalPeriods.store.ts` | Tambah action: `getClosingPreview`, `closePeriodWithEntries`. Fix: replace `closePeriod` call | 🔄 |
| `ClosePeriodModal.tsx` | **Rewrite** — dua tahap: (1) Preview dengan summary + warning + RE dropdown, (2) Konfirmasi. Gunakan `usePermissionStore` | 🔄 |
| `FiscalPeriodsListPage.tsx` | Restore tombol "Tutup Periode" dari commented-out code. Permission guard: hanya tampil jika `hasPermission('fiscal_periods', 'release')`. Fix hardcoded `canUpdate`/`canDelete` | 🔄 |

### Frontend — New Files: Tidak ada

Pattern permission yang dipakai (konsisten dengan `useJournalPermissions.ts`):
```typescript
// Di FiscalPeriodsListPage atau hook baru useFiscalPeriodPermissions.ts
const hasPermission = usePermissionStore(state => state.hasPermission)
const canClose  = hasPermission('fiscal_periods', 'release')
const canUpdate = hasPermission('fiscal_periods', 'update')
const canDelete = hasPermission('fiscal_periods', 'delete')
```

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

| Phase | Task | Scope | Status |
|-------|------|-------|--------|
| 1 | Backend: `errors.ts`, `types.ts`, `schema.ts` | Kecil | ✅ DONE |
| 2 | Backend: `repository.ts` — `getRevenueExpenseSummary()`, `hasClosingJournal()`, `getDefaultRetainedEarningsAccount()` | Kecil | ✅ DONE |
| 3 | Backend: `service.ts` — `getClosingPreview()` + `closePeriodWithEntries()` (atomic) | Medium | ✅ DONE |
| 4 | Backend: `controller.ts` + `routes.ts` + guard `journal-headers.service.ts` | Kecil | ✅ DONE |
| 5 | Frontend: `fiscal-period.types.ts`, `fiscalPeriods.api.ts`, `fiscalPeriods.store.ts` | Kecil | 🔄 NEXT |
| 6 | Frontend: `ClosePeriodModal.tsx` rewrite + `FiscalPeriodsListPage.tsx` (permission guard) | Medium | 🔄 NEXT |
| 7 | Testing: end-to-end dengan data April 2026, verifikasi balance closing journal | Kecil | ⏳ TODO |


---

## 🔓 Phase 2: Reopen Period (Buka Kembali Periode)

### Pertanyaan Kunci

Saat close, sistem generate closing journal yang:
- Nol-kan semua Revenue & Expense
- Transfer net income ke Retained Earnings
- Jurnal langsung POSTED ke ledger

**Kalau reopen, apakah kondisi harus 100% revert ke sebelum close?**

### 3 Opsi

| Opsi | Apa yang terjadi | Pro | Kontra |
|------|-------------------|-----|--------|
| **A. Full Revert** | Delete closing journal + set `is_open = true` | Kondisi 100% sama seperti sebelum close | Kalau periode berikutnya sudah closed (chain), angka opening Mei jadi salah |
| **B. Reopen Only** | Set `is_open = true` saja, closing journal tetap ada | Simple, tidak ganggu ledger | Ada closing journal "orphan" di ledger. Kalau close lagi → double closing journal |
| **C. Full Revert + Chain Guard** | Delete closing journal + set `is_open = true` + **block jika periode berikutnya sudah closed** | Paling aman, tidak ada inkonsistensi | User harus reopen dari periode terbaru ke belakang (LIFO order) |

### Rekomendasi: Opsi C (Full Revert + Chain Guard)

**Alasan:**
- Closing journal adalah system-generated — kalau periode dibuka lagi, closing journal tidak relevan lagi dan harus dihapus
- Chain guard mencegah inkonsistensi: tidak bisa reopen April kalau Mei sudah closed (karena opening Mei bergantung pada closing April)
- User harus reopen dari yang terbaru dulu: Mei → April → Maret (LIFO)

### Flow Reopen

1. User klik **"Buka Kembali"** pada periode closed
2. Validasi:
   - User punya `can_approve('fiscal_periods')`
   - Tidak ada periode **setelahnya** yang sudah closed (chain guard)
3. Dalam 1 DB transaction:
   - Find closing journal (`source_module = 'FISCAL_CLOSING'`, `period = X`)
   - **REVERSE** closing journal (set `status = 'REVERSED'`, buat reversal journal) — lebih baik dari hard delete karena ada audit trail
   - Set `fiscal_periods.is_open = true`, clear `closed_at`, `closed_by`, `close_reason`
4. Response: sukses

### Reverse vs Delete Closing Journal

| Approach | Pro | Kontra |
|----------|-----|--------|
| **Hard Delete** | Clean, tidak ada sisa | Tidak ada audit trail. Kalau ada bug, tidak bisa trace |
| **Reverse (POSTED → REVERSED)** | Full audit trail. Jurnal asli + reversal keduanya visible | Ada 2 jurnal di ledger (saling cancel out = net 0). Sedikit lebih "noisy" |

**Rekomendasi: Reverse** — karena:
- Jurnal REVERSED sudah di-exclude dari `general_ledger_view` (hanya POSTED yang masuk)
- Audit trail lengkap: siapa close, kapan, siapa reopen, kapan
- Konsisten dengan pattern reversal jurnal yang sudah ada di sistem

### Permission

| Aksi | Permission | Middleware |
|------|-----------|------------|
| Reopen periode | `can_approve` | `canApprove('fiscal_periods')` |

**Kenapa `can_approve` (bukan `can_release`)?**
- `can_release` = aksi final (close)
- `can_approve` = aksi intermediate (reopen = membatalkan aksi final, butuh approval tapi bukan level tertinggi)
- Dalam praktik: Manager bisa reopen, tapi hanya Director yang bisa close

### API Endpoint

#### `POST /api/fiscal-periods/:id/reopen`
**Permission:** `canApprove('fiscal_periods')`

**Request:**
```json
{
  "reopen_reason": "Perlu koreksi jurnal April"
}
```

**Response:**
```json
{
  "period": { "id": "uuid", "period": "2026-04", "is_open": true },
  "reversed_journal_id": "uuid",
  "reversed_journal_number": "JG-2026-04-0005"
}
```

### Validasi

| # | Kondisi | Error |
|---|---------|-------|
| 1 | Periode harus `is_open = false` | `PERIOD_ALREADY_OPEN` |
| 2 | Tidak ada periode setelahnya yang sudah closed | `CANNOT_REOPEN_WITH_CLOSED_SUCCESSOR` |
| 3 | Closing journal harus ada dan berstatus POSTED | `CLOSING_JOURNAL_NOT_FOUND` |

### File yang Terdampak (tambahan dari Phase 1)

**Backend:**
- `fiscal-periods.errors.ts` — tambah: `PERIOD_ALREADY_OPEN`, `CANNOT_REOPEN_WITH_CLOSED_SUCCESSOR`, `CLOSING_JOURNAL_NOT_FOUND`
- `fiscal-periods.types.ts` — tambah: `ReopenPeriodDto`, `ReopenPeriodResult`
- `fiscal-periods.schema.ts` — tambah: `reopenPeriodSchema`
- `fiscal-periods.repository.ts` — tambah: `hasClosedSuccessor()`, `findClosingJournal()`
- `fiscal-periods.service.ts` — tambah: `reopenPeriod()`
- `fiscal-periods.controller.ts` — tambah: handler `reopenPeriod`
- `fiscal-periods.routes.ts` — tambah: `POST /:id/reopen` (canApprove)
- `journal-headers.service.ts` — reuse existing `reverse()` method

**Frontend:**
- `FiscalPeriodTable.tsx` — tambah tombol "Buka Kembali" pada row closed (jika `canApprove`)
- `FiscalPeriodsListPage.tsx` — tambah `canApprove` permission check
- `fiscalPeriods.api.ts` — tambah `reopenPeriod()`
- `fiscalPeriods.store.ts` — tambah action `reopenPeriod`
- `fiscal-period.types.ts` — tambah types
- Bisa pakai `ConfirmModal` yang sudah ada (tidak perlu modal baru)

### Execution Order

| Phase | Task |
|-------|------|
| 2a | Backend: errors, types, schema, repository |
| 2b | Backend: service (reverse closing journal + reopen) + controller + routes |
| 2c | Frontend: api, store, types, table button, list page permission |
| 2d | Testing |
