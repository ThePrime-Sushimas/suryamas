# TODO: Perbaikan Checkbox "Lewati Data Duplikat"

## Masalah
Checkbox "Lewati Data Duplikat" tidak bisa dicentang karena `duplicate_count` tidak dikirimkan dengan benar dari backend.

## Perubahan yang Dilakukan

### 1. Backend - Tipe Data ✅
**File:** `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.types.ts`

**Perubahan:**
- Menambahkan `duplicate_count?: number` ke interface `BankStatementAnalysis`

### 2. Backend - Service ✅
**File:** `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.service.ts`

**Perubahan:**
- Menambahkan `duplicate_count: duplicates.length` ke object `analysis` di method `analyzeFile`
- Memperbaiki `getImportSummary` untuk menghitung `duplicate_count` dari temporary data

### 3. Frontend - Tipe Data ✅
**File:** `frontend/src/features/bank-statement-import/types/bank-statement-import.types.ts`

**Perubahan:**
- Menambahkan `duplicate_count?: number` ke interface `BankStatementAnalysis`

### 4. Frontend - Component ✅
**File:** `frontend/src/features/bank-statement-import/components/AnalysisModal.tsx`

**Perubahan:**
- Memperbarui logika `duplicateCount` untuk menggunakan prioritas yang benar
- Menambahkan state internal `isProcessing` untuk mengelola loading state
- Tombol Batal dan X sekarang selalu bisa diklik (tidak disabled saat loading)
- Loading overlay sekarang menggunakan `isProcessing` dari component state

### 5. Frontend - Store ✅
**File:** `frontend/src/features/bank-statement-import/store/bank-statement-import.store.ts`

**Perubahan:**
- `confirmImport` sekarang membersihkan `analyzeResult` dan `currentImport` sebelum refresh list
- Ini memastikan modal tertutup setelah import berhasil

### 6. Frontend - Page ✅
**File:** `frontend/src/features/bank-statement-import/pages/BankStatementImportListPage.tsx`

**Perubahan:**
- Menghapus prop `isLoading` dari `AnalysisModal` karena sekarang dikelola secara internal

## Status
- [x] Menambahkan duplicate_count ke backend types
- [x] Mengirim duplicate_count dari backend service (upload endpoint)
- [x] Memperbaiki getImportSummary untuk menghitung duplicate_count
- [x] Menambahkan duplicate_count ke frontend types
- [x] Memperbarui frontend untuk menggunakan duplicate_count dengan prioritas yang benar
- [x] Memperbaiki modal agar bisa ditutup setelah import berhasil
- [x] Memperbaiki tombol Batal dan X agar selalu berfungsi

## Hasil
- Checkbox "Lewati Data Duplikat" sekarang bisa dicentang jika ada data duplikat
- Setelah import berhasil, modal akan tertutup secara otomatis
- Tombol Batal dan X berfungsi untuk menutup modal kapan saja

