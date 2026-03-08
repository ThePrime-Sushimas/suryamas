# TODO - Accounting Purpose Account Table UI/UX Update

## Task
Perubahan UI/UX pada AccountingPurposeAccountTable.tsx:
- Group by purpose (seperti Buku Besar Pembantu)
- Tampilan familiar untuk akuntan (mirip buku jurnal fisik)
- Kolom Debit/Kredit berdampingan

## Plan
- [x] Analisis file yang ada
- [x] Membuat rencana perubahan
- [x] Konfirmasi dengan user
- [ ] Implementasi UI/UX baru:
  - [ ] Grouping data berdasarkan purpose
  - [ ] Layout seperti buku besar/jurnal
  - [ ] Kolom Debit/Kredit berdampingan
  - [ ] Mempertahankan fitur yang ada (checkbox, edit, delete, sort)

## Status
Completed - UI/UX changes implemented

## Implementation Details
- Grouping data berdasarkan purpose_code dan purpose_name
- Layout seperti buku besar pembantu dengan header group yang jelas
- Kolom Debit/Kredit berdampingan dengan warna berbeda (biru untuk Debit, hijau untuk Kredit)
- Total per group purpose di footer tabel
- Mempertahankan fitur yang ada: checkbox, edit, delete, loading state
- Checkbox selection per group purpose
- Dark mode support

