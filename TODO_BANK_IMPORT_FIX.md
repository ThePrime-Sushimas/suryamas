# TODO: Perbaikan UI/UX dan Error Handling Bank Statement Import

## 1. Perbaikan UI/UX BankStatementImportPage
- [ ] Redesain halaman mengikuti pola JournalHeadersListPage
- [ ] Tambahkan search input dengan quick filters (Hari Ini, Minggu Ini, Bulan Ini)
- [ ] Perbaiki filter panel dengan expand/collapse
- [ ] Perbaiki table styling mengikuti JournalHeaderTable
- [ ] Tambahkan pagination yang konsisten

## 2. Perbaikan Komponen Pendukung
- [ ] Redesain UploadModal mengikuti pola modal yang konsisten
- [ ] Redesain AnalysisModal dengan layout yang lebih baik
- [ ] Redesain ImportProgress component
- [ ] Redesain BankStatementImportTable

## 3. Perbaikan Error Handling
- [ ] Perbaiki axios interceptor untuk return proper error
- [ ] Tambahkan proper error handling di store menggunakan axios.isAxiosError()
- [ ] Perbaiki ErrorBoundary untuk menangkap async errors

## 4. Penghapusan File yang Tidak Diperlukan
- [ ] Hapus file duplikat jika ada
- [ ] Bersihkan imports yang tidak digunakan

