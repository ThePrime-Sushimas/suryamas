# TODO - Perbaikan Tipe Data Bank Statement Import

## Tujuan
Memperbaiki tipe data frontend agar sesuai dengan respons API backend.

## Perubahan yang Diperlukan

### 1. types/bank-statement-import.types.ts
- [x] Ubah `id` dari `string` ke `number`
- [x] Ubah `bank_account_id` dari `string` ke `number`
- [x] Tambahkan field `idx` sebagai `number | undefined`
- [x] Tambahkan field `job_id` sebagai `number | null | undefined`
- [x] Tambahkan field `analysis_data` sebagai `Record<string, unknown> | null | undefined`
- [x] Tambahkan field `error_details` sebagai `Record<string, unknown> | null | undefined`

### 2. store/bank-statement-import.store.ts
- [x] Update seleksi ID untuk menggunakan `number` bukan `string`
- [x] Ubah `selectedIds: Set<string>` ke `Set<number>`
- [x] Update fungsi cancelImport, retryImport, deleteImport

### 3. hooks/useBankStatementImport.ts
- [x] Update tipe data di return type
- [x] Update selectedIds ke `Set<number>`

### 4. api/bank-statement-import.api.ts
- [x] Update fungsi confirm, cancel, retry, delete, getById, getSummary

### 5. components/BankStatementImportPage.tsx
- [x] Update handleDelete untuk menerima `number`
- [x] Update showDeleteConfirmation ke `number | null`

## Status
- [x] Semua perubahan telah selesai
- [x] TypeScript check: Lolos tanpa error

