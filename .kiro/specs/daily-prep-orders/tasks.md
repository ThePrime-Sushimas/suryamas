# Daily Prep Orders — Implementation Plan

## Wave 1 — Foundation (sequential, no dependencies)

- [x] 1. Buat `dpo.types.ts`
  - Definisikan semua interface dan type sesuai design.md bagian "Tipe Data"
  - Export `DpoStatus`, `DailyPrepOrderWithRelations`, `DailyPrepOrderLineWithRelations`,
    `DailyPrepOrderDetail`, `DpoForecastConfig`, `PublicHoliday`, `PaginatedResponse`
  - **Output:** `src/modules/daily-prep-orders/types/dpo.types.ts`

- [x] 2. Buat `dpo.api.ts`
  - Implementasikan semua fungsi API sesuai design.md bagian "API Layer"
  - Gunakan axios instance yang sudah ada di project (sesuaikan import path)
  - Semua fungsi harus typed — tidak ada `any`
  - **Output:** `src/modules/daily-prep-orders/api/dpo.api.ts`

- [x] 3. Buat `dpo.queries.ts`
  - Implementasikan `dpoKeys` query key factory sesuai design.md
  - Buat hooks: `useDpoList`, `useDpoDetail`, `useGenerateDpo`, `useUpdateDpoLines`,
    `useDeleteDpoLine`, `useAcquireLock`, `useConfirmDpo`, `useCancelDpo`, `useSoftDeleteDpo`,
    `useForecastConfig`, `useUpsertForecastConfig`, `useHolidays`,
    `useUpsertHoliday`, `useDeleteHoliday`
  - Setelah setiap mutasi sukses: invalidate query keys yang relevan
  - **Output:** `src/modules/daily-prep-orders/api/dpo.queries.ts`

---

## Wave 2 — Shared Components (dapat dikerjakan paralel)

- [x] 4. Buat `DpoStatusBadge.tsx`
  - Props: `status: DpoStatus`
  - DRAFT → Badge kuning
  - CONFIRMED → Badge hijau
  - CANCELLED → Badge abu-abu
  - **Output:** `src/modules/daily-prep-orders/components/DpoStatusBadge.tsx`

- [x] 5. Buat `DpoCancelDialog.tsx`
  - Props: `dpoId: string`, `open: boolean`, `onOpenChange: (open: boolean) => void`
  - Form dengan field `reason` (required, max 255 char)
  - Validasi menggunakan zod `cancelSchema` dari design.md
  - Submit memanggil `useCancelDpo` hook
  - **Output:** `src/modules/daily-prep-orders/components/DpoCancelDialog.tsx`

- [x] 6. Buat `DpoDeleteDialog.tsx`
  - Props: `dpoId: string`, `open: boolean`, `onOpenChange`,
    `onSuccess: () => void`
  - Konfirmasi sederhana tanpa input
  - Submit memanggil `useSoftDeleteDpo` hook
  - Setelah sukses: panggil `onSuccess` (caller akan redirect ke list)
  - **Output:** `src/modules/daily-prep-orders/components/DpoDeleteDialog.tsx`

---

## Wave 3 — List Page (depends on Wave 1, 2)

- [x] 7. Buat `DpoListPage.tsx`
  - Filter: branch_id (Select), status (Select), date_from & date_to (DatePicker)
  - Tabel dengan kolom: DPO Number, Branch, Prep Date, Status (DpoStatusBadge),
    Line Count, Confirmed By, Created At, Actions
  - Actions per row: "Lihat" (link ke detail), "Cancel" (buka DpoCancelDialog, DRAFT only),
    "Hapus" (buka DpoDeleteDialog, DRAFT only)
  - Tombol "Generate DPO" di header halaman → buka DpoGenerateDialog
  - Pagination menggunakan state `page` + `limit`
  - Gunakan `useDpoList` hook
  - **Output:** `src/modules/daily-prep-orders/pages/DpoListPage.tsx`

- [x] 8. Buat `DpoGenerateDialog.tsx`
  - Props: `open: boolean`, `onOpenChange: (open: boolean) => void`
  - Fields: Branch (Select), Prep Date (DatePicker), Source Warehouse (Select),
    Target Warehouse (Select), Notes (Textarea)
  - Validasi dengan zod `generateSchema` dari design.md
  - Sebelum submit: cek apakah sudah ada DRAFT untuk branch+date yang dipilih
    menggunakan `useDpoList` dengan filter. Jika ada, tampilkan warning text di bawah form.
  - Submit memanggil `useGenerateDpo` hook, redirect ke `/daily-prep-orders/:id` on success
  - **Output:** `src/modules/daily-prep-orders/components/DpoGenerateDialog.tsx`

---

## Wave 4 — Detail Page Components (dapat dikerjakan paralel, depends on Wave 1)

- [x] 9. Buat `DpoLinesTable.tsx`
  - Props: `dpo: DailyPrepOrderDetail`, `readOnly?: boolean`
  - Implementasikan dirty state tracking dengan `useState<Record<string, LineEdit>>`
    sesuai design.md bagian "Komponen: DpoLinesTable"
  - Tampilkan stock change indicator: jika `live_ready_stock !== current_ready_stock`
    tampilkan badge/icon + Tooltip "Stok bergerak sejak DPO di-generate"
  - Tampilkan "Simpan Perubahan" button hanya jika `isDirty === true`
  - Submit memanggil `useUpdateDpoLines` dengan hanya lines yang dirty
  - Delete line: tampilkan tombol hapus di setiap row (DRAFT only), konfirmasi inline
    atau mini dialog, panggil `useDeleteDpoLine`
  - **Output:** `src/modules/daily-prep-orders/components/DpoLinesTable.tsx`

- [x] 10. Buat `DpoConfirmDialog.tsx`
  - Props: `dpo: DailyPrepOrderDetail`, `open: boolean`, `onOpenChange`
  - Implementasikan countdown timer logic sesuai design.md bagian "Komponen: DpoConfirmDialog"
  - Saat dialog dibuka: panggil `useAcquireLock`, simpan `lock_token` di state,
    mulai countdown 300 detik
  - Tampilkan countdown timer (format mm:ss) di header dialog
  - Saat countdown habis: disable confirm button, tampilkan pesan expired + tombol "Muat Ulang"
  - "Muat Ulang" memanggil acquire-lock ulang dan reset countdown
  - Summary table: tampilkan lines dengan `confirmed_qty > 0`
  - Submit memanggil `useConfirmDpo` dengan `lock_token` dari state
  - Error handling sesuai tabel di design.md bagian "Error Handling"
  - **Output:** `src/modules/daily-prep-orders/components/DpoConfirmDialog.tsx`

---

## Wave 5 — Detail Page (depends on Wave 4)

- [x] 11. Buat `DpoDetailPage.tsx`
  - Gunakan `useDpoDetail(id)` hook, handle loading/error states
  - Header section: DPO Number, Branch, Prep Date, Status (DpoStatusBadge),
    Source → Target Warehouse, Weights (7d/30d/DOW), Coverage Days
  - Holiday badge: jika `has_upcoming_holiday === true` tampilkan Alert/Badge
  - Status-conditional info:
    - CONFIRMED: tampilkan "Dikonfirmasi oleh {confirmed_by_name} pada {confirmed_at}"
    - CANCELLED: tampilkan "Dibatalkan: {cancel_reason} pada {cancelled_at}"
  - Action buttons sesuai state machine di requirements.md:
    - DRAFT: Simpan Perubahan (dari DpoLinesTable), Konfirmasi DPO, Cancel DPO, Hapus
    - CONFIRMED / CANCELLED: tidak ada action button
  - Render `DpoLinesTable` dengan prop `readOnly={dpo.status !== 'DRAFT'}`
  - Render `DpoConfirmDialog`, `DpoCancelDialog`, `DpoDeleteDialog` dengan state `open`
  - **Output:** `src/modules/daily-prep-orders/pages/DpoDetailPage.tsx`

---

## Wave 6 — Config & Holidays Pages (independen, depends on Wave 1)

- [x] 12. Buat `DpoConfigPage.tsx`
  - Select branch di bagian atas — saat branch dipilih, load config dengan `useForecastConfig`
  - Form fields: weight_7d, weight_30d, weight_dow (number input, step 0.01),
    coverage_days, holiday_factor, lookback_days_short, lookback_days_long
  - Realtime weight sum indicator:
    ```
    Total bobot: {sum.toFixed(2)}  [hijau jika = 1.00, merah jika tidak]
    ```
  - Disable Save button jika `Math.abs(sum - 1.0) >= 0.001`
  - Validasi dengan zod `forecastConfigSchema` dari design.md
  - Submit memanggil `useUpsertForecastConfig`
  - **Output:** `src/modules/daily-prep-orders/pages/DpoConfigPage.tsx`

- [x] 13. Buat `DpoHolidaysPage.tsx`
  - Filter tahun (Select atau number input) — default tahun berjalan
  - Tabel: Holiday Date, Holiday Name, Actions (Hapus)
  - Form tambah/edit di atas atau samping tabel:
    Fields: holiday_date (DatePicker), holiday_name (Input)
  - Submit memanggil `useUpsertHoliday`, refresh tabel on success
  - Tombol hapus: konfirmasi inline, memanggil `useDeleteHoliday`
  - **Output:** `src/modules/daily-prep-orders/pages/DpoHolidaysPage.tsx`

---

## Wave 7 — Routing & Integration

- [x] 14. Daftarkan routes di router project
  - `/daily-prep-orders` → `DpoListPage`
  - `/daily-prep-orders/:id` → `DpoDetailPage`
  - `/daily-prep-orders/config` → `DpoConfigPage`
  - `/daily-prep-orders/holidays` → `DpoHolidaysPage`
  - Pastikan route `/config` dan `/holidays` didaftarkan **sebelum** `/:id`
    untuk menghindari route conflict

- [x] 15. Tambahkan navigasi ke sidebar/menu
  - Entry: "Daily Prep Orders" dengan sub-items atau halaman-halaman terkait
  - Sesuaikan dengan struktur navigasi yang sudah ada di project
