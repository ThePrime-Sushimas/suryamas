# Purchase Invoices — Migration & Restructure Audit

**Scope:** `frontend/src/features/purchase-invoices/` (13 file, ~4.007+ LOC total)  
**Tanggal audit:** 30 Juni 2026  
**Tujuan:** (A) migrasi ke design system primitive, (B) restrukturisasi arsitektur file  
**Status:** Investigasi — belum dieksekusi

---

## Summary Keseluruhan

### Kondisi saat ini

| Aspek | Temuan |
|---|---|
| **Design system** | 0% — semua UI masih manual Tailwind. Satu-satunya primitive yang dipakai: `Pagination` (list page), `ConfirmModal` (detail page), `useUrlFilters` + `useListNavigation` (shared lib). Tidak ada `Button`, `Dialog`, `Input`, `Select`, `FormField`, `CurrencyInput`, `DateInput`, `Textarea`, `StatusBadge`, atau `Skeleton`. |
| **Modal** | 1 modal manual di `PurchaseInvoiceSplitModal.tsx` (404 LOC — overlay `fixed inset-0`). 3 modal inline di `PurchaseInvoiceDetailPage.tsx` (reject reason textarea). Image preview modal manual. `ConfirmModal` legacy untuk delete/unpost. |
| **Status badge** | `STATUS_CONFIG` object di **2 file** (ListPage + DetailPage) — duplikasi penuh. Warna Tailwind hardcoded. Tidak ada mapping ke `statusMappings` generik. |
| **Form state** | Semua `useState` manual, tanpa React Hook Form. Nilai numerik disimpan sebagai `number` (sudah lebih baik dari petty cash yang pakai string). |
| **Data fetching** | Terpusat di `api/purchaseInvoices.api.ts` (TanStack Query hooks) — ✅ baik. |
| **Types** | `PurchaseInvoice` + `PurchaseInvoiceDetail` di API file. `PurchaseInvoiceFilters` di `types/`. Interface lokal di FormPage (`PILine`, `PIChargeRow`) — perlu dipindah ke `types/`. |
| **Formatter** | `fmtCurrency` diduplikasi di **3 file** (ListPage, DetailPage, FormPage). `fmtDate` di **2 file** (ListPage, DetailPage). `fmtDateTime` di DetailPage. |
| **Status config** | `STATUS_CONFIG` duplikasi di ListPage + DetailPage. `GP_LINE_STATUS_CONFIG` hanya di DetailPage. `PI_CHARGE_LABELS` di DetailPage + FormPage. `FILE_TYPE_LABELS` di DetailPage. |
| **Arsitektur folder** | Punya `api/`, `components/`, `hooks/`, `pages/`, `types/`, `utils/` — ✅ struktur sudah sesuai standar. Tapi `api/` seharusnya `hooks/` (konsisten dengan petty cash). |

### File terbesar (kandidat pemecahan)

| LOC | File |
|---:|---|
| **1135** | `pages/PurchaseInvoiceDetailPage.tsx` |
| **1101** | `pages/PurchaseInvoiceFormPage.tsx` |
| **680** | `pages/PurchaseInvoicesPage.tsx` |
| **423** | `api/purchaseInvoices.api.ts` |
| **404** | `components/PurchaseInvoiceSplitModal.tsx` |
| **114** | `utils/purchaseInvoiceFilters.url.ts` |
| **76** | `components/PurchaseInvoicePaymentDue.tsx` |
| **38** | `hooks/usePurchaseInvoiceFilters.ts` |
| **21** | `types/purchaseInvoiceFilters.types.ts` |
| **15** | `constants.ts` |

### Import dari luar folder

| Konsumen | Import |
|---|---|
| `frontend/src/App.tsx` | Lazy load 3 page: `PurchaseInvoicesPage`, `PurchaseInvoiceDetailPage`, `PurchaseInvoiceFormPage` |
| `frontend/src/features/ap-payments/` | Mungkin import types — perlu dicek |
| `frontend/src/features/goods-processing/` | Mungkin import types — perlu dicek |

---

## Bagian A — Migrasi ke Design System Primitive

### A.1 `pages/PurchaseInvoicesPage.tsx` (680 LOC)

#### Button manual (~15+ instance)

| Lokasi (perkiraan baris) | Konteks | className utama | Variant cocok | Loading manual? |
|---|---|---|---|---|
| ~193 | Selection mode toggle (mobile) | `p-2 rounded-lg` | `ghost` icon-only | Tidak |
| ~203 | Gabung (merge) | `bg-amber-500 text-white` | custom amber — bukan variant standar | Tidak |
| ~213 | Buat Manual | `bg-indigo-600 text-white` | `primary` | Tidak |
| ~228 | Clear search (X) | Icon button | `ghost` icon-only | Tidak |
| ~439 | Batalkan Post | `border-amber-200 bg-amber-50` | custom amber | Tidak |
| ~453 | Post Jurnal | `bg-indigo-600 text-white` | `primary` + loading | **Ya** — Loader2 manual |
| ~481 | Hapus (DRAFT) | `text-red-500` | `ghost` danger tone | Tidak |
| ~579 | Batalkan Post (mobile) | sama | custom amber | Tidak |
| ~593 | Post Jurnal (mobile) | sama | `primary` + loading | **Ya** |
| ~621 | Hapus (mobile) | `text-red-500` | `ghost` danger tone | Tidak |

#### Input/form field

| Field | Jenis sekarang | Label/error | Catatan migrasi |
|---|---|---|---|
| Search filter | `<input>` manual + icon Search | Tanpa FormField, tanpa error | `Input` + leftIcon pattern |
| Supplier filter | `<select>` manual | Tanpa FormField | `Select` |
| Branch filter | `<select>` manual | Tanpa FormField | `Select` |

#### Status badge

- `STATUS_CONFIG` object lokal dengan warna hardcoded.
- 5 status: DRAFT (gray), SUBMITTED (blue), APPROVED (indigo), REJECTED (red), POSTED (green).
- Dipakai di desktop table + mobile cards.

#### Modal

- `ConfirmModal` legacy untuk delete + unpost (2 instance).
- Belum migrasi ke `Dialog` compound.

#### Formatter lokal

- `fmtDate` (baris 25-30)
- `fmtCurrency` (baris 31-36)

#### Styling issues

- `h-screen` layout — tidak pakai max-width container
- Dynamic Tailwind classes: `bg-${tab.color}-600`, `text-${tab.color}-600`, `border-${tab.color}-600` — **anti-pattern JIT**
- Skeleton loading manual (`animate-pulse` div)
- Empty state hanya teks "Tidak ada invoice ditemukan"

---

### A.2 `pages/PurchaseInvoiceDetailPage.tsx` (1135 LOC) — TERBESAR

#### Button manual (~20+ instance)

| Lokasi | Konteks | className utama | Variant | Loading? |
|---|---|---|---|---|
| ~279 | Back to list | `p-2 hover:bg-gray-100` | `ghost` icon-only | Tidak |
| ~306 | Hapus | `text-red-600 hover:bg-red-50` | `ghost` danger | Tidak |
| ~313 | Edit | `border border-gray-200` | `secondary` | Tidak |
| ~321 | Pecah Invoice | `border-indigo-200 text-indigo-700` | `secondary` custom | Tidak |
| ~330 | Ajukan | `bg-indigo-600 text-white` | `primary` | **Ya** Loader2 |
| ~365 | Tolak | `bg-red-600 text-white` | `danger` | **Ya** Loader2 |
| ~370 | Setujui | `bg-green-600 text-white` | custom hijau — bukan variant standar | **Ya** Loader2 |
| ~396 | Batalkan Post | `border-amber-200 bg-amber-50` | custom amber | **Ya** Loader2 |
| ~773 | Buka file attachment | `text-blue-600` | `ghost` icon | Tidak |
| ~839 | Buka di Barang Masuk | `text-orange-600` | `ghost` link | Tidak |
| ~919 | Detail item | `text-indigo-600` | `ghost` link | Tidak |

#### Modal

- `ConfirmModal` legacy untuk delete, unpost, reject (3 instance).
- Reject modal **inline** dengan textarea — belum diekstrak ke komponen terpisah.
- Image preview modal manual (`fixed inset-0 z-100`).

#### Status badge

- `STATUS_CONFIG` duplikasi dari ListPage (baris 65-86).
- `GP_LINE_STATUS_CONFIG` lokal (baris 88-97).

#### Formatter lokal

- `fmtDate` (baris 44-49)
- `fmtDateTime` (baris 50-57)
- `fmtCurrency` (baris 58-63)
- `fmtQty` (baris 103)

#### Label maps lokal

- `FILE_TYPE_LABELS` (baris 105-111)
- `PI_CHARGE_LABELS` (baris 113-118)

#### Komponen inline

- `AttachmentThumbnail` (baris 120-173) — bisa diekstrak ke `components/`

#### State/hooks yang bisa diekstrak

| Kandidat hook | Isi | LOC estimasi hook |
|---|---|---|
| `usePurchaseInvoiceDetail` | fetch + permissions + derived data | ~50 |
| `usePurchaseInvoiceDetailModals` | show/hide state + handlers | ~40 |
| `useRejectInvoiceForm` | reject reason state + submit | ~30 |

#### Setelah pemecahan (estimasi)

| File | LOC |
|---|---|
| `PurchaseInvoiceDetailPage.tsx` | ~400 |
| `hooks/usePurchaseInvoiceDetail.ts` | ~50 |
| `hooks/usePurchaseInvoiceDetailModals.ts` | ~40 |
| `components/AttachmentThumbnail.tsx` | ~55 |
| `components/PurchaseInvoiceRejectModal.tsx` | ~60 |

---

### A.3 `pages/PurchaseInvoiceFormPage.tsx` (1101 LOC) — TERBESAR KEDUA

#### Button manual (~10+ instance)

| Lokasi | Konteks | className utama | Variant | Loading? |
|---|---|---|---|---|
| ~543 | Back to list | `p-2 hover:bg-gray-100` | `ghost` icon-only | Tidak |
| ~552 | Save/Submit | `bg-indigo-600 text-white` | `primary` | Tidak (disabled saja) |
| ~907 | Tambah baris charge | `text-indigo-600` | `ghost` link | Tidak |
| ~1041 | Hapus baris charge | `text-red-500 hover:bg-red-50` | `ghost` danger icon | Tidak |

#### Input/form field

Semua field manual — tidak ada `FormField`, `Input`, `Select`, `CurrencyInput`, `DateInput`, `Textarea`:

| Field | Jenis | State | Migrasi |
|---|---|---|---|
| Supplier | `<select>` | string | `Select` + `FormField` |
| Cabang | `<select>` | string | `Select` + `FormField` |
| Nomor Invoice | `<input type="text">` | string | `Input` |
| Tanggal Invoice | `<input type="date">` | string ISO | `DateInput` |
| Rekening Tujuan | `<select>` | number \| null | `Select` |
| Catatan | `<textarea>` | string | `Textarea` |
| Qty Invoice (per line) | `<input type="number">` | number | `Input type="number"` |
| Harga Satuan (per line) | `<input type="number">` | number | `CurrencyInput` |
| PPN % (per line) | `<input type="number">` | number | `Input type="number"` |
| Charge amount | `<input type="text">` | string (custom sanitize) | `CurrencyInput` (perlu adapter) |
| Charge PPN % | `<input type="number">` | number | `Input type="number"` |
| GR checkbox | `<input type="checkbox">` | string[] | native checkbox (out-of-scope) |

#### Formatter lokal

- `fmtCurrency` (baris 526-531)
- `CHARGE_TYPE_LABELS` (baris 26-31)

#### Logic lokal yang bisa diekstrak

| Fungsi | Lokasi | Kandidat |
|---|---|---|
| `sanitizeChargeAmountInput` | baris 39-60 | `utils/purchaseInvoice.charges.ts` |
| `parseChargeAmountInput` | baris 62-67 | `utils/purchaseInvoice.charges.ts` |
| `computeChargeLine` | baris 33-35 | `utils/purchaseInvoice.charges.ts` |
| `effectiveChargeTaxRate` | baris 99-102 | `utils/purchaseInvoice.charges.ts` |
| `fetchGrLines` | baris 225-318 | `hooks/useGrLines.ts` |
| `handleGrToggle` | baris 320-342 | `hooks/useGrSelection.ts` |
| `syncInvoiceDateFromSelectedGrs` | baris 152-161 | `hooks/useGrSelection.ts` |
| `totals` useMemo | baris 469-524 | `hooks/useInvoiceTotals.ts` |

#### Interface lokal

- `PILine` (baris 69-85) — pindah ke `types/purchaseInvoice.types.ts`
- `PIChargeRow` (baris 87-96) — pindah ke `types/purchaseInvoice.types.ts`

#### Setelah pemecahan (estimasi)

| File | LOC |
|---|---|
| `PurchaseInvoiceFormPage.tsx` | ~400 |
| `hooks/usePurchaseInvoiceForm.ts` | ~150 |
| `hooks/useGrSelection.ts` | ~80 |
| `hooks/useInvoiceTotals.ts` | ~60 |
| `utils/purchaseInvoice.charges.ts` | ~50 |
| `types/purchaseInvoice.types.ts` | ~60 (BARU) |

---

### A.4 `components/PurchaseInvoiceSplitModal.tsx` (404 LOC)

#### Button manual

| Konteks | className | Variant |
|---|---|---|
| Tutup (header) | `text-gray-500 hover:text-gray-700` | `ghost` |
| Hapus nota | `text-red-600 hover:text-red-700` | `ghost` danger |
| Tambah nota | `text-indigo-600 hover:text-indigo-700` | `ghost` link |
| Batal (footer) | `border border-gray-200` | `secondary` |
| Simpan & Pecah | `bg-indigo-600 text-white` | `primary` + disabled |

#### Modal manual

- Overlay `fixed inset-0 z-50` — bukan `Dialog` compound.
- Backdrop click → `onClose`.
- Escape / scroll lock / preventClose → **tidak**.
- Size: `max-w-3xl`.

#### Input/form field

| Field | Jenis | Migrasi |
|---|---|---|
| No. Invoice Supplier | `<input type="text">` | `Input` |
| Tanggal Invoice | `<input type="date">` | `DateInput` |
| Rekening Tujuan | `<select>` | `Select` |
| Line checkbox | `<input type="checkbox">` | native (out-of-scope) |

#### Formatter lokal

- `fmtCurrency` (baris 30-35)

#### Komponen inline

- `NotaHeader` (baris 380-403) — bisa diekstrak

#### Setelah pemecahan (estimasi)

| File | LOC |
|---|---|
| `PurchaseInvoiceSplitModal.tsx` | ~300 (setelah Dialog + Button) |
| `components/SplitNotaCard.tsx` | ~80 (NotaHeader + form fields) |
| `hooks/useSplitInvoiceForm.ts` | ~60 |

---

### A.5 `components/PurchaseInvoicePaymentDue.tsx` (76 LOC)

- ✅ Relatif bersih — hanya 3 variant (card, inline, table).
- ❌ `fmtDate` lokal — pindah ke shared formatter.
- ❌ Manual styling (border, bg, text colors) — bisa pakai `StatusBadge` atau card pattern.

---

### A.6 File non-UI (referensi migrasi)

| File | LOC | Relevansi Bagian A |
|---|---|---|
| `api/purchaseInvoices.api.ts` | 423 | Tidak ada UI — tidak perlu migrasi primitive |
| `hooks/usePurchaseInvoiceFilters.ts` | 38 | ✅ Sudah pakai `useUrlFilters` pattern |
| `types/purchaseInvoiceFilters.types.ts` | 21 | ✅ Types bersih |
| `utils/purchaseInvoiceFilters.url.ts` | 114 | ✅ Sudah sesuai standar |
| `constants.ts` | 15 | ✅ Bersih |

---

### A.7 Ringkasan inventory primitive

| Primitive | Jumlah lokasi estimasi | Prioritas |
|---|---|---|
| `Button` | ~50+ instance | **Tinggi** |
| `Dialog` (+ Header/Body/Footer) | 1 manual overlay + 3 inline | **Tinggi** |
| `FormField` | ~30+ field dengan label manual | **Tinggi** |
| `Select` | ~15+ | **Tinggi** |
| `Input` / `Textarea` | ~20+ | **Sedang** |
| `CurrencyInput` | ~15 amount fields (form + line items) | **Tinggi** |
| `DateInput` | ~4 date fields | **Sedang** |
| `StatusBadge` | 2 file duplikasi → 2 pemakaian | **Rendah** (quick win) |
| `Skeleton` | ~3 lokasi loading | **Rendah** |
| `ConfirmModal` → `Dialog` | 3 di detail + 2 di list | **Sedang** |

---

## Bagian B — Restrukturisasi Arsitektur File

### B.1 Inventaris LOC per file

| LOC | Path |
|---:|---|
| 1135 | `pages/PurchaseInvoiceDetailPage.tsx` |
| 1101 | `pages/PurchaseInvoiceFormPage.tsx` |
| 680 | `pages/PurchaseInvoicesPage.tsx` |
| 423 | `api/purchaseInvoices.api.ts` |
| 404 | `components/PurchaseInvoiceSplitModal.tsx` |
| 114 | `utils/purchaseInvoiceFilters.url.ts` |
| 76 | `components/PurchaseInvoicePaymentDue.tsx` |
| 38 | `hooks/usePurchaseInvoiceFilters.ts` |
| 21 | `types/purchaseInvoiceFilters.types.ts` |
| 15 | `constants.ts` |

### B.2 `pages/PurchaseInvoicesPage.tsx` (680 LOC)

#### Breakdown isi

| Blok | Perkiraan LOC | Isi |
|---|---|---|
| Constants/helpers | ~20 | `fmtDate`, `fmtCurrency`, `STATUS_CONFIG` |
| Hooks & data | ~30 | filters, permissions, queries |
| Selection state + handlers | ~40 | selectedIds, isSelectionMode, toggle, merge |
| Post/Unpost handlers | ~50 | handlePostJournal, handleUnpost |
| Header JSX | ~60 | title, action buttons |
| Tabs JSX | ~40 | tab bar with counts |
| Filter bar JSX | ~50 | search, supplier, branch selects |
| Desktop table | ~180 | thead + tbody + loading/empty + rows |
| Mobile cards | ~150 | card list + loading/empty |
| Pagination | ~10 | |
| ConfirmModal ×2 | ~30 | delete + unpost |

#### State/hooks yang bisa diekstrak

| Kandidat hook | Isi | LOC estimasi hook |
|---|---|---|
| `usePurchaseInvoiceList` | filters + query + permissions + counts | ~40 |
| `usePurchaseInvoiceSelection` | selectedIds, isSelectionMode, toggle, merge | ~50 |
| `usePurchaseInvoicePost` | post/unpost handlers + loading state | ~40 |

#### Komponen yang bisa diekstrak

| Komponen | Isi | LOC estimasi |
|---|---|---|
| `InvoiceTableDesktop` | desktop table + rows | ~150 |
| `InvoiceCardList` | mobile cards | ~120 |
| `InvoiceStatusBadge` | thin wrapper `StatusBadge` | ~15 |
| `InvoiceFilters` | search + selects + reset | ~60 |

#### Setelah pemecahan (estimasi)

| File | LOC |
|---|---|
| `PurchaseInvoicesPage.tsx` | ~200 |
| `hooks/usePurchaseInvoiceList.ts` | ~40 |
| `hooks/usePurchaseInvoiceSelection.ts` | ~50 |
| `hooks/usePurchaseInvoicePost.ts` | ~40 |
| `components/InvoiceTableDesktop.tsx` | ~150 |
| `components/InvoiceCardList.tsx` | ~120 |
| `components/InvoiceStatusBadge.tsx` | ~15 |
| `components/InvoiceFilters.tsx` | ~60 |

---

### B.3 `pages/PurchaseInvoiceDetailPage.tsx` (1135 LOC)

#### Breakdown isi

| Blok | LOC | Isi |
|---|---|---|
| Constants/helpers | ~60 | STATUS_CONFIG, GP_LINE_STATUS_CONFIG, fmtCurrency, fmtDate, fmtDateTime, fmtQty, FILE_TYPE_LABELS, PI_CHARGE_LABELS |
| AttachmentThumbnail component | ~55 | inline component |
| Hooks + permissions | ~20 | |
| State declarations | ~15 | 6 useState |
| Handler functions | ~60 | handleStatusAction, handleDelete, handleUnpost |
| Header JSX | ~140 | back button, title, status badge, action buttons |
| Info cards | ~50 | 4 info cards |
| Payment due | ~5 | |
| Staging info banner | ~25 | |
| Over Qty warning | ~25 | |
| Rejected banner | ~15 | |
| Lines table | ~120 | thead + tbody + charges + totals |
| Attachments section | ~70 | |
| GP audit section | ~140 | |
| Audit timeline | ~90 | |
| Modals | ~100 | ConfirmModal ×3 + SplitModal + Image preview |

#### Ekstraksi hook

| Hook | Isi |
|---|---|
| `usePurchaseInvoiceDetail(id)` | fetch, permissions, derived data (allGpLinesConfirmed, hasUnconfirmedGp, dll) |
| `usePurchaseInvoiceDetailModals()` | semua show/hide state + handlers |

#### Ekstraksi komponen

| Komponen | Isi |
|---|---|
| `AttachmentThumbnail.tsx` | signed URL + thumbnail render |
| `PurchaseInvoiceRejectModal.tsx` | reject reason textarea + confirm |
| `InvoiceAuditTimeline.tsx` | timeline component |
| `InvoiceGpAuditSection.tsx` | GP line audit section |

#### Setelah pemecahan (estimasi)

| File | LOC |
|---|---|
| `PurchaseInvoiceDetailPage.tsx` | ~400 |
| `hooks/usePurchaseInvoiceDetail.ts` | ~60 |
| `hooks/usePurchaseInvoiceDetailModals.ts` | ~40 |
| `components/AttachmentThumbnail.tsx` | ~55 |
| `components/PurchaseInvoiceRejectModal.tsx` | ~60 |
| `components/InvoiceAuditTimeline.tsx` | ~90 |
| `components/InvoiceGpAuditSection.tsx` | ~140 |

---

### B.4 `pages/PurchaseInvoiceFormPage.tsx` (1101 LOC)

#### Breakdown isi

| Blok | LOC | Isi |
|---|---|---|
| Constants/helpers | ~40 | CHARGE_TYPE_LABELS, sanitizeChargeAmountInput, parseChargeAmountInput, computeChargeLine, effectiveChargeTaxRate |
| Interface lokal | ~30 | PILine, PIChargeRow |
| State declarations | ~20 | 10+ useState |
| Data fetching | ~30 | suppliers, branches, bank accounts, available GRs |
| Edit mode init | ~50 | useEffect populate form |
| GR logic | ~100 | fetchGrLines, handleGrToggle, syncInvoiceDateFromSelectedGrs |
| Line/charge handlers | ~30 | handleLineChange, handleChargeChange, addChargeRow, removeChargeRow |
| Validation + submit | ~80 | handleSubmit |
| Totals calculation | ~60 | useMemo totals |
| Header JSX | ~30 | back button, title, save button |
| Header form fields | ~120 | supplier, branch, invoice number, date, bank account, notes |
| GR selection panel | ~80 | checkbox list |
| Lines table | ~150 | thead + tbody + rows |
| Charges section | ~150 | table + DPP logic |
| Summary footer | ~40 | totals display |

#### Ekstraksi hook

| Hook | Isi |
|---|---|
| `usePurchaseInvoiceForm(id?)` | semua form state + handlers + validation + submit |
| `useGrSelection(supplierId, branchId, isEdit)` | GR fetch + toggle + line population |
| `useInvoiceTotals(lines, charges)` | totals calculation |

#### Ekstraksi komponen

| Komponen | Isi |
|---|---|
| `InvoiceFormHeader.tsx` | header fields (supplier, branch, invoice number, date, bank, notes) |
| `InvoiceGrSelector.tsx` | GR selection panel |
| `InvoiceLineTable.tsx` | line items editable table |
| `InvoiceChargeTable.tsx` | charges editable table |
| `InvoiceTotalsFooter.tsx` | summary footer |

#### Setelah pemecahan (estimasi)

| File | LOC |
|---|---|
| `PurchaseInvoiceFormPage.tsx` | ~300 |
| `hooks/usePurchaseInvoiceForm.ts` | ~150 |
| `hooks/useGrSelection.ts` | ~100 |
| `hooks/useInvoiceTotals.ts` | ~60 |
| `components/InvoiceFormHeader.tsx` | ~120 |
| `components/InvoiceGrSelector.tsx` | ~80 |
| `components/InvoiceLineTable.tsx` | ~150 |
| `components/InvoiceChargeTable.tsx` | ~150 |
| `components/InvoiceTotalsFooter.tsx` | ~40 |

---

### B.5 `components/PurchaseInvoiceSplitModal.tsx` (404 LOC)

#### Ekstraksi

| File baru | Isi | LOC |
|---|---|---|
| `hooks/useSplitInvoiceForm.ts` | notas state, toggleLine, addNota, removeNota, validation, submit | ~80 |
| `components/SplitNotaCard.tsx` | single nota form (header + fields + line table) | ~120 |
| `PurchaseInvoiceSplitModal.tsx` | Dialog shell + compose | ~100 |

---

### B.6 Type definitions

| Lokasi | Isi | Masalah |
|---|---|---|
| `api/purchaseInvoices.api.ts` | `PurchaseInvoice`, `PurchaseInvoiceDetail`, `PurchaseInvoiceLine`, dll. | ✅ Sumber utama — comprehensive |
| `types/purchaseInvoiceFilters.types.ts` | `PurchaseInvoiceFilters`, `PurchaseInvoiceListQuery` | ✅ Sudah terpisah |
| `pages/PurchaseInvoiceFormPage.tsx` | `PILine`, `PIChargeRow` interface | ❌ Duplikasi — pindah ke `types/purchaseInvoice.types.ts` |
| `pages/PurchaseInvoiceDetailPage.tsx` | `STATUS_CONFIG`, `GP_LINE_STATUS_CONFIG` | ❌ Duplikasi dari ListPage |
| `pages/PurchaseInvoicesPage.tsx` | `STATUS_CONFIG` | ❌ Duplikasi |

**Rekomendasi:**
- Buat `types/purchaseInvoice.types.ts` — pindahkan `PILine`, `PIChargeRow` dari FormPage
- Buat `types/purchaseInvoice.status.ts` — `STATUS_CONFIG`, `GP_LINE_STATUS_CONFIG`, `PI_CHARGE_LABELS`, `FILE_TYPE_LABELS` — single source of truth

---

### B.7 Data fetching logic

| Saat ini | Lokasi | Kandidat |
|---|---|---|
| Query/mutation hooks | `api/purchaseInvoices.api.ts` | Rename → `hooks/purchaseInvoices.api.ts` (konsisten dengan petty cash) |
| Dipanggil dari | Pages + modals langsung | ✅ OK |
| Form orchestration | Inline di page | Ekstrak ke hooks form (lihat B.4) |
| External data | `useSuppliers`, `useBranches`, `bankAccountsApi`, dll. | ✅ Tetap import dari feature lain |

---

### B.8 Utility / formatter lokal

| Util saat ini | Lokasi | Rekomendasi |
|---|---|---|
| `fmtCurrency` | ListPage, DetailPage, FormPage, SplitModal | `utils/purchaseInvoice.formatters.ts` |
| `fmtDate` | ListPage, DetailPage, PaymentDue | `utils/purchaseInvoice.formatters.ts` |
| `fmtDateTime` | DetailPage | `utils/purchaseInvoice.formatters.ts` |
| `fmtQty` | DetailPage | `utils/purchaseInvoice.formatters.ts` |
| `STATUS_CONFIG` | ListPage, DetailPage | `types/purchaseInvoice.status.ts` |
| `GP_LINE_STATUS_CONFIG` | DetailPage | `types/purchaseInvoice.status.ts` |
| `PI_CHARGE_LABELS` | DetailPage, FormPage | `types/purchaseInvoice.status.ts` |
| `FILE_TYPE_LABELS` | DetailPage | `types/purchaseInvoice.status.ts` |
| `sanitizeChargeAmountInput` | FormPage | `utils/purchaseInvoice.charges.ts` |
| `parseChargeAmountInput` | FormPage | `utils/purchaseInvoice.charges.ts` |
| `computeChargeLine` | FormPage | `utils/purchaseInvoice.charges.ts` |
| `effectiveChargeTaxRate` | FormPage | `utils/purchaseInvoice.charges.ts` |

---

### B.9 Target struktur folder (rencana akhir)

```
features/purchase-invoices/
├── components/
│   ├── AttachmentThumbnail.tsx          (BARU — dari DetailPage)
│   ├── InvoiceAuditTimeline.tsx         (BARU — dari DetailPage)
│   ├── InvoiceCardList.tsx              (BARU — dari ListPage)
│   ├── InvoiceChargeTable.tsx           (BARU — dari FormPage)
│   ├── InvoiceFilters.tsx               (BARU — dari ListPage)
│   ├── InvoiceFormHeader.tsx            (BARU — dari FormPage)
│   ├── InvoiceGpAuditSection.tsx        (BARU — dari DetailPage)
│   ├── InvoiceGrSelector.tsx            (BARU — dari FormPage)
│   ├── InvoiceLineTable.tsx             (BARU — dari FormPage)
│   ├── InvoiceStatusBadge.tsx           (BARU — thin wrapper)
│   ├── InvoiceTableDesktop.tsx          (BARU — dari ListPage)
│   ├── InvoiceTotalsFooter.tsx          (BARU — dari FormPage)
│   ├── PurchaseInvoicePaymentDue.tsx    (existing)
│   ├── PurchaseInvoiceRejectModal.tsx   (BARU — dari DetailPage)
│   ├── PurchaseInvoiceSplitModal.tsx    (slim shell)
│   └── SplitNotaCard.tsx                (BARU — dari SplitModal)
├── hooks/
│   ├── purchaseInvoices.api.ts          (rename dari api/)
│   ├── useGrSelection.ts                (BARU)
│   ├── useInvoiceTotals.ts              (BARU)
│   ├── usePurchaseInvoiceDetail.ts      (BARU)
│   ├── usePurchaseInvoiceDetailModals.ts (BARU)
│   ├── usePurchaseInvoiceFilters.ts     (existing)
│   ├── usePurchaseInvoiceForm.ts        (BARU)
│   ├── usePurchaseInvoiceList.ts        (BARU)
│   ├── usePurchaseInvoicePost.ts        (BARU)
│   ├── usePurchaseInvoiceSelection.ts   (BARU)
│   └── useSplitInvoiceForm.ts           (BARU)
├── types/
│   ├── purchaseInvoice.types.ts         (BARU — PILine, PIChargeRow)
│   ├── purchaseInvoice.status.ts        (BARU — STATUS_CONFIG, labels)
│   └── purchaseInvoiceFilters.types.ts  (existing)
├── utils/
│   ├── purchaseInvoice.charges.ts       (BARU)
│   ├── purchaseInvoiceFilters.url.ts    (existing)
│   ├── purchaseInvoice.formatters.ts    (BARU)
│   ├── purchaseInvoiceStaging.ts        (existing)
│   └── purchaseInvoiceUom.ts            (existing)
├── constants.ts                         (existing)
└── pages/
    ├── PurchaseInvoiceDetailPage.tsx    (slim)
    ├── PurchaseInvoiceFormPage.tsx      (slim)
    └── PurchaseInvoicesPage.tsx         (slim)
```

---

## Urutan Eksekusi yang Disarankan

### Prinsip

Sama seperti petty cash: migrasi primitive pada file yang akan dipecah = kerja ganda. Restrukturisasi murni (pindah kode tanpa ubah className) = diff bersih.

### Fase 0 — Fondasi rendah risiko (1-2 PR kecil)

1. `utils/purchaseInvoice.formatters.ts` + `types/purchaseInvoice.status.ts` — hapus duplikasi, zero UI change.
2. `types/purchaseInvoice.types.ts` — pindahkan `PILine`, `PIChargeRow` dari FormPage.
3. `utils/purchaseInvoice.charges.ts` — ekstrak fungsi charge dari FormPage.

**Alasan:** Quick win; tidak bergantung pada pemecahan file besar.

### Fase 1 — Restrukturisasi (pure move, no styling)

Urutan internal:

1. Rename `api/` → `hooks/purchaseInvoices.api.ts` + update import internal.
2. Ekstrak `InvoiceTableDesktop` + `InvoiceCardList` + `InvoiceFilters` dari ListPage.
3. Ekstrak hooks dari ListPage (`usePurchaseInvoiceList`, `usePurchaseInvoiceSelection`, `usePurchaseInvoicePost`).
4. Ekstrak `AttachmentThumbnail` + `PurchaseInvoiceRejectModal` dari DetailPage.
5. Ekstrak hooks dari DetailPage (`usePurchaseInvoiceDetail`, `usePurchaseInvoiceDetailModals`).
6. Ekstrak `InvoiceFormHeader` + `InvoiceGrSelector` + `InvoiceLineTable` + `InvoiceChargeTable` + `InvoiceTotalsFooter` dari FormPage.
7. Ekstrak hooks dari FormPage (`usePurchaseInvoiceForm`, `useGrSelection`, `useInvoiceTotals`).
8. Ekstrak `SplitNotaCard` + `useSplitInvoiceForm` dari SplitModal.

**Alasan:** File terbesar (DetailPage 1135 LOC, FormPage 1101 LOC, ListPage 680 LOC) jadi unit kecil sebelum sentuh Dialog/Button/FormField.

### Fase 2 — Migrasi primitive (per komponen, setelah struktur stabil)

Urutan:

1. Modal: SplitModal → `Dialog` + `Button` + `FormField`.
2. Modal kecil: RejectModal → `Dialog` + `Button` + `FormField`.
3. List page: `Button` + `Select` + `Input` + `StatusBadge` + `Skeleton`.
4. Detail page: `Button` + `StatusBadge` + `Dialog` (ConfirmModal → Dialog).
5. Form page: `Button` + `Select` + `Input` + `CurrencyInput` + `DateInput` + `Textarea` + `FormField`.
6. `ConfirmModal` → `Dialog` (koordinasi dengan migrasi global).

### Fase 3 — Polish out-of-scope (opsional, terpisah)

- `h-screen` → max-width container (konsisten dengan design rules)
- Dynamic Tailwind classes → object mapping literal
- Empty state → komponen reusable
- Skeleton → `Skeleton` primitive

### Bukan urutan yang disarankan

- Migrasi full `PurchaseInvoiceDetailPage` (1135 LOC) **sebelum** dipecah — conflict merge tinggi, review sulit.
- Restrukturisasi + migrasi styling dalam satu PR untuk file yang sama — diff tidak terpisah.

---

## Risiko & Pertanyaan untuk Manusia

### Visual / UX

1. **Tombol Setujui hijau:** `Button` tidak punya variant success. Pakai `primary` (accent indigo) atau izinkan exception hijau?
2. **Tombol Gabung (merge) amber:** Sama — amber bukan variant standar. Tetap amber atau seragamkan ke `primary`?
3. **Tombol Batalkan Post amber:** Sama — perlu keputusan warna.
4. **Status badge warna:** DRAFT gray, SUBMITTED blue, APPROVED indigo, REJECTED red, POSTED green — apakah mapping ke semantic map (`neutral`, `info`, `success`, `danger`) acceptable?
5. **Perubahan behavior Dialog:** Escape, focus trap, scroll lock, `preventClose` saat loading — saat ini `ConfirmModal` sudah punya sebagian. Migrasi ke `Dialog` akan menstandarisasi.

### Teknis

6. **CurrencyInput vs number input:** Form page punya banyak field number (qty_invoiced, unit_price, tax_rate, charge amount). Mana yang pakai `CurrencyInput` vs `Input type="number"`?
7. **Charge amount input:** Saat ini pakai string dengan custom sanitize (biarkan user ketik "-" dulu). `CurrencyInput` mungkin perlu adapter.
8. **Form state adapter:** Semua form pakai `number` (sudah lebih baik dari petty cash yang string). Tapi `CurrencyInput` pakai `number | ''`. Perlu refactor state boundary.
9. **Split modal reset:** Form tidak di-reset saat modal dibuka ulang — bug potensial pre-existing. Fix dalam migrasi atau PR terpisah?
10. **`ConfirmModal`:** Migrasi ke `Dialog` sekarang atau tunggu initiative global?

### Arsitektur

11. **`api/` vs `hooks/`:** Rename folder mengubah ~15 import internal. Satu PR dedicated atau bertahap dengan re-export sementara?
12. **`usePurchaseInvoiceAttachments`:** Tidak terpakai di UI (attachments di-embed di detail response) — hapus atau simpan?
13. **Shared `InvoiceStatusBadge`:** Di folder purchase-invoices saja, atau naik ke `components/shared/` jika modul lain butuh pola serupa?
14. **`GP_LINE_STATUS_CONFIG`:** Duplikasi dengan modul goods-processing? Perlu dicek apakah sudah ada di sana.

### Scope / testing

15. Tidak ada test file di folder ini. Apakah migrasi wajib disertai smoke test manual checklist saja, atau tambah test untuk hooks yang diekstrak?
16. **Permission matrix:** `insert`, `update`, `approve`, `release` — perlu verifikasi manual pasca-migrasi di setiap status transisi (DRAFT → SUBMITTED → APPROVED → POSTED).

---

## Lampiran — Checklist Manual Pasca-Migrasi

- [ ] List: filter URL sync (tab, search, supplier, branch), pagination, merge, post/unpost
- [ ] Detail: submit, approve, reject, delete, split, unpost, attachment preview
- [ ] Form: create new, edit existing, GR selection, line editing, charge editing, totals calculation
- [ ] Split modal: multi-nota assignment, validation, submit
- [ ] Semua modal: Escape, backdrop, loading preventClose
- [ ] Dark mode pada input/modal/badge
- [ ] Status badge 5 nilai + edge unknown status fallback
- [ ] Post journal flow: pricelist sync warnings toast
- [ ] Over Qty confirmation checkbox
- [ ] Staging invoice info banner + split guidance

---

*Audit ini hanya berisi temuan dan rencana. Implementasi dan diskusi solusi detail dilakukan setelah laporan direview.*