# TODO: Perbaikan Filter Akun Bank Tidak Muncul

## Analisis Masalah

**Gejala:** Filter dropdown akun bank tidak muncul di halaman Bank Reconciliation.

**Penyebab Akar Masalah:**
1. Data `bankAccounts` hanya diambil saat `fetchSummary` dipanggil dengan `startDate` dan `endDate`
2. Di halaman awal, pengguna harus memasukkan tanggal terlebih dahulu baru klik "Terapkan Filter"
3. Endpoint `GET /bank-accounts/status` memerlukan parameter `startDate` dan `endDate`
4. Tanpa tanggal, endpoint mengembalikan array kosong `[]`

## Rencana Perbaikan

### 1. Backend - Tambah Endpoint untuk Ambil Semua Bank Accounts

**File:** `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.routes.ts`
- Tambah route baru: `GET /bank-accounts/all` - tanpa filter tanggal

**File:** `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.controller.ts`
- Tambah method `getBankAccountsAll()` untuk mengambil semua akun bank

**File:** `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.service.ts`
- Tambah method `getBankAccountsAll()` yang tidak memerlukan tanggal

### 2. Backend - Repository

**File:** `backend/src/modules/reconciliation/bank-reconciliation/bank-reconciliation.repository.ts`
- Tambah method query untuk ambil semua bank accounts dengan join banks

### 3. Frontend - API Layer

**File:** `frontend/src/features/bank-reconciliation/api/bank-reconciliation.api.ts`
- Tambah function `getAllBankAccounts()`

### 4. Frontend - Hook

**File:** `frontend/src/features/bank-reconciliation/hooks/useBankReconciliation.ts`
- Tambah function `fetchAllBankAccounts()` yang dipanggil saat inisialisasi

## Langkah Implementasi

- [ ] 1. Tambah route `/bank-accounts/all` di backend
- [ ] 2. Tambah method di controller dan service
- [ ] 3. Tambah method di repository
- [ ] 4. Tambah API function di frontend
- [ ] 5. Update hook untuk fetch bank accounts saat mount
- [ ] 6. Test aplikasi

