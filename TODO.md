# TODO - Pos Aggregates Improvements

## Task: Ubah grouping aggregate & tambah filter

### Backend Changes
- [x] 1. Ubah grouping logic di `pos-aggregates.service.ts`
  - [x] Group by: `${sales_date}|${branch}|${payment_method}`
  - [x] source_ref: `${tanggal}-${cabang}-${metode}`
  - [x] SUM amounts per group
- [x] 2. Tambah filter array di `pos-aggregates.types.ts`
- [x] 3. Tambah filter array support di `pos-aggregates.repository.ts`
- [x] 4. Update `generateFromPosImportLines` untuk update status ke MAPPED setelah generate

### Frontend Changes
- [x] 5. Tambah filter Branch (checkbox) di `PosAggregatesFilters.tsx`
- [x] 6. Tambah filter Payment Method (checkbox) di `PosAggregatesFilters.tsx`
- [x] 7. Update API call untuk include filter params array
- [x] 8. Update types di frontend
- [x] 9. Tambah tombol "Generate dari Import" di halaman `/pos-aggregates`
- [x] 10. Tambah modal untuk input Import ID

## Notes
- Filter menggunakan checkbox (tick method) untuk branch dan payment method
- User bisa pilih multiple branches dan multiple payment methods
- Grouping baru: sales_date + branch + payment_method (bukan per bill)
- Tombol "Generate dari Import" sekarang ada di halaman `/pos-aggregates` (button biru dengan icon Database)
- Setelah generate, status pos-import akan diupdate ke MAPPED secara otomatis


