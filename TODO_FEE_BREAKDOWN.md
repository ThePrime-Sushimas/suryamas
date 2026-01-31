# TODO: Tambah Kolom Bill After Discount dan Net Amount

## Ringkasan
Menambahkan kolom `bill_after_discount` dan `net_amount` untuk pemisahan perhitungan fee.

## Formula
- **Bill After Discount** = subtotal + tax - discount (SEBELUM potong fee)
- **Net Amount** = bill_after_discount - fee% - fixed_fee (SESUDAH potong fee)

## Perubahan yang Diperlukan

### 1. Backend - Types (`pos-aggregates.types.ts`) ✅
- [x] Tambah field `bill_after_discount` di interface `AggregatedTransaction`
- [x] Update `AggregatedTransactionListItem`
- [x] Update `AggregatedTransactionWithDetails`
- [x] Update `CreateAggregatedTransactionDto`
- [x] Update `UpdateAggregatedTransactionDto`
- [x] Update `AggregatedTransactionSummary` (total_bill_after_discount, total_net_amount)

### 2. Backend - Migration (`20250120000000_add_bill_after_discount_column.sql`) ✅
- [x] Tambah migration untuk kolom `bill_after_discount`
- [x] Rename column `nett_amount` ke `net_amount`

### 3. Backend - Processor (`pos-aggregates.processor.ts`) ✅
- [x] Update perhitungan: simpan `bill_after_discount` sebelum potong fee
- [x] Update `net_amount` calculation
- [x] Update log calculations
- [x] Update failed transaction data structures

### 4. Backend - Service (`pos-aggregates.service.ts`) ✅
- [x] Update method `toInsertData()` untuk hitung `bill_after_discount` dan `net_amount`
- [x] Update fee calculation logic
- [x] Update `updateTransaction()` method

### 5. Backend - Repository (`pos-aggregates.repository.ts`) ✅
- [x] Update query select untuk `bill_after_discount` dan `net_amount`
- [x] Update mapping di `mapToListItem()` dan `mapToWithDetails()`
- [x] Update `getSummary()` return type dan calculations

### 6. Frontend - Types (`frontend/src/features/pos-aggregates/types.ts`) ✅
- [x] Update `AggregatedTransaction` interface
- [x] Update `AggregatedTransactionListItem`
- [x] Update `CreateAggregatedTransactionDto`
- [x] Update `UpdateAggregatedTransactionDto`
- [x] Update `AggregatedTransactionSummary`
- [x] Update `AggregatedTransactionSortParams`

### 7. Frontend - Table (`PosAggregatesTable.tsx`) ✅
- [x] Kolom "Bill After Discount" sudah ada (setelah Discount)
- [x] Kolom "Net Amount" (sebelumnya "Nett Amount")

### 8. Frontend - Bank Reconciliation (`bank-reconciliation.types.ts`) ✅
- [x] Update `PotentialMatch` interface (nett_amount → net_amount)
- [x] Update `BankStatementWithMatch` interface (nett_amount → net_amount)

### 9. Frontend - Bank Reconciliation Pages & Components ✅
- [x] `BankReconciliationPage.tsx` - Update nett_amount → net_amount
- [x] `BankMutationTable.tsx` - Update nett_amount → net_amount
- [x] `ManualMatchModal.tsx` - Update nett_amount → net_amount

## Status: SELESAI ✅

Semua perubahan telah diimplementasikan. Migration perlu dijalankan di database:

```bash
# Jalankan migration
psql -f backend/src/migrations/20250120000000_add_bill_after_discount_column.sql
```

Atau melalui Supabase SQL Editor.

### Kolom di Tabel Frontend (POS Aggregates)
| Kolom | Keterangan |
|-------|------------|
| Sub Total | subtotal |
| Tax | + tax |
| Discount | - discount |
| Bill After Discount | subtotal + tax - discount |
| Fee (%) | - fee% |
| Fixed Fee | - fixed fee |
| Total Fee | -(fee% + fixed fee) |
| Net Amount | bill_after_discount - total_fee |

### Kolom di Tabel Bank Reconciliation
| Kolom | Keterangan |
|-------|------------|
| POS Match | Mengambil data dari `aggregated_transactions.net_amount` |
