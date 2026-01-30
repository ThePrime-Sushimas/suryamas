# Error Messages Improvement Plan - Bank Statement Import

## Tujuan
Memperbaiki error messages agar lebih user-friendly, konsisten, dan sesuai UI/UX best practices.

---

## ANALISIS MASALAH

### 1. Backend Issues (bank-statement-import.errors.ts)
| Error Code | Current Message | Masalah |
|------------|-----------------|---------|
| BS_FILE_TOO_LARGE | "File too large. Maximum size is 50MB" | English only, tidak ada guidance |
| BS_INVALID_FILE_TYPE | "Invalid file type. Please upload Excel file" | English, tidak sebut format CSV |
| BS_NO_FILE_UPLOADED | "No file uploaded" | Terlalu teknis |
| BS_CREATE_FAILED | "Failed to create bank statement import" | Terlalu generik |
| BS_UPDATE_FAILED | "Failed to update bank statement import" | Terlalu generik |
| BS_DELETE_FAILED | "Failed to delete bank statement import" | Terlalu generik |
| BS_IMPORT_FAILED | "Failed to import bank statements" | Terlalu generik |
| BS_PROCESSING_FAILED | "Import processing failed" | English, tidak spesifik |
| BS_INVALID_STATUS_TRANSITION | "Cannot transition from X to Y" | English, teknis |
| Missing Validation | Tidak ada error untuk branch context | |
| Missing Validation | Tidak ada error untuk empty file selection | |

### 2. Frontend Issues (UI Components)

#### UploadModal.tsx
| Current Message | Masalah |
|-----------------|---------|
| "File harus berupa Excel (.xlsx, .xls) atau CSV (.csv)" | ✅ Baik |
| "Ukuran file maksimal 50MB" | ✅ Baik |
| "File tidak boleh kosong" | ✅ Baik |
| "Pilih file dan akun bank terlebih dahulu" | ✅ Baik |
| "Company belum dipilih" | ⚠️ Tidak ada action guidance |
| "Gagal mengupload file" | ⚠️ Terlalu generik, tidak spesifik |

#### BankStatementImportListPage.tsx
| Current Message | Masalah |
|-----------------|---------|
| "Error" (title) + error message | ⚠️ Title terlalu generik, tidak spesifik error type |

#### BankStatementImportDetailPage.tsx
| Current Message | Masalah |
|-----------------|---------|
| "ID tidak valid" | ⚠️ Tidak ada solusi |
| "Gagal memuat data" | ⚠️ Terlalu generik |
| "Gagal memulai import" | ⚠️ Terlalu generik |
| "Error Import" (title) | ⚠️ Title bisa lebih spesifik |

#### Store (bank-statement-import.store.ts)
| Current Message | Masalah |
|-----------------|---------|
| "Terjadi kesalahan pada server" | ⚠️ English dalam helper function |
| "Terjadi kesalahan yang tidak diketahui" | ⚠️ English |
| "Silakan pilih branch terlebih dahulu" | ⚠️ English code |

---

## SOLUSI

### 1. Backend - Tambah Error Messages Berbahasa Indonesia + English

### 2. Frontend - Perbaiki Error Messages

#### Kategori Error:
1. **Validation Errors** - Input tidak valid
2. **Network Errors** - Koneksi bermasalah
3. **Server Errors** - Server error
4. **Permission Errors** - Akses ditolak
5. **Business Logic Errors** - Aturan bisnis dilanggar

---

## FILE YANG AKAN DIEDIT

### 1. Backend
- `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.errors.ts`

### 2. Frontend
- `frontend/src/features/bank-statement-import/store/bank-statement-import.store.ts`
- `frontend/src/features/bank-statement-import/components/UploadModal.tsx`
- `frontend/src/features/bank-statement-import/pages/BankStatementImportListPage.tsx`
- `frontend/src/features/bank-statement-import/pages/BankStatementImportDetailPage.tsx`
- `frontend/src/features/bank-statement-import/components/ImportProgressCard.tsx`

---

## PRIORITAS PERBAIKAN

### High Priority (Wajib)
1. Konsistensi bahasa Indonesia di semua error messages
2. Tambah action guidance di error messages
3. Error messages lebih spesifik dan actionable

### Medium Priority
1. Support dual language (ID + EN) untuk backward compatibility
2. Error codes yang lebih jelas
3. Debug info untuk developer

### Low Priority
1. Error recovery suggestions
2. Error analytics/tracking

