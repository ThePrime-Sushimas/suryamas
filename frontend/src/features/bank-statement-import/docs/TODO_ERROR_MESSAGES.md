# TODO: Error Messages Improvement

## Progress: [████████████████] 100% ✅ COMPLETE

### Phase 1: Backend Errors ✅ COMPLETE
- [x] 1.1 Edit bank-statement-import.errors.ts
  - [x] Tambah pesan error bahasa Indonesia
  - [x] Support dual language (ID + EN) via context
  - [x] Tambah error codes baru untuk branch validation
  - [x] Tambah action guidance di setiap error
  - [x] Tambah utility functions (getUserFriendlyErrorMessage, getErrorCode, isErrorRetryable, getErrorRecoverySuggestion)

### Phase 2: Frontend Store ✅ COMPLETE
- [x] 2.1 Edit bank-statement-import.store.ts
  - [x] Perbaiki getErrorMessage() helper dengan ERROR_MAPPINGS
  - [x] Tambah 30+ error mappings untuk user-friendly messages
  - [x] Support untuk context.userMessage dari backend

### Phase 3: Frontend UI Components ✅ COMPLETE
- [x] 3.1 Edit UploadModal.tsx
  - [x] Tambah Error Guidance section dengan tips spesifik
  - [x] Dynamic tips berdasarkan error type
- [x] 3.2 Edit BankStatementImportListPage.tsx
  - [x] Error display dengan title "Terjadi Kesalahan"
  - [x] Tambah action buttons (Tutup, Coba Lagi)
  - [x] Debug info untuk development
- [x] 3.3 Edit BankStatementImportDetailPage.tsx
  - [x] Enhanced error display dengan recovery suggestions
  - [x] Tambah failed count display
  - [x] Action buttons (Kembali, Coba Lagi)
- [x] 3.4 Edit ImportProgressCard.tsx
  - [x] Enhanced error display dengan retry button
  - [x] Tampilkan jumlah baris gagal

### Phase 4: UI/UX Standards ✅ COMPLETE
- [x] Semua error messages dalam bahasa Indonesia
- [x] Konsistensi format: Title + Message + Action
- [x] Dark mode support untuk semua error displays
- [x] Actionable guidance di setiap error
- [x] User-friendly error titles (bukan "Error" tapi spesifik)

---

## Files Modified

### Backend
- `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.errors.ts`

### Frontend
- `frontend/src/features/bank-statement-import/store/bank-statement-import.store.ts`
- `frontend/src/features/bank-statement-import/components/UploadModal.tsx`
- `frontend/src/features/bank-statement-import/pages/BankStatementImportListPage.tsx`
- `frontend/src/features/bank-statement-import/pages/BankStatementImportDetailPage.tsx`
- `frontend/src/features/bank-statement-import/components/ImportProgressCard.tsx`

---

## Error Message Examples

### Before:
```
Error
Gagal memuat data
```

### After:
```
Terjadi Kesalahan
Gagal memuat data. Silakan refresh halaman atau coba lagi.

[Tutup] [Coba Lagi]
```

### Before:
```
Error Import
File terlalu besar
```

### After:
```
Import Gagal
Ukuran file terlalu besar. Maksimal ukuran file adalah 50MB. Silakan kompres file atau gunakan file yang lebih kecil.

Tips:
• Kompres file menggunakan WinZip atau similar
• Bagi file besar menjadi beberapa bagian

[Coba Lagi]
```

---

## Notes
- Menggunakan bahasa Indonesia yang baik dan benar
- Konsistensi format: Title + Message + Action
- Support dark mode untuk semua UI
- Actionable guidance untuk setiap error type

