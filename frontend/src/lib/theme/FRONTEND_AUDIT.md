# Frontend Design System Audit

**Tanggal:** 28 Juni 2026  
**Scope:** `frontend/src/`  
**Tujuan:** Persiapan pembangunan design system / component library bersama

---

## Summary (Temuan Paling Penting)

- **Tidak ada component library bersama yang nyata.** `components/ui/` hanya berisi 5 file (Pagination, ConfirmModal, Skeleton, ThemeToggle, ToastContainer). Semua komponen lain — modal, badge, table, input, page header — dibangun ulang per-feature.
- **Modal overlay di-duplikasi 67 kali** di seluruh codebase. Pattern `fixed inset-0 z-{n} flex items-center justify-center bg-black/40` direplikasi manual di tiap feature, padahal `ConfirmModal` yang sudah ada jarang dipakai.
- **Status badge diimplementasikan 25+ kali secara terpisah**, dengan variasi struktur (rounded-full vs rounded-lg), padding (py-0.5 vs py-1), dan nama color token yang tidak konsisten.
- **Currency formatting tidak punya shared utility.** Ada 97 file yang melakukan format IDR/currency, dengan 7+ definisi fungsi `formatCurrency`/`fmtCurrency` tersebar di feature-level utils yang tidak saling berbagi.
- **AP Payments membangun design system sendiri** (`ap-payments.theme.ts`) dengan 100+ class tokens rose/pink, menciptakan visual brand yang benar-benar berbeda dari semua modul lain.

---

## 1. Struktur Project

### Tree Folder (`src/` level 2-3)

```
frontend/src/
├── components/
│   ├── layout/           # Layout, Sidebar, MenuItem, menu.config.tsx
│   ├── shared/           # ProductPickerModal.tsx (satu-satunya)
│   ├── ui/               # ConfirmModal, Pagination, Skeleton, ThemeToggle, ToastContainer
│   ├── AssignEmployeeToBranchModal.tsx
│   ├── BulkActionBar.tsx
│   ├── ErrorBoundary.tsx
│   ├── ExportButton.tsx
│   ├── ImportModal.tsx
│   └── RequirePermission.tsx
├── contexts/             # ToastContext (dan lainnya)
├── features/             # 55+ feature modules (lihat di bawah)
├── hooks/
├── lib/
│   ├── axios.ts
│   ├── errorParser.ts
│   ├── storage.ts
│   ├── tailwind-theme.ts   ← design tokens (JS object, belum dipakai luas)
│   ├── urlFilters/
│   └── ...
├── pages/
├── services/
└── utils/
```

**Feature modules yang ada (55+):** accounting (sub-tree besar), ap-payments, auth, bank-accounts, bank-reconciliation, bank-statement-import, banks, branch\_context, branches, cash-counts, cash-flow, categories, companies, daily-prep-orders2, daily-stock-opname, dashboard, employees, expense-categorization, fixed-assets, food-production, general-invoices, goods-processing, goods-receipts, inventory, jobs, marketplace-po, metric\_units, monitoring, monthly-stock-opname, notifications, payment-method-alerts, payment-methods, payment-terms, pending-journal-posting, permissions, petty-cash, pos-aggregates, pos-imports, pos-staging, pos-sync-aggregates, pos-transactions, pricelists, printers, product-uoms, production-requests, products, purchase-invoices, purchase-orders, purchase-requests, settings, shortage-report, stock-adjustments, stock-transfers, supplier-products, suppliers, users, waste-report.

> **Catatan:** Tidak ada folder `prepaid-amortization` tersendiri — fitur ini hidup di dalam `general-invoices` (AmortizationsPage, InvoiceSummaryPanel).

### Routing

- Terpusat di `App.tsx` dengan React Router DOM v7
- Semua route dilindungi `RequirePermission` dan dibungkus `BranchSelectionGuard`
- Route di-lazy-load menggunakan `React.lazy` + `Suspense`
- Tidak ada per-feature router file — semua didefinisikan di satu titik

### State Management

| Kebutuhan | Library |
|---|---|
| Server state (fetch, cache, invalidasi) | TanStack Query v5 |
| Global UI state (branch context, permissions) | Zustand v5 |
| Form state | React Hook Form + `@hookform/resolvers` |
| URL/filter state | Custom `useUrlFilters` hook (`lib/urlFilters/`) |
| Local component state | `useState` / `useReducer` |

Tidak ada Redux. Pendekatan campur antara Zustand dan TanStack Query sudah konsisten dan sesuai tanggung jawab masing-masing.

---

## 2. Styling Approach Per Module

### Kesimpulan Global

Seluruh codebase **menggunakan Tailwind CSS v4** sebagai satu-satunya styling tool. Tidak ada CSS Modules, styled-components, atau plain CSS per-feature. `index.css` mendefinisikan beberapa utility class global (`.card`, `.btn`, `.btn-primary`, `.input`, `.badge`), tapi jarang dipakai — hampir semua komponen menulis Tailwind class string langsung.

| Aspek | Status |
|---|---|
| Metode styling | Tailwind CSS (100% — tidak ada CSS Modules, tidak ada inline style HTML) |
| CSS file per-feature | **0** — tidak ada satu pun `.css` atau `.module.css` di dalam `features/` |
| Custom Tailwind tokens | Hanya override warna `gray` di `tailwind.config.js`. Tidak ada `primary`, `brand`, dll |
| Design tokens JS | Ada di `lib/tailwind-theme.ts` tapi **tidak diimport oleh sebagian besar feature** |

### Detail Per Module Target

#### AP Payments (`features/ap-payments/`)
- **Approach:** Punya file tema sendiri `ap-payments.theme.ts` — objek TypeScript berisi 100+ class string bertema rose/pink
- **Warna hardcode:** `#fff9f7`, `#fef8f6`, `#faf4f0`, `#fdf0f4`, `#fdf2f6` (cream/pink palette) dipakai di 6 file
- **Karakter visual:** Sepenuhnya berbeda dari semua modul lain — background gradient rose, border rose, badge pink, modal rose-tinted. Di dark mode, fallback ke blue/gray standar
- **Penilaian:** Arsitektur tema-nya rapi (terpusat dalam satu file), tapi scope-nya seharusnya global

#### Fixed Assets (`features/fixed-assets/`)
- **Approach:** Tailwind ad-hoc, gray/blue standar, tidak ada file tema
- **Status badge:** `AssetStatusBadge` didefinisikan **inline di dalam `FixedAssetsPage.tsx`** — bukan komponen terpisah
- **Warna:** Semua dari Tailwind palette standar, tidak ada hardcode

#### Petty Cash (`features/petty-cash/`)
- **Approach:** Tailwind ad-hoc, gray/blue standar
- **Status badge:** `PettyCashStatusBadge` — sudah ekstrak ke file sendiri (paling rapi dari modul target)
- **Format currency:** Fungsi `fmtCurrency` didefinisikan lokal di `PettyCashListPage.tsx` menggunakan `Intl.NumberFormat`
- **Create modal:** Diimplementasikan inline di dalam page component, bukan komponen terpisah

#### Bank Reconciliation (`features/bank-reconciliation/`)
- **Approach:** Tailwind ad-hoc, blue/gray standar
- **Design tokens:** Modul ini yang menginspirasi `lib/tailwind-theme.ts` (ada komentar di file tersebut), tapi sudah tidak konsisten menggunakannya
- **Format currency:** Menggunakan `formatCurrency` dari `utils/reconciliation.utils.ts` (utility lokal)
- **Status badge:** Didefinisikan inline di dalam `BankMutationTable.tsx` — bukan file tersendiri
- **`SettlementStatusBadge`:** Ada di `settlement-groups/components/` — terpisah, tapi hanya untuk sub-feature itu

#### General Invoices (`features/general-invoices/`)
- **Approach:** Tailwind ad-hoc, campuran blue dan gray
- **Modal:** `PaymentModals.tsx` mengimplementasikan beberapa modal (Create, Approve, Reject, Mark Paid) dalam satu file panjang, masing-masing dengan overlay manual
- **Prepaid amortization** hidup di sini sebagai `AmortizationsPage.tsx`
- **Format currency:** Menggunakan `formatRupiah` dari `constants.ts` lokal
- **Inkonsistensi:** Beberapa panel pakai `rounded-2xl` (gaya AP-payments-like), bagian lain pakai `rounded-lg` standar

#### POS Sync Aggregates (`features/pos-sync-aggregates/`)
- **Approach:** Tailwind ad-hoc, gray standar — modul yang paling "vanilla" dari semua target
- **Komponen:** Hanya 3 file (PosSyncAggregatesFilters, PosSyncAggregateDetailPage, PosSyncAggregatesPage)
- **Tidak ada status badge tersendiri** — status ditampilkan inline sebagai Tailwind class string

---

## 3. Komponen yang Sudah Ada: Reusable vs Duplikat

### a. Button

| Tipe | Lokasi | Pendekatan |
|---|---|---|
| **Tidak ada `<Button>` component** | — | — |
| Class global `.btn`, `.btn-primary`, `.btn-secondary` | `index.css` | Jarang dipakai |
| Token string `primaryButton`, `secondaryButton` | `lib/tailwind-theme.ts` | Tidak dipakai oleh hampir semua feature |
| Inline Tailwind per-page | 55+ feature | **Setiap halaman nulis `bg-blue-600 text-white rounded-lg...` sendiri** |
| AP Payments custom `btnPrimary`, `btnSecondary` | `ap-payments.theme.ts` | Hanya untuk AP Payments |

**Kesimpulan:** Tidak ada Button component. Tiap feature mendefinisikan ulang class button secara inline.

### b. Input / TextField

| Tipe | Lokasi | Pendekatan |
|---|---|---|
| Class global `.input` | `index.css` | Ada, tapi jarang dipakai |
| Token string `components.input` | `lib/tailwind-theme.ts` | Tidak dipakai luas |
| Inline Tailwind per-feature | Semua feature | Pattern `px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm` berulang |
| AP Payments `.input`, `.inputSearch`, `.select` | `ap-payments.theme.ts` | Hanya AP Payments, dengan styling rose |

**Kesimpulan:** Tidak ada Input component. Pattern Tailwind-nya cukup konsisten (minor variasi `border-gray-200` vs `border-gray-300`), tapi tetap duplikasi.

### c. Select / Dropdown

Sama dengan Input — tidak ada shared component. Semua feature menggunakan native `<select>` dengan inline Tailwind.

### d. DatePicker

Tidak ada DatePicker component sama sekali. Feature yang butuh date input menggunakan `<input type="date">` langsung, atau string manipulation manual. Hanya 3 file yang menyebut `DatePicker` dan itu adalah referensi ke external library yang tidak terinstall (kemungkinan sisa kode lama).

### e. Modal / Dialog

| Komponen | Lokasi |
|---|---|
| `ConfirmModal` (shared) | `components/ui/ConfirmModal.tsx` |
| Modal backdrop manual | **67 file** — `fixed inset-0 z-{n} flex items-center justify-center bg-black/40 backdrop-blur-sm` |

`ConfirmModal` sudah cukup lengkap (variant danger/warning/info/success, loading state, disabled confirm, keyboard Escape). Tapi **tidak dipakai oleh hampir semua feature** — feature membuat overlay modal sendiri dengan konten kustom. Tidak ada `Dialog` primitive yang bisa menampung konten arbitrary.

Contoh modal yang diimplementasikan manual (pilihan):
- `PettyCashApproveModal.tsx`, `PettyCashRejectModal.tsx`, `PettyCashVoidModal.tsx`, `PettyCashExpenseFormModal.tsx`, `PettyCashExpenseEditModal.tsx` — 5 modal di petty-cash saja
- `DpoConfirmModal.tsx`, `DpoGenerateModal.tsx`, `DpoPrintModal.tsx` — daily prep orders
- `BulkSettleModal.tsx`, `CancelLineModal.tsx`, `CancelSessionModal.tsx`, `SettleModal.tsx` — marketplace-po
- `NonPosReconcileModal.tsx`, `SettlementDetailModal.tsx` — bank reconciliation
- `PaymentModals.tsx` (berisi 4+ modal dalam 1 file) — general invoices

### f. DataTable / List Table dengan Pagination

| Komponen | Lokasi |
|---|---|
| `Pagination` (shared) | `components/ui/Pagination.tsx` — **dipakai luas** |
| Table component | **Tidak ada** |

`Pagination` adalah shared component yang paling konsisten dipakai. Tapi tidak ada `<DataTable>` — setiap feature menulis `<table>` / `<div>` list sendiri dari nol, dengan `Pagination` di bawahnya. Tidak ada kolom sorting, column visibility, atau row selection yang ter-share.

### g. Status Badge

Ini adalah **kategori duplikasi paling parah**. Ditemukan **25 file Badge** tersendiri, ditambah **badge yang didefinisikan inline** di page/component tanpa diekstrak:

| File Badge | Lokasi | Catatan |
|---|---|---|
| `PettyCashStatusBadge.tsx` | `petty-cash/components/` | Pattern paling bersih |
| `StatusBadge.tsx` (fiscal periods) | `accounting/fiscal-periods/components/` | |
| `JournalStatusBadge.tsx` | `accounting/journals/journal-headers/components/` | |
| `JournalTypeBadge.tsx` | `accounting/journals/journal-headers/components/` | |
| `AccountTypeBadge.tsx` | `accounting/chart-of-accounts/components/` | |
| `PriorityBadge.tsx` | `accounting/accounting-purpose-accounts/components/` | |
| `SideBadge.tsx` | `accounting/accounting-purpose-accounts/components/` | |
| `AppliedToBadge.tsx` | `accounting/accounting-purposes/components/` | |
| `SystemLockBadge.tsx` | `accounting/accounting-purposes/components/` | |
| `AgingBadge.tsx` | `ap-payments/components/` | |
| `BulkBadge.tsx` | `ap-payments/components/` | |
| `PrimaryBadge.tsx` | `bank-accounts/components/` | |
| `SettlementStatusBadge.tsx` | `bank-reconciliation/settlement-groups/components/` | |
| `StatusBadge.tsx` (import) | `bank-statement-import/components/common/` | Paling feature-rich (icon, size, animated) |
| `BankStatusBadge.tsx` | `banks/components/` | |
| `CashCountStatusBadge.tsx` | `cash-counts/components/` | |
| `DpoStatusBadge.tsx` | `daily-prep-orders2/components/` | |
| `OpnameStatusBadge.tsx` | `daily-stock-opname/components/` | |
| `GrSourceBadge.tsx` | `goods-receipts/components/` | |
| `SessionStatusBadge.tsx` | `marketplace-po/components/` | |
| `PaymentMethodStatusBadge.tsx` | `payment-methods/components/` | |
| `PaymentTermStatusBadge.tsx` | `payment-terms/components/` | |
| `PosAggregatesStatusBadge.tsx` | `pos-aggregates/components/` | |
| `SupplierStatusBadge.tsx` | `suppliers/components/` | |
| `SupplierTypeBadge.tsx` | `suppliers/components/` | |

Ditambah badge yang didefinisikan **inline** (tidak diekstrak ke file):
- `AssetStatusBadge` — di dalam `FixedAssetsPage.tsx`
- Status badge bank reconciliation — di dalam `BankMutationTable.tsx`
- Status badge di beberapa page pos-sync-aggregates, general-invoices, dll

**Struktur fisik berbeda-beda** antar badge:
- Sebagian pakai `rounded-full` (badge pill), sebagian `rounded-lg` (badge kotak)
- Padding bervariasi: `px-2 py-0.5`, `px-2.5 py-0.5`, `px-2.5 py-1`
- Sebagian punya icon, sebagian tidak
- Sebagian punya dark mode, sebagian tidak (terutama yang inline)

### h. Currency / Number Formatted Input

Tidak ada `CurrencyInput` component. Feature yang butuh input currency menggunakan `<input type="number">` atau `<input type="text">` biasa, tanpa formatting real-time. Format hanya diterapkan pada **display/output**, bukan pada input itu sendiri.

Fungsi format yang ada (masing-masing berdiri sendiri):
- `fmtCurrency` — didefinisikan inline di `PettyCashListPage.tsx`, `FixedAssetsPage.tsx`, dll (definisi tersebar, tidak shared)
- `formatCurrency` — di `bank-reconciliation/utils/reconciliation.utils.ts`
- `formatRupiah` — di `general-invoices/constants.ts`
- `formatCurrency` — di `bank-statement-import/utils/format.ts`
- `formatCurrency` — di `marketplace-po/utils/format.ts`
- `formatCurrency` — di `pos-imports/utils/format.ts`
- `formatCurrency` — di `pricelists/utils/format.ts`
- `formatCurrency` — di `supplier-products/utils/format.ts`

Total **97 file** mengandung logika format IDR/currency.

### i. Page Header (Judul + Breadcrumb + Action Button)

Tidak ada `PageHeader` component. Setiap page mendefinisikan header-nya sendiri. Ada dua pola visual utama yang sering diulang:

**Pola 1 — Minimal (Petty Cash, kebanyakan modul baru):**
```tsx
<div className="flex items-center justify-between">
  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Judul</h1>
  <button className="... bg-blue-600 ...">Aksi</button>
</div>
```

**Pola 2 — Icon + Subtitle (Fixed Assets, beberapa modul accounting):**
```tsx
<div className="bg-white dark:bg-gray-800 border-b px-6 py-5">
  <div className="flex items-center gap-4">
    <div className="p-2.5 bg-blue-50 rounded-xl"><Icon /></div>
    <div>
      <h1 className="text-xl font-bold">Judul</h1>
      <p className="text-sm text-gray-500">subtitle</p>
    </div>
  </div>
</div>
```

Tidak ada breadcrumb di halaman manapun yang ditemukan.

### j. Sidebar Navigation / App Shell Layout

**Sudah terpusat** di `components/layout/`:
- `Layout.tsx` — app shell dengan sticky header, collapsible sidebar, main content outlet
- `Sidebar.tsx` — sidebar dengan collapse support
- `MenuItem.tsx` — item menu dengan icon, label, active state
- `menu.config.tsx` — konfigurasi menu tree

Ini adalah salah satu area yang **sudah konsisten** — semua page memakai Layout yang sama.

---

## 4. Dependency yang Sudah Terpasang

### Dari `package.json`

```json
"dependencies": {
  "@hookform/resolvers": "^5.2.2",
  "@tanstack/react-query": "^5.90.20",
  "axios": "^1.13.2",
  "date-fns": "^4.1.0",
  "framer-motion": "^12.38.0",
  "jspdf": "^4.2.1",
  "jspdf-autotable": "^5.0.7",
  "leaflet": "^1.9.4",
  "lucide-react": "^0.561.0",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-hook-form": "^7.68.0",
  "react-leaflet": "^5.0.0",
  "recharts": "^2.15.4",
  "socket.io-client": "^4.8.3",
  "xlsx": "^0.18.5",
  "zustand": "^5.0.9"
}
```

**Tidak ada UI component library** (tidak ada MUI, Ant Design, Radix UI, Headless UI, shadcn/ui, Chakra UI, dll). Semua komponen dibangun sendiri di atas Tailwind.

### Potensi Dependency Underused

| Package | Diinstall | Penggunaan |
|---|---|---|
| `framer-motion` | Ya | Kemungkinan hanya beberapa animasi — perlu evaluasi apakah worth 40KB+ bundle |
| `jspdf` + `jspdf-autotable` | Ya | Untuk fitur print/PDF — kemungkinan dipakai di beberapa modul saja |
| `react-leaflet` + `leaflet` | Ya | Untuk map — kemungkinan hanya di dashboard atau lokasi cabang |
| `recharts` | Ya | Chart di dashboard/reporting — likely dipakai |
| `socket.io-client` | Ya | Real-time notifications — likely dipakai |

> **Catatan:** Tidak ada dead dependency yang bisa dipastikan tanpa grep yang lebih dalam — semua listed packages memiliki use case yang masuk akal untuk ERP ini.

---

## 5. Inkonsistensi Visual yang Terlihat dari Kode

### Warna Hardcode yang Ditemukan

**Auth pages + Logo** (tersentralisasi, dapat diterima sebagai brand identity):
- `#C53030` (35x) — merah tua, brand primary untuk auth
- `#D4A843` / `#E4B853` (27x / 5x) — emas, brand secondary untuk auth
- `#1A1018`, `#1E1215`, `#2D1B1B` (17x, 9x, 6x) — near-black dark backgrounds untuk auth

**AP Payments** (terlokalisasi dalam `ap-payments.theme.ts` dan beberapa komponen):
- `#fff9f7`, `#fef8f6`, `#faf4f0`, `#fdf0f4` — cream/pink backgrounds
- Semua terlokalisasi di `ap-payments/`, bukan leak ke modul lain

**Scattered** (potensi masalah):
- `#dc2626`, `#ef4444`, `#e11d48` — tiga cara menulis "merah error" yang berbeda
- `#d97706`, `#eab308`, `#f97316` — tiga cara menulis "warning/orange" yang berbeda
- `#6366f1`, `#64748b` — purple dan slate-gray yang muncul di beberapa tempat

### Inkonsistensi Border Radius

Dua "gaya" border radius dipakai di feature yang berbeda (dan kadang dalam satu feature):
- **`rounded-lg`** (8px) — gaya default, mayoritas modul
- **`rounded-2xl`** (16px) — gaya AP Payments, dan "merembes" ke general-invoices dan beberapa komponen lain

### Inkonsistensi Padding Modal

Modal diimplementasikan dengan bermacam padding:
- `p-4` (petty cash modals)
- `p-6` (ConfirmModal, bank reconciliation)
- `p-6 sm:p-8` (lib/tailwind-theme.ts recommendation)
- `p-5` (beberapa goods-processing modals)

### Inkonsistensi Input Border Color

Dua varian sering tertukar:
- `border-gray-200 dark:border-gray-700` — lebih banyak dipakai
- `border-gray-300 dark:border-gray-600` — Pagination dan beberapa filter

### Inkonsistensi Status Badge Shape

- Petty Cash, Bank Statement Import → `rounded-full` (pill)
- Fixed Assets, Accounting modules → `rounded-full` (pill)  
- AP Payments → `rounded-lg` (kotak)
- General Invoices inline badges → `rounded-full` dan `rounded` campur

---

## 6. Rekomendasi: 3 Komponen Paling Mendesak untuk Distandarisasi

### #1 — `<StatusBadge>` Generic (PRIORITAS TERTINGGI)

**Alasan:** 25 file Badge tersendiri + badge inline di puluhan file lain = komponen dengan **duplikasi paling tinggi** di seluruh codebase. Semua varian melakukan hal yang sama: memetakan string status ke warna + label.

**Scope minimum untuk shared component:**
```tsx
<StatusBadge 
  label="Aktif" 
  variant="success" | "warning" | "danger" | "info" | "neutral" | "purple"
  size="sm" | "md"
  icon={CheckCircle}  // optional
/>
```

Setelah shared component ini ada, semua badge domain-specific (`PettyCashStatusBadge`, `AssetStatusBadge`, dll) bisa menjadi thin wrapper yang hanya mendefinisikan mapping status → variant, dan tidak lagi duplikasi HTML/className.

---

### #2 — `<Modal>` / `<Dialog>` Primitive (PRIORITAS TINGGI)

**Alasan:** 67 file mengimplementasikan modal overlay sendiri. Ini bukan hanya duplikasi visual — ini adalah **duplikasi behavior**: keyboard Escape, body scroll lock, backdrop click-to-close, z-index management. Setiap implementasi berbeda tipis, menciptakan UX yang tidak konsisten (beberapa tidak lock scroll, beberapa tidak handle Escape, beberapa punya backdrop blur berbeda).

`ConfirmModal` yang sudah ada sudah handle ini dengan benar. Yang dibutuhkan adalah **Dialog primitive** yang bisa menerima arbitrary children:

```tsx
<Dialog isOpen={open} onClose={handleClose} size="md" | "lg" | "xl">
  <Dialog.Header>Judul Modal</Dialog.Header>
  <Dialog.Body>...konten apapun...</Dialog.Body>
  <Dialog.Footer>...action buttons...</Dialog.Footer>
</Dialog>
```

Ini akan mengurangi ~60 implementasi overlay manual menjadi reuse satu primitive.

---

### #3 — `formatIDR()` / `<CurrencyDisplay>` Shared Utility (PRIORITAS MENENGAH)

**Alasan:** 97 file mengandung logika format IDR/currency, dengan 7+ definisi fungsi yang secara esensial identik. Satu perubahan kebutuhan bisnis (misalnya: tampilkan sen, atau tambah currency code) membutuhkan update di puluhan tempat.

Ini bukan komponen UI, tapi **shared utility** yang paling mendesak karena ubiquity-nya:

```typescript
// lib/format.ts
export const formatIDR = (value: number | null | undefined, options?: {...}) => ...
export const formatIDRCompact = (value: number) => ...  // "Rp 1,2M"
```

Setelah utility ini ada, semua `fmtCurrency`, `formatRupiah`, `formatCurrency` di feature-level bisa dihapus dan diganti import dari satu tempat.

---

*End of audit. Tidak ada file yang diubah dalam proses ini.*
