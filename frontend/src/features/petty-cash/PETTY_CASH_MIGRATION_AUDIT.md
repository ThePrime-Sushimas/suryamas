# Petty Cash — Migration & Restructure Audit

**Scope:** `frontend/src/features/petty-cash/` (14 file, ~2.573 LOC total)  
**Tanggal audit:** 29 Juni 2026  
**Tujuan:** (A) migrasi ke design system primitive, (B) restrukturisasi arsitektur file  
**Status:** Investigasi saja — belum dieksekusi

---

## Summary Keseluruhan

### Kondisi saat ini

| Aspek | Temuan |
|---|---|
| **Design system** | Hampir 100% manual Tailwind. Satu-satunya primitive UI yang dipakai: `ConfirmModal` (hapus expense di detail page) dan `Pagination` (list page). Tidak ada `Button`, `Dialog`, `Input`, `Select`, `FormField`, `CurrencyInput`, `DateInput`, `Textarea`, atau `StatusBadge` generik. |
| **Modal** | 8 overlay manual (`fixed inset-0` + backdrop click). 1 modal inline di `PettyCashListPage` (create request). 6 modal terpisah di `components/`. `ConfirmModal` legacy untuk konfirmasi hapus. |
| **Status badge** | Custom `PettyCashStatusBadge` dengan warna Tailwind hardcoded (yellow/blue/green/red). Mapping semantic sudah didokumentasikan di `lib/theme/statusMappings.ts` (`pettyCashStatusMap`) tapi belum dipakai. |
| **Form state** | Semua `useState` manual, tanpa React Hook Form. Nilai numerik disimpan sebagai **string**, dikonversi `Number()` saat submit. |
| **Data fetching** | Sudah terpusat di `api/pettyCash.api.ts` (TanStack Query hooks). Dipanggil langsung dari page/modal — belum ada custom hook layer di atasnya untuk form/orchestration logic. |
| **Types** | Terpusat di `types/pettyCash.types.ts`. Duplikasi ringan: `PcStatusFilter` di `utils/pettyCashFilters.url.ts` dan label status di beberapa file. |
| **Formatter** | `fmtCurrency` diduplikasi di 4 file, `fmtDate` di 2 file, `fmtQty` hanya di `PettyCashExpenseTable`. |
| **Arsitektur folder** | Sudah punya `components/`, `pages/`, `types/`, `utils/`, tapi **`api/`** (bukan `hooks/`), tidak ada barrel export, dan 3 page masih membawa business logic + UI berat. |

### File terbesar (kandidat pemecahan)

| LOC | File |
|---:|---|
| **541** | `components/PettyCashExpenseFormModal.tsx` |
| **351** | `pages/PettyCashSettlementPage.tsx` |
| **310** | `components/PettyCashExpenseEditModal.tsx` |
| **241** | `api/pettyCash.api.ts` |
| **219** | `pages/PettyCashListPage.tsx` (termasuk ~40 baris modal inline) |

### Import dari luar folder

| Konsumen | Import |
|---|---|
| `frontend/src/App.tsx` | Lazy load 3 page: `PettyCashListPage`, `PettyCashDetailPage`, `PettyCashSettlementPage` |
| Tidak ada modul lain | Tidak ada import langsung ke `components/`, `api/`, `types/`, atau `utils/` petty-cash |

Restrukturisasi internal aman selama path lazy import di `App.tsx` tetap valid (atau di-update bersamaan). `ap-payments` punya hook report sendiri (`usePettyCashExpenseReport`) — tidak terikat ke folder ini.

---

## Bagian A — Migrasi ke Design System Primitive

### A.1 `components/PettyCashStatusBadge.tsx` (29 LOC)

**Status badge**

- **Lokasi definisi:** file ini.
- **Pemakaian:** `PettyCashListPage`, `PettyCashDetailPage`, `PettyCashSettlementPage`.
- **Nilai status aktual** (dari `PettyCashRequestStatus` di types): `PENDING` | `DISBURSED` | `CLOSED` | `REJECTED`.
- **Label saat ini:** Pending, Aktif, Selesai, Ditolak.
- **Warna saat ini vs `pettyCashStatusMap`:**

| Status | Warna manual | Semantic map | Catatan visual |
|---|---|---|---|
| PENDING | yellow-50/700 | `neutral` (slate) | Perubahan warna signifikan |
| DISBURSED | blue-50/700 | `info` (indigo) | Biru → indigo muted |
| CLOSED | green-50/700 | `success` (emerald) | Hijau Tailwind → emerald muted |
| REJECTED | red-50/700 | `danger` (red muted) | Mirip, tone sedikit berbeda |

- **Migrasi:** Ganti wrapper custom dengan `StatusBadge` generik + mapping dari `statusMappings.pettyCash` + label map lokal. Komponen `PettyCashStatusBadge` bisa menjadi thin wrapper (~15 LOC) atau dihapus dan diganti inline di 3 lokasi pemakaian.

**Catatan:** Field `settlement_status: 'SETTLED' | null` ada di type `PettyCashRequest` tapi **tidak ditampilkan** di UI manapun.

---

### A.2 `pages/PettyCashListPage.tsx` (219 LOC)

#### Button manual

| Lokasi (perkiraan baris) | Konteks | className utama | Variant cocok | Loading manual? |
|---|---|---|---|---|
| ~89 | Header "Buat Request" | `bg-blue-600 text-white hover:bg-blue-700` + Plus icon | `primary` | Tidak |
| ~106 | Clear search (icon X) | Icon button tanpa padding eksplisit | `ghost` (icon-only) | Tidak |
| ~121 | Reset filter | `text-xs text-gray-500 hover:bg-gray-100` | `ghost` size `sm` | Tidak |
| ~182 | Tutup modal create (X) | `p-1 rounded hover:bg-gray-100` | `ghost` icon-only | Tidak |
| ~209 | Modal Batal | `text-gray-600 hover:bg-gray-100` | `secondary` atau `ghost` | Tidak |
| ~210 | Modal "Buat Request" submit | `bg-blue-600 disabled:opacity-50` | `primary` + `loading` prop | **Ya** — `Loader2` manual menggantikan teks |

#### Modal manual (INLINE — belum diekstrak)

- **Nama:** Create Request Modal (tidak punya komponen terpisah).
- **Trigger:** `showCreate` state.
- **Struktur:** Header + body + footer **menyatu** dalam satu `div` (`p-6 space-y-4`), bukan compound Header/Body/Footer.
- **Behavior:**
  - Backdrop click → `setShowCreate(false)` (tutup).
  - Escape → **tidak ada handler**.
  - Scroll lock body → **tidak ada**.
  - `stopPropagation` pada panel → ada.
- **preventClose saat loading:** **tidak** — user bisa tutup modal saat `createMutation.isPending`.
- **Ukuran:** `max-w-md` → cocok `Dialog` size `md`.

#### Input/form field

| Field | Jenis sekarang | Label/error | Catatan migrasi |
|---|---|---|---|
| Search filter | `<input>` manual + icon Search | Tanpa FormField, tanpa error | `Input` + leftIcon pattern |
| Branch filter | `<select>` manual | Tanpa FormField | `Select` |
| Status filter | `<select>` manual | Tanpa FormField | `Select` |
| date_from / date_to | `<input type="date">` manual | Tanpa FormField | `DateInput` |
| Create: branch | `<select>` | Label manual `text-xs`, validasi toast | `FormField` + `Select` |
| Create: amount_requested | `<input type="number">` | String state, placeholder "500000" | **`CurrencyInput`** (value `number \| ''`, bukan string) |
| Create: COA | `<select>` | Label manual | `FormField` + `Select` |
| Create: description | `<textarea>` manual | Opsional | `FormField` + `Textarea` |

#### Form state

- `useState` manual: `createForm` dengan `amount_requested` sebagai **string**.
- Validasi: toast error inline di `handleCreate`, bukan field-level error.

#### Styling out-of-scope

- Tabel list (border, hover row, dark mode classes).
- Layout filter bar, empty/loading state.
- `fmtCurrency` / `fmtDate` lokal (display only, bukan input).

---

### A.3 `pages/PettyCashDetailPage.tsx` (185 LOC)

#### Button manual

| Lokasi | Konteks | className utama | Variant | Loading? |
|---|---|---|---|---|
| ~62 | Kembali | `text-sm text-gray-500` link-style | `ghost` | Tidak |
| ~74–80 | Print Thermal | Bordered white + teal icon, `shadow-sm` | `secondary` (custom teal accent di icon) | Tidak |
| ~106 | Approve | `bg-green-600` | `primary` atau custom — hijau bukan variant standar | Tidak |
| ~107 | Reject | `bg-red-600` | `danger` | Tidak |
| ~112 | Tambah Expense | `bg-blue-600` + Plus | `primary` | Tidak |
| ~113 | Buat Settlement | `border border-gray-300` | `secondary` | Tidak |
| ~117 | Void Settlement | `bg-red-600` | `danger` | Tidak |

**Catatan:** Tombol Approve hijau — design system `Button` hanya punya `primary` (accent tema), bukan `success`. Perlu keputusan: pakai `primary` atau tambah pola khusus.

#### Modal

Tidak ada modal inline — semua didelegasikan ke komponen terpisah + `ConfirmModal`.

- `ConfirmModal` untuk hapus expense: sudah primitive legacy (bukan `Dialog` compound). Punya Escape + scroll lock + block close saat `isLoading`. **Kandidat migrasi terpisah** ke `Dialog` + `Button` atau tetap `ConfirmModal` sampai ConfirmModal sendiri dimigrasi global.

#### Status badge

- `PettyCashStatusBadge` di header card (~81).

#### Input/form

- Tidak ada form input di page ini (semua di modal anak).

#### Form state

- 7× `useState` untuk visibility modal + `editingExpense` + `deleteExpenseId`.
- `handleDeleteExpense` async handler di page.

#### Styling out-of-scope

- Info card grid, saldo highlight `text-blue-600`, rejection reason merah.
- Loading/not-found states.

---

### A.4 `pages/PettyCashSettlementPage.tsx` (351 LOC)

#### Button manual

| Lokasi | Konteks | Variant | Loading? |
|---|---|---|---|
| ~103 | Kembali | `ghost` | Tidak |
| ~331 | Batal | `ghost`/`secondary` | Tidak |
| ~337 | Post Settlement | `primary` | **Ya** — Loader2 manual |

#### Modal

- Tidak ada.

#### Input/form field

| Field | Jenis | State | Migrasi |
|---|---|---|---|
| settlement_date | `input type="date"` | string ISO date | `DateInput` |
| amount_returned | `input type="number"` | string | `CurrencyInput` |
| return_bank_account_id | `<select>` conditional | string | `Select` + `FormField` |
| refill_amount | `input type="number"` | string | `CurrencyInput` |
| refill_bank_account_id | `<select>` conditional | string | `Select` |
| notes | `<textarea>` | string | `Textarea` |

- Validasi: toast di `handleSubmit` (amount > remaining, bank wajib jika amount > 0).
- Kalkulasi preview: `useMemo` + derived values — **bukan blocker primitive**.

#### Form state

- Satu `useState` object, semua amount sebagai **string**.
- `useMemo` untuk `remaining`.

#### Styling out-of-scope

- Preview kalkulasi card biru (`bg-blue-50`).
- Expense summary `<details>` + mini table.
- Status badge di summary header.

---

### A.5 `components/PettyCashApproveModal.tsx` (71 LOC)

#### Button

| Lokasi | Konteks | Variant | Loading? |
|---|---|---|---|
| ~43 | Close X (tanpa type="button" eksplisit) | ghost icon | Tidak |
| ~63 | Batal | ghost/secondary | Tidak |
| ~64 | Approve & Cairkan | hijau `bg-green-600` | **Ya** Loader2 |

#### Modal manual

- Props: `open`, `onClose`.
- Struktur: header + body + footer dalam satu panel, **tidak terpisah** compound.
- Backdrop click → `onClose`.
- Escape / scroll lock → **tidak**.
- preventClose loading → **tidak**.
- Size: `max-w-md`.

#### Input

| Field | Jenis | State |
|---|---|---|
| source_bank_account_id | select | string |
| amount_disbursed | number input | string |
| notes | textarea | string |

- `amount_disbursed` default dari prop `defaultAmount` (number) → di-init sebagai `String(defaultAmount)`.
- Validasi silent: return early jika bank/amount kosong (tanpa toast).

---

### A.6 `components/PettyCashRejectModal.tsx` (46 LOC)

#### Button

- Batal → ghost/secondary
- Tolak → `danger` + Loader2 manual

#### Modal manual

- Sama pola backdrop click, tanpa Escape/scroll lock/preventClose.
- Header hanya `<h3>`, **tanpa** tombol X.

#### Input

- `reason` textarea, string state, wajib trim sebelum submit.

---

### A.7 `components/PettyCashVoidModal.tsx` (75 LOC)

#### Button

- Batal → ghost/secondary
- Void Settlement → `danger` + Loader2, juga `disabled` jika reason kosong

#### Modal manual

- Backdrop → `handleClose` (reset reason + errorMsg + onClose).
- Inline error banner (AlertCircle + merah) — **out-of-scope** primitive, pola alert custom.
- Escape / scroll lock / preventClose loading → **tidak**.

#### Input

- `reason` textarea.

#### Logic khusus

- `queryClient.invalidateQueries` on error — tetap di komponen/hook, bukan concern primitive.

---

### A.8 `components/PettyCashExpenseFormModal.tsx` (541 LOC) — TERBESAR

#### Button manual (~12 `<button>`)

| Konteks | className pola | Variant |
|---|---|---|
| Close X header | icon gray | ghost |
| Mode toggle (3): Beli Barang / Biaya Operasional / Pembelian Aset | Segmented: active `bg-blue-100 text-blue-700`, inactive gray | **Out-of-scope** — tidak ada SegmentedControl primitive |
| Clear product (X) | icon | ghost |
| Product picker trigger (dashed border) | dashed full-width | custom trigger — bukan Button standar |
| Asset product picker trigger | sama | custom |
| Clear receipt (X) | icon | ghost |
| Upload receipt trigger | dashed + Camera | custom |
| Batal footer | gray hover | secondary/ghost |
| Simpan footer | blue-600 | primary + loading (dual state: saving vs uploading receipt) |

#### Modal manual

- `max-w-lg`, `max-h-[90vh] overflow-y-auto` pada panel (bukan Dialog.Body scroll).
- Backdrop → `onClose` langsung (**tidak reset form** on backdrop — berbeda dari Void modal).
- Escape / scroll lock / preventClose → **tidak**.
- Nested: 2× `ProductPickerModal` (shared component luar folder).

#### Input/form field (ringkas per mode)

| Mode | Fields |
|---|---|
| **product** | Product picker, UOM select, qty/price/total (number inputs), date, description, receipt file, inventory checkbox + warehouse |
| **operational** | Category select, sub-category select, amount, date, description, receipt |
| **asset** | Asset product picker, category (disabled select), asset category (disabled), COA read-only div, useful_life, salvage_value, qty/price/total grid, date, description, receipt |

- Semua amount/qty/price: `type="number"`, string state, kalkulasi `qty × unit_price → amount` inline.
- Date: `input type="date"`, default `new Date().toISOString().slice(0,10)`.
- Currency fields kandidat `CurrencyInput`; qty mungkin tetap `Input type="number"` atau Input biasa (bukan currency).
- File upload receipt: **out-of-scope** primitive — tidak ada FileUpload primitive.
- Checkbox inventory: native `<input type="checkbox">` — out-of-scope.

#### Form state

- `useState` berat: `expenseForm` object (banyak string fields), `selectedProduct`, `selectedAssetProduct`, `selectedUomId`, `expenseMode`, `trackInventory`, `receiptFile`, flags picker.
- `useEffect` untuk default UOM.
- `useRef` file input.
- Tanpa RHF.

---

### A.9 `components/PettyCashExpenseEditModal.tsx` (310 LOC)

#### Button

- Close X, Batal, Simpan Perubahan (primary + Loader2)
- Trash2 pada preview receipt (icon button merah) — out-of-scope
- Upload/ganti foto (dashed trigger) — custom

#### Modal manual

- Sama pola: backdrop `onClose`, scroll di panel, tanpa Escape/lock/preventClose.

#### Input

- UOM select, category/subcategory, qty/price/total grid, date, description, warehouse (conditional), receipt image preview + file input.
- Signed URL fetch untuk receipt (`api.get('/storage/signed-url')`) — logic di `useEffect`, bukan primitive concern.

#### Form state

- `useState` form object (strings), `receiptFile`, `receiptPreview`, `selectedUomId`.
- 2× `useEffect` populate form + signed URL.
- Handler `handleQtyChange` / `handleUnitPriceChange` untuk sync amount.

---

### A.10 `components/PettyCashExpenseTable.tsx` (215 LOC)

#### Button

- Edit (Pencil icon): `p-1 hover:bg-blue-50` — icon button, variant `ghost` size sm
- Delete (Trash2 icon): `p-1 hover:bg-red-50` — ghost danger tone

#### Status badge

- Tidak ada — menampilkan teks "Ya" hijau untuk inventory, link biru untuk fixed asset.

#### Formatter lokal

- `fmtCurrency`, `fmtDate`, `fmtQty` — display only, pindah ke utils.

#### Styling out-of-scope

- Seluruh tabel, footer total, empty state, Link ke fixed assets.

---

### A.11 `components/PrintPettyCashModal.tsx` (111 LOC)

#### Button

- Close X (header)
- Batal: bordered `border-gray-300` — `secondary`
- Print: `bg-teal-600` + Printer icon — **teal bukan variant Button standar** (primary = accent tema)

#### Modal manual

- Selalu render (parent conditional `{showPrint && ...}`), tidak `if (!open) return null`.
- Struktur: header/body/footer **terpisah visual** (border-b / border-t) tapi bukan `Dialog` compound.
- Backdrop click → `onClose`.
- Escape / scroll lock / preventClose → **tidak**.
- Loading printer: skeleton `animate-pulse` — out-of-scope (bisa `Skeleton` primitive).

#### Input

- Printer `<select>` — bisa `Select` + `FormField`.

---

### A.12 File non-UI (referensi migrasi)

| File | LOC | Relevansi Bagian A |
|---|---:|---|
| `api/pettyCash.api.ts` | 241 | Tidak ada UI — tidak perlu migrasi primitive |
| `types/pettyCash.types.ts` | 117 | Status enum sumber kebenaran |
| `utils/pettyCashFilters.url.ts` | 62 | Tidak ada UI |

---

### A.13 Ringkasan inventory primitive

| Primitive | Jumlah lokasi estimasi | Prioritas |
|---|---:|---|
| `Button` | ~45+ instance | Tinggi |
| `Dialog` (+ Header/Body/Footer) | 8 manual overlay + 1 inline | Tinggi |
| `FormField` | ~40+ field dengan label manual | Tinggi |
| `Select` | ~20+ | Tinggi |
| `Input` / `Textarea` | ~15+ | Sedang |
| `CurrencyInput` | ~12 amount fields | Tinggi — perlu adapter string→number |
| `DateInput` | ~6 date fields | Sedang |
| `StatusBadge` | 1 komponen → 3 pemakaian | Rendah (quick win) |
| `ConfirmModal` → `Dialog`? | 1 di detail page | Sedang — keputusan global |

---

## Bagian B — Restrukturisasi Arsitektur File

### B.1 Inventaris LOC per file

| LOC | Path |
|---:|---|
| 541 | `components/PettyCashExpenseFormModal.tsx` |
| 351 | `pages/PettyCashSettlementPage.tsx` |
| 310 | `components/PettyCashExpenseEditModal.tsx` |
| 241 | `api/pettyCash.api.ts` |
| 219 | `pages/PettyCashListPage.tsx` |
| 215 | `components/PettyCashExpenseTable.tsx` |
| 185 | `pages/PettyCashDetailPage.tsx` |
| 117 | `types/pettyCash.types.ts` |
| 111 | `components/PrintPettyCashModal.tsx` |
| 75 | `components/PettyCashVoidModal.tsx` |
| 71 | `components/PettyCashApproveModal.tsx` |
| 62 | `utils/pettyCashFilters.url.ts` |
| 46 | `components/PettyCashRejectModal.tsx` |
| 29 | `components/PettyCashStatusBadge.tsx` |

**Folder tambahan saat ini:** `api/` (target: `hooks/`)

---

### B.2 `pages/PettyCashListPage.tsx` (219 LOC)

#### Breakdown isi

| Blok | Perkiraan LOC | Isi |
|---|---:|---|
| Constants/helpers | ~15 | `fmtCurrency`, `fmtDate`, `STATUS_OPTIONS` |
| Hooks & data | ~25 | permissions, url filters, list query, branches, COA |
| Create modal state + mutation | ~25 | `showCreate`, `createForm`, `handleCreate` |
| Filter JSX | ~30 | search, selects, dates, reset |
| Table JSX | ~45 | loading, empty, table rows |
| Pagination | ~5 | |
| **Modal inline create** | ~40 | Seluruh overlay + form + footer |
| Layout wrapper | ~10 | |

#### State/hooks yang bisa diekstrak

| Kandidat hook | Isi | LOC estimasi hook |
|---|---|---:|
| `usePettyCashListPage` | filters + query + permissions flags | ~30 |
| `useCreatePettyCashRequestForm` | createForm state, validation, submit, reset | ~35 |

#### Modal inline

- **Create Request Modal** — kandidat utama → `components/PettyCashCreateModal.tsx`

#### Setelah pemecahan (estimasi)

| File | LOC |
|---|---:|
| `PettyCashListPage.tsx` | ~120 |
| `components/PettyCashCreateModal.tsx` | ~75 |
| `hooks/useCreatePettyCashRequestForm.ts` | ~40 |
| `utils/pettyCash.formatters.ts` | ~25 (shared) |

---

### B.3 `pages/PettyCashDetailPage.tsx` (185 LOC)

#### Breakdown

| Blok | LOC | Isi |
|---|---:|---|
| fmtCurrency lokal | ~3 | duplikat |
| Hooks + permissions | ~15 | |
| Modal visibility state | ~10 | 6 boolean/null state |
| handleDeleteExpense | ~8 | |
| Loading/not-found guards | ~5 | |
| Info card + actions JSX | ~60 | |
| Expense table compose | ~8 | |
| Modal compose | ~50 | 7 modal components |

#### Ekstraksi hook

| Hook | Isi |
|---|---|
| `usePettyCashDetailPage(id)` | fetch request, derived remaining/expenses, permission flags |
| `usePettyCashDetailModals()` | semua show/hide state + handlers |

Estimasi ~40 LOC per hook, page turun ke ~100 LOC (compose only).

#### Modal inline

- Tidak ada — sudah baik.

---

### B.4 `pages/PettyCashSettlementPage.tsx` (351 LOC)

#### Breakdown

| Blok | LOC | Isi |
|---|---:|---|
| fmtCurrency | ~6 | |
| Form state + derived calc | ~25 | remaining, carriedTo, totalDanaBaru |
| handleSubmit + validation | ~35 | |
| Guards (loading/not found/wrong status) | ~20 | |
| Summary card JSX | ~60 | |
| Form JSX | ~110 | |
| Preview calc JSX | ~50 | |
| Submit buttons | ~20 | |

#### Ekstraksi

| File baru | Isi | LOC |
|---|---|---:|
| `hooks/useSettlementForm.ts` | form state, derived values, validation, submit | ~80 |
| `components/SettlementSummaryCard.tsx` | summary + expense details | ~55 |
| `components/SettlementPreviewCard.tsx` | preview kalkulasi | ~45 |
| `components/SettlementForm.tsx` | input fields (masih bisa dimigrasi primitive later) | ~90 |
| `PettyCashSettlementPage.tsx` | compose + guards | ~80 |

---

### B.5 `components/PettyCashExpenseFormModal.tsx` (541 LOC)

#### Breakdown

| Blok | LOC | Isi |
|---|---:|---|
| State declarations | ~40 | |
| Data fetching (categories, warehouses, asset cats, UOMs) | ~15 | |
| UOM derived logic | ~15 | |
| resetForm | ~15 | |
| handleSubmit + validation | ~75 | |
| Modal shell + footer | ~25 | |
| Mode toggle UI | ~15 | |
| Product mode fields | ~40 | |
| Operational mode | ~25 | |
| Asset mode | ~80 | |
| Amount section (3 variants) | ~95 | |
| Date/description/receipt/inventory | ~60 | |
| ProductPickerModal ×2 | ~55 | |

#### Ekstraksi rekomendasi

| File baru | Isi | LOC |
|---|---|---:|
| `hooks/useExpenseFormModal.ts` | state, mode, validation, submit, reset, UOM logic | ~130 |
| `components/expense-form/ExpenseModeToggle.tsx` | 3-tab toggle | ~25 |
| `components/expense-form/ProductExpenseFields.tsx` | product picker, UOM, qty/price | ~70 |
| `components/expense-form/OperationalExpenseFields.tsx` | category/subcat | ~35 |
| `components/expense-form/AssetExpenseFields.tsx` | asset picker, COA display, life/salvage | ~90 |
| `components/expense-form/ExpenseAmountFields.tsx` | grid qty/price/total per mode | ~80 |
| `components/expense-form/ExpenseReceiptUpload.tsx` | file input UI | ~40 |
| `components/expense-form/ExpenseInventorySection.tsx` | checkbox + warehouse | ~25 |
| `PettyCashExpenseFormModal.tsx` | Dialog shell + compose | ~60 |

**Dependency:** hook → semua sub-komponen field; modal shell → hook + sub-komponen; sub-komponen → hook callbacks/state (via props, bukan context dulu).

---

### B.6 `components/PettyCashExpenseEditModal.tsx` (310 LOC)

| File baru | Isi | LOC |
|---|---|---:|
| `hooks/useExpenseEditForm.ts` | populate, signed URL, qty/price sync, submit | ~90 |
| `components/expense-form/ExpenseReceiptEditor.tsx` | preview + upload (shared dengan create?) | ~50 |
| `PettyCashExpenseEditModal.tsx` | shell + compose | ~100 |

Potensi shared `ExpenseReceiptUpload` / `ExpenseReceiptEditor` antara create & edit.

---

### B.7 Modal kecil (Approve, Reject, Void, Print)

Sudah terpisah — cukup pindah ke pola `hooks/useXxxForm.ts` masing-masing (~25–40 LOC) tanpa memecah file lebih lanjut:

| Modal | Hook baru | LOC modal setelah |
|---|---|---:|
| Approve | `useApprovePettyCashForm.ts` | ~45 |
| Reject | `useRejectPettyCashForm.ts` | ~30 |
| Void | `useVoidSettlementForm.ts` | ~45 |
| Print | `usePrintPettyCashForm.ts` | ~60 |

---

### B.8 Type definitions

| Lokasi | Isi |
|---|---|
| `types/pettyCash.types.ts` | **Sumber utama** — `PettyCashRequestStatus`, entities, DTOs, `PettyCashListQuery` |
| `utils/pettyCashFilters.url.ts` | `PettyCashFilters`, `PcStatusFilter` (= status + `''`) — **duplikasi konsep** |
| `pages/PettyCashListPage.tsx` | `STATUS_OPTIONS` array label — **duplikasi label** dari badge |
| `components/PettyCashStatusBadge.tsx` | `CONFIG` label map — **duplikasi label** |
| `api/pettyCash.api.ts` | `PaginationMeta` inline — hanya lokal, tidak duplikat |
| Modal props interfaces | Inline per file (`PettyCashApproveModalProps`, dll.) — OK tetap lokal atau pindah ke `types/` jika di-share |

**Rekomendasi:** Tambah `types/pettyCash.status.ts` atau extend types dengan `PETTY_CASH_STATUS_LABELS` record tunggal — dipakai badge, filter options, dan docs.

---

### B.9 Data fetching logic

| Saat ini | Lokasi | Kandidat |
|---|---|---|
| Query/mutation hooks | `api/pettyCash.api.ts` | Pindah/rename → `hooks/pettyCash.api.ts` atau split `hooks/usePettyCashQueries.ts` + `hooks/usePettyCashMutations.ts` |
| Dipanggil dari | Pages + modals langsung | OK setelah rename folder |
| Form orchestration | Inline di page/modal | Ekstrak ke hooks form (lihat B.2–B.7) |
| External data | `useBranches`, `useCoaOptions`, `useCompanyBankAccounts`, `useCategories`, dll. | Tetap import dari feature lain — tidak dipindah |

`usePettyCashExpenses` ada di API tapi **tidak dipakai** di UI saat ini (expenses di-embed di detail response).

---

### B.10 Utility / formatter lokal

| Util saat ini | Lokasi | Rekomendasi |
|---|---|---|
| `fmtCurrency` | ListPage, DetailPage, SettlementPage, ExpenseTable | `utils/pettyCash.formatters.ts` |
| `fmtDate` | ListPage, ExpenseTable | sama |
| `fmtQty` | ExpenseTable | sama |
| `STATUS_OPTIONS` | ListPage | `utils/pettyCash.status.ts` atau types |
| `pettyCashFilterConfig` | utils (sudah benar) | tetap |
| Validasi settlement (amount > remaining) | SettlementPage handleSubmit | `utils/pettyCash.settlement.ts` (pure functions) — opsional |
| Expense amount calc (qty × price) | Form + Edit modal | `utils/pettyCash.expense.ts` — opsional, hindari duplikasi |

Tidak ada validator terpisah — semua validasi imperative di handler.

---

### B.11 Target struktur folder (rencana akhir)

```
features/petty-cash/
├── components/
│   ├── PettyCashStatusBadge.tsx          (thin wrapper atau dihapus)
│   ├── PettyCashCreateModal.tsx          (BARU — dari ListPage)
│   ├── PettyCashApproveModal.tsx
│   ├── PettyCashRejectModal.tsx
│   ├── PettyCashVoidModal.tsx
│   ├── PettyCashExpenseFormModal.tsx     (slim shell)
│   ├── PettyCashExpenseEditModal.tsx     (slim shell)
│   ├── PettyCashExpenseTable.tsx
│   ├── PrintPettyCashModal.tsx
│   ├── SettlementSummaryCard.tsx         (BARU)
│   ├── SettlementPreviewCard.tsx         (BARU)
│   ├── SettlementForm.tsx              (BARU)
│   └── expense-form/                     (BARU — sub-komponen form)
│       ├── ExpenseModeToggle.tsx
│       ├── ProductExpenseFields.tsx
│       ├── OperationalExpenseFields.tsx
│       ├── AssetExpenseFields.tsx
│       ├── ExpenseAmountFields.tsx
│       ├── ExpenseReceiptUpload.tsx
│       └── ExpenseInventorySection.tsx
├── hooks/
│   ├── pettyCash.api.ts                  (pindah dari api/)
│   ├── useCreatePettyCashRequestForm.ts  (BARU)
│   ├── usePettyCashDetailPage.ts         (BARU)
│   ├── usePettyCashDetailModals.ts       (BARU)
│   ├── useSettlementForm.ts              (BARU)
│   ├── useExpenseFormModal.ts            (BARU)
│   ├── useExpenseEditForm.ts             (BARU)
│   └── ... (approve/reject/void/print form hooks)
├── types/
│   ├── pettyCash.types.ts
│   └── pettyCash.status.ts               (BARU — labels + options)
├── utils/
│   ├── pettyCashFilters.url.ts
│   ├── pettyCash.formatters.ts           (BARU)
│   └── pettyCash.expense.ts              (opsional)
└── pages/
    ├── PettyCashListPage.tsx             (slim)
    ├── PettyCashDetailPage.tsx           (slim)
    └── PettyCashSettlementPage.tsx       (slim)
```

**Barrel export:** Tidak ada saat ini. Opsional tambah `index.ts` hanya jika modul lain perlu import — saat ini tidak diperlukan.

---

## Urutan Eksekusi yang Disarankan

### Prinsip

Migrasi primitive pada file yang akan dipecah = kerja ganda. Restrukturisasi murni (pindah kode tanpa ubah className) = diff bersih, mudah di-review.

### Fase 0 — Fondasi rendah risiko (1–2 PR kecil)

1. `utils/pettyCash.formatters.ts` + `types/pettyCash.status.ts` — hapus duplikasi, zero UI change.
2. `PettyCashStatusBadge` → `StatusBadge` generik — 1 file, 3 call site, visual change terkontrol.

**Alasan:** Quick win design system; tidak bergantung pada pemecahan modal besar.

### Fase 1 — Restrukturisasi (pure move, no styling)

Urutan internal:

1. Rename `api/` → `hooks/pettyCash.api.ts` + update import internal.
2. Ekstrak `PettyCashCreateModal` dari ListPage + `useCreatePettyCashRequestForm`.
3. Slim down `PettyCashDetailPage` → `usePettyCashDetailPage` + `usePettyCashDetailModals`.
4. Pecah `PettyCashSettlementPage` (summary, form, preview, hook).
5. Pecah `PettyCashExpenseFormModal` + `PettyCashExpenseEditModal` (hook + sub-komponen).

**Alasan:** File terbesar jadi unit kecil sebelum sentuh Dialog/Button/FormField. Setiap PR bisa satu file besar.

### Fase 2 — Migrasi primitive (per komponen, setelah struktur stabil)

Urutan:

1. Modal kecil: Approve, Reject, Void, Print, Create — pola sama (Dialog + Button + FormField).
2. Settlement form fields.
3. Expense form sub-komponen (satu sub-komponen per PR).
4. List page filters + table actions.
5. Detail page action buttons.
6. `ConfirmModal` hapus expense — koordinasi dengan migrasi global ConfirmModal jika ada rencana.

**Alasan:** Modal kecil mengestablish pola Dialog (`preventClose={mutation.isPending}`) sekali, lalu di-copy ke form kompleks. Filter list page bisa paralel setelah pola FormField jelas.

### Fase 3 — Polish out-of-scope (opsional, terpisah)

- Tabel → DataTable pattern / card list (design rules user).
- Segmented mode toggle → komponen shared baru.
- File upload receipt → shared primitive.
- `ConfirmModal` global → `Dialog`.

### Bukan urutan yang disarankan

- Migrasi full `PettyCashExpenseFormModal` (541 LOC) **sebelum** dipecah — conflict merge tinggi, review sulit.
- Restrukturisasi + migrasi styling dalam satu PR untuk file yang sama — diff tidak terpisah.

---

## Risiko & Pertanyaan untuk Manusia

### Visual / UX

1. **PENDING badge:** Manual pakai kuning (warning feel), `pettyCashStatusMap` pakai `neutral` (slate). Setuju dengan pergeseran visual?
2. **DISBURSED:** Biru → indigo (`info`). Apakah label "Aktif" tetap?
3. **Tombol Approve hijau:** `Button` tidak punya variant success. Pakai `primary` (accent biru) atau izinkan exception hijau?
4. **Print teal:** Sama — teal bukan variant standar. Tetap teal (className override) atau seragamkan ke `primary`?
5. **Perubahan behavior Dialog:** Escape, focus trap, scroll lock, `preventClose` saat loading — saat ini modal manual **bisa ditutup saat request pending**. Migrasi ke `Dialog` akan mengubah ini (biasanya diinginkan). Konfirmasi diterima?

### Teknis

6. **CurrencyInput vs qty/price:** `CurrencyInput` default integer. Field qty dan unit_price kadang desimal (`step="0.01"` di edit modal). Mana yang pakai `CurrencyInput` vs `Input type="number"`?
7. **Adapter form state:** Semua form pakai string; `CurrencyInput` pakai `number | ''`. Refactor state bersamaan dengan migrasi primitive, atau adapter di boundary?
8. **Approve modal:** Form tidak di-reset saat `defaultAmount` berubah atau modal dibuka ulang — bug potensial pre-existing. Fix dalam migrasi atau PR terpisah?
9. **Expense create backdrop:** Menutup modal tidak memanggil `resetForm` (berbeda dari submit success). Pertahankan atau samakan dengan Void modal (`handleClose` reset)?
10. **`ConfirmModal`:** Migrasi ke `Dialog` sekarang atau tunggu initiative global ConfirmModal?

### Arsitektur

11. **`api/` vs `hooks/`:** Rename folder mengubah ~15 import internal. Satu PR dedicated atau bertahap dengan re-export sementara di `api/index.ts`?
12. **`usePettyCashExpenses`:** Tidak terpakai — hapus atau simpan untuk pagination expense future?
13. **Shared `expense-form/`:** Sub-komponen di `petty-cash/components/expense-form/` saja, atau naik ke `components/shared/` jika modul lain butuh pola serupa?
14. **Settlement pure utils:** Ekstrak validasi/kalkulasi ke `utils/` — seberapa agresif (hanya formatter vs full validation functions)?

### Scope / testing

15. Tidak ada test file di folder ini. Apakah migrasi wajib disertai smoke test manual checklist saja, atau tambah test untuk hooks yang diekstrak?
16. **Permission matrix:** `insert`, `approve`, `release` — perlu verifikasi manual pasca-migrasi di setiap status request.

---

## Lampiran — Checklist Manual Pasca-Migrasi

- [ ] List: filter URL sync, create request, pagination
- [ ] Detail: approve, reject, add/edit/delete expense, void settlement, print thermal
- [ ] Settlement: validasi bank, preview kalkulasi, carry/refill, navigasi kembali
- [ ] Semua modal: Escape, backdrop, loading preventClose
- [ ] Dark mode pada input/modal/badge
- [ ] Status badge 4 nilai + edge unknown status fallback

---

*Audit ini hanya berisi temuan dan rencana. Implementasi dan diskusi solusi detail dilakukan setelah laporan direview.*
