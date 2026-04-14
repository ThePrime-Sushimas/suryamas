# Cash Count — Updated Structure

## ERD

```
cash_counts (per cabang per hari)
  │ N:1 (cash_deposit_id)
  ▼
cash_deposits (per setoran)
  │ 1:1 (bank_statement_id, saat reconcile)
  ▼
bank_statements (mutasi bank)
```

## Table: cash_counts (after migration)

| Kolom | Tipe | Deskripsi |
|---|---|---|
| id | UUID | PK |
| company_id | UUID | Tenant |
| start_date | DATE | = transaction_date (single day) |
| end_date | DATE | = transaction_date (single day) |
| branch_name | VARCHAR | Nama cabang |
| payment_method_id | INT | Payment method (cash) |
| system_balance | NUMERIC | Auto: SUM(nett_amount) dari aggregated_transactions |
| transaction_count | INT | COUNT transaksi |
| large_denomination | NUMERIC | Pecahan besar (100rb + 50rb) |
| small_denomination | NUMERIC | Pecahan kecil (sisanya) |
| physical_count | NUMERIC | = large + small (set by app) |
| difference | NUMERIC | GENERATED: physical - system |
| status | VARCHAR | OPEN / COUNTED / DEPOSITED / CLOSED |
| cash_deposit_id | UUID | FK → cash_deposits (diisi saat deposit) |
| responsible_employee_id | UUID | FK → employees (PIC deficit) |
| notes | TEXT | Catatan |
| counted_by | UUID | User yang hitung |
| counted_at | TIMESTAMPTZ | Waktu hitung |
| closed_by | UUID | User yang close |
| closed_at | TIMESTAMPTZ | Waktu close |
| created_by | UUID | User pembuat |
| created_at | TIMESTAMPTZ | - |
| updated_at | TIMESTAMPTZ | Auto-update |
| deleted_at | TIMESTAMPTZ | Soft delete |

**Dropped columns:** deposit_amount, deposit_date, deposit_bank_account_id, deposit_reference, deposited_by, deposited_at

**Dropped table:** cash_count_details

## Table: cash_deposits (NEW)

| Kolom | Tipe | Deskripsi |
|---|---|---|
| id | UUID | PK |
| company_id | UUID | Tenant |
| deposit_amount | NUMERIC | Total disetor = SUM(large_denomination) |
| deposit_date | DATE | Tanggal setor |
| bank_account_id | INT | Bank tujuan |
| reference | VARCHAR | Slip setoran |
| bank_statement_id | BIGINT | FK → bank_statements (saat reconcile) |
| status | VARCHAR | PENDING / RECONCILED |
| branch_name | VARCHAR | Cabang asal |
| payment_method_id | INT | Payment method |
| period_start | DATE | Tanggal awal cash counts |
| period_end | DATE | Tanggal akhir cash counts |
| item_count | INT | Jumlah cash_counts dalam deposit |
| notes | TEXT | Catatan |
| created_by | UUID | User |
| created_at | TIMESTAMPTZ | - |
| updated_at | TIMESTAMPTZ | Auto-update |
| deleted_at | TIMESTAMPTZ | Soft delete |

## Flow

```
OPEN → COUNTED → DEPOSITED → CLOSED

Step 1: Preview
  User pilih periode + payment method
  System tampilkan semua cabang x hari

Step 2: Count (OPEN → COUNTED)
  User input pecahan besar + kecil per row
  physical_count = large + small
  Jika deficit → wajib PIC

Step 3: Deposit (COUNTED → DEPOSITED)
  User pilih beberapa rows COUNTED (same branch)
  Buat cash_deposits record:
    deposit_amount = SUM(large_denomination)
    deposit_date, bank_account_id, reference
  Update cash_counts:
    status → DEPOSITED
    cash_deposit_id → link ke deposit

Step 4: Reconcile (DEPOSITED → CLOSED)
  Bank statement masuk di halaman Bank Reconciliation
  Match bank statement ↔ cash_deposit
  Update cash_deposits:
    status → RECONCILED
    bank_statement_id → link ke bank statement
  Update cash_counts:
    status → CLOSED
```
