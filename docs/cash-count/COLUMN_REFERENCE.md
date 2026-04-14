# Cash Count — Column Reference

## Table: `cash_counts`

| Kolom | Tipe | Nullable | Default | Deskripsi |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | Primary key |
| `company_id` | UUID | NO | - | Tenant isolation |
| `start_date` | DATE | NO | - | Awal periode count |
| `end_date` | DATE | NO | - | Akhir periode count (>= start_date) |
| `branch_id` | UUID | YES | - | Cabang. NULL = semua. FK → branches |
| `payment_method_id` | INT | NO | - | Payment method (cash). FK → payment_methods → COA |
| `system_balance` | NUMERIC(18,2) | NO | 0 | Auto: SUM(nett_amount) dari aggregated_transactions |
| `transaction_count` | INT | NO | 0 | Auto: COUNT(*) transaksi di periode |
| `physical_count` | NUMERIC(18,2) | YES | - | Input user: jumlah uang fisik. NULL = OPEN |
| `difference` | NUMERIC(18,2) | - | GENERATED | physical_count - system_balance. (+) surplus, (-) deficit |
| `status` | VARCHAR(20) | NO | 'OPEN' | OPEN / COUNTED / DEPOSITED / CLOSED |
| `deposit_amount` | NUMERIC(18,2) | YES | - | Jumlah setor ke bank |
| `deposit_date` | DATE | YES | - | Tanggal setor |
| `deposit_bank_account_id` | INT | YES | - | Bank tujuan. FK → bank_accounts |
| `deposit_reference` | VARCHAR(100) | YES | - | Slip setoran |
| `responsible_employee_id` | UUID | YES | - | **Employee bertanggung jawab atas deficit.** FK → employees |
| `notes` | TEXT | YES | - | Catatan |
| `counted_by` | UUID | YES | - | User yang hitung fisik |
| `counted_at` | TIMESTAMPTZ | YES | - | Waktu hitung |
| `deposited_by` | UUID | YES | - | User yang setor |
| `deposited_at` | TIMESTAMPTZ | YES | - | Waktu setor |
| `closed_by` | UUID | YES | - | User yang close |
| `closed_at` | TIMESTAMPTZ | YES | - | Waktu close |
| `created_by` | UUID | YES | - | User pembuat |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Auto-update via trigger |
| `deleted_at` | TIMESTAMPTZ | YES | - | Soft delete |

## Table: `cash_count_details`

| Kolom | Tipe | Nullable | Default | Deskripsi |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `cash_count_id` | UUID | NO | - | FK → cash_counts (CASCADE delete) |
| `transaction_date` | DATE | NO | - | Tanggal transaksi (1 row per hari) |
| `amount` | NUMERIC(18,2) | NO | 0 | Penjualan cash di tanggal ini |
| `transaction_count` | INT | NO | 0 | Jumlah transaksi |
| `notes` | TEXT | YES | - | Catatan per hari |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |

## Constraints

| Constraint | Rule |
|---|---|
| Date range | `end_date >= start_date` |
| Status | Only `OPEN`, `COUNTED`, `DEPOSITED`, `CLOSED` |
| Amounts >= 0 | `system_balance`, `physical_count`, `deposit_amount` |
| Unique period | 1 cash count per (company, start, end, branch, payment_method) |

## Indexes

| Index | Kolom | Kondisi | Tujuan |
|---|---|---|---|
| `idx_cash_counts_company_period` | company_id, start_date, end_date | deleted_at IS NULL | Query utama |
| `idx_cash_counts_branch_pm` | branch_id, payment_method_id | deleted_at IS NULL | Filter dimensi |
| `idx_cash_counts_status` | company_id, status | deleted_at IS NULL | Filter status |
| `idx_cash_counts_deficit` | company_id, responsible_employee_id | deleted_at IS NULL | Accountability report |
| `uq_cash_counts_period_branch_pm` | company, start, end, branch, pm | deleted_at IS NULL | Unique constraint |
