# Bank Statement CSV Parser - Test Samples

This directory contains sample CSV files untuk testing berbagai format bank statement:

## Files:

1. **sample_bca_business.csv** - BCA Bisnis format
   - Header: Tanggal Transaksi, Keterangan, Cabang, Jumlah
   - Amount dengan DB/CR indicator di akhir
   - Quoted fields

2. **sample_bca_personal.csv** - BCA Personal format
   - Header: Date, Description, Branch, Amount, , Balance
   - Leading single quote (`'`) pada date dan branch
   - CR/DB indicator di kolom terpisah

3. **sample_mandiri_cv.csv** - Bank Mandiri CV format
   - Header: Account No, Date, Val. Date, Transaction Code, Description, Description, Reference No., Debit, Credit
   - Multiple description columns
   - Separate Debit dan Credit columns

## Usage:

```typescript
import { bankStatementImportService } from './bank-statement-import'
import { BankStatementImportRepository } from './bank-statement-import.repository'

const service = bankStatementImportService(repository as BankStatementImportRepository)

// Parse CSV file
const result = await service.parseCSVFile('/path/to/file.csv')

console.log('Format:', result.formatDetection.format)
console.log('Confidence:', result.formatDetection.confidence + '%')
console.log('Total rows:', result.rows.length)
console.log('Pending transactions:', result.rows.filter(r => r.is_pending).length)

// Each row:
result.rows.forEach(row => {
  console.log({
    date: row.transaction_date,
    description: row.description,
    debit: row.debit_amount,
    credit: row.credit_amount,
    balance: row.balance,
    reference: row.reference_number
  })
})
```

## Format Detection:

Parser akan otomatis mendeteksi format berdasarkan:
- Header patterns
- Column count
- Content patterns (leading quotes, CR/DB indicators)

## Supported Formats:

| Format | Detection Criteria |
|--------|-------------------|
| BCA Personal | 7 columns, leading quote on date, CR/DB column |
| BCA Bisnis | 4-5 columns, quoted description, amount with DB/CR suffix |
| Bank Mandiri | 9 columns, Account No column, separate Debit/Credit columns |

## Column Mapping:

Parser menggunakan kombinasi header-based dan index-based mapping untuk handle mismatch antara header dan data columns.

