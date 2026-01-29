# TODO: Fix Bank Statement Import Detail Page - Detail Baris

## Masalah
Di halaman detail import statement bank, data baris/preview tidak muncul meskipun data summary sudah dimuat.

## Penyebab
1. Backend endpoint `/bank-statement-imports/:id/summary` tidak mengembalikan field `preview`
2. Frontend mengharapkan `analysisResult.summary.preview` untuk menampilkan tabel

## Rencana Implementasi

### Backend Changes - ✅ SELESAI

#### 1. Modifikasi `bank-statement-import.service.ts`
- [x] Method `getImportSummary()`: Tambahkan field `preview` dari data analisis yang disimpan saat upload
- [x] Fallback: Jika temporary data tidak ada, ambil dari statements yang sudah import

#### 2. Endpoint preview sudah ada di routes
- [x] `/bank-statement-imports/:id/preview` sudah tersedia

### Frontend Changes - ✅ SELESAI

#### 1. Modifikasi `bank-statement-import.types.ts`
- [x] Update interface `BankStatementAnalysisResult` untuk menyertakan preview
- [x] Tambah interface `BankStatementPreviewRow`

#### 2. Modifikasi `bank-statement-import.api.ts`
- [x] Tambah function `getPreview()` sebagai fallback

#### 3. Modifikasi `BankStatementImportDetailPage.tsx`
- [x] Tambah state `previewRows` untuk menyimpan data preview
- [x] Fetch preview saat summary tidak punya preview
- [x] Tampilkan tabel "Pratinjau Data" dengan kolom yang benar (No, Tanggal, Keterangan, Debit, Kredit, Saldo)

## Alur Kerja Data Preview

1. Fetch `/bank-statement-imports/:id/summary`
2. Jika response punya `summary.preview`, gunakan itu
3. Jika tidak, fetch `/bank-statement-imports/:id/preview` sebagai fallback
4. Jika kedua-duanya tidak ada, tabel tidak ditampilkan

## Status: ✅ SELESAI

### Perubahan Files:
1. `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.service.ts`
2. `frontend/src/features/bank-statement-import/types/bank-statement-import.types.ts`
3. `frontend/src/features/bank-statement-import/api/bank-statement-import.api.ts`
4. `frontend/src/features/bank-statement-import/pages/BankStatementImportDetailPage.tsx`

