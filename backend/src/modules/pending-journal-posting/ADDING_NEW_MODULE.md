# Menambah Module Baru ke Pending Journal Posting

Halaman "Pending Journal Posting" menampilkan record dari berbagai module yang sudah dibuat tapi journal-nya belum di-post. Jika ada module baru yang butuh manual journal posting, ikuti checklist ini.

## Safety Nets yang Aktif

- **Compile-time**: Kalau lupa langkah 2 (switch case), TypeScript akan error di `assertNever(module, ...)` — IDE langsung merah.
- **Runtime (startup)**: Kalau lupa langkah 2 tapi lolos compile (misal via `as any`), aplikasi CRASH saat startup dengan pesan: `Module 'xxx' ada di PENDING_POSTING_MODULES tapi belum ada di HANDLED_MODULES_IN_SWITCH`.
- **Runtime (request)**: Kalau value module datang dari external input yang tidak valid, `assertNever` di default case akan throw error.

## Checklist (WAJIB SEMUA, urutan penting)

### Backend (2 langkah)

#### Langkah 1: Tambah UNION segment di repository

File: `pending-journal-posting.repository.ts`

1. Tambah nama module di array `PENDING_POSTING_MODULES`:
   ```typescript
   export const PENDING_POSTING_MODULES = [
     // ... existing modules
     'new_module_name',  // ← tambah di sini
   ] as const
   ```

2. Tambah segment `UNION ALL` di method `getSummary()`:
   ```sql
   UNION ALL

   SELECT 'new_module_name', nm.amount_column
   FROM new_module_table nm
   WHERE nm.company_id = ANY($1::uuid[]) AND nm.status = 'PENDING_STATUS' AND nm.journal_id IS NULL
     AND nm.deleted_at IS NULL
     ${df('nm.date_column')} ${dt('nm.date_column')} ${bf('nm.branch_id')}
   ```

3. Tambah segment yang sama (dengan kolom lengkap) di method `findPendingRecords()`:
   ```sql
   if (!module || module === 'new_module_name') {
     segments.push(`
       SELECT nm.id, 'new_module_name'::text AS module, nm.ref_number_column AS ref_number,
              nm.date_column::text AS transaction_date, nm.amount_column::numeric AS amount,
              nm.status, nm.company_id, c.company_name, nm.branch_id, b.branch_name
       FROM new_module_table nm
       LEFT JOIN branches b ON b.id = nm.branch_id
       LEFT JOIN companies c ON c.id = nm.company_id
       WHERE nm.company_id = ANY($1::uuid[]) AND nm.status = 'PENDING_STATUS' AND nm.journal_id IS NULL
         AND nm.deleted_at IS NULL
         ${df('nm.date_column')} ${dt('nm.date_column')} ${bf('nm.branch_id')}
     `)
   }
   ```

#### Langkah 2: Tambah case di service switch + update HANDLED array

File: `pending-journal-posting.service.ts`

1. Import service module baru:
   ```typescript
   import { newModuleService } from '../new-module/new-module.service'
   ```

2. Tambah case di switch `postSingle()`:
   ```typescript
   case 'new_module_name':
     await newModuleService.postJournal(id, branchIds, userId)
     break
   ```

3. Tambah di array `HANDLED_MODULES_IN_SWITCH`:
   ```typescript
   const HANDLED_MODULES_IN_SWITCH = [
     // ... existing
     'new_module_name',  // ← tambah di sini
   ] as const satisfies readonly PendingModule[]
   ```

   > Kalau lupa langkah ini, aplikasi akan CRASH saat startup.

### Frontend (1 langkah — cuma 1 tempat)

#### Langkah 3: Tambah config di PENDING_MODULE_CONFIG

File: `features/pending-journal-posting/api/pendingJournalPosting.api.ts`

```typescript
export const PENDING_MODULE_CONFIG = {
  // ... existing
  new_module_name: { label: 'New Module Name', detailPath: '/path/to/detail' },
} as const
```

Selesai. `PendingModule` type, `MODULE_LABELS`, `MODULE_DETAIL_PATHS`, dan `VALID_MODULES` (di file filter) semua auto-derive dari config ini.

## Verifikasi

Setelah semua langkah selesai:
1. Pastikan `tsc --noEmit` TIDAK error (compile-time check)
2. Restart backend — pastikan tidak crash (runtime startup check)
3. Buka halaman Pending Journal Posting — pastikan module baru muncul di summary dan tabel (kalau ada data pending)
4. Klik "Post" pada record module baru — pastikan berhasil memanggil service yang benar
