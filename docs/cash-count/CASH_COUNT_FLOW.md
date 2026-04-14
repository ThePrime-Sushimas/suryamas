# Cash Count — Design Document (Simplified)

## Kenapa Bukan Settlement Group?

| Aspek | Settlement Group | Cash Count |
|---|---|---|
| **Arah** | 1 Bank Statement → N Aggregates | N Aggregates (periode) → 1 Physical Count |
| **Trigger** | Bank statement sudah masuk | User pilih periode, hitung fisik |
| **Granularity** | Per transaksi bank | Per **periode** (range tanggal) |
| **Perbandingan** | Bank amount vs total POS | System balance (POS) vs **hitung fisik** |
| **Waktu setor** | Uang sudah di bank | Uang cash belum disetor, kumpul dulu |
| **Accountability** | Tidak ada | **Ada** — deficit dipotong ke staff |

**Kesimpulan:** Beda konsep. Settlement = "uang sudah di bank, cocokkan". Cash count = "hitung fisik dulu, bandingkan, baru setor".

---

## Status Flow (4 Status)

```
OPEN → COUNTED → DEPOSITED → CLOSED
```

| Status | Trigger | Yang terjadi |
|---|---|---|
| **OPEN** | User buat cash count | System query `aggregated_transactions`, hitung `system_balance` |
| **COUNTED** | User input `physical_count` | `difference` otomatis dihitung. Jika deficit → isi `responsible_employee_id` |
| **DEPOSITED** | User catat setoran ke bank | `deposit_amount`, `deposit_date`, `deposit_bank_account_id` diisi |
| **CLOSED** | Bank statement match (via reconciliation) | Selesai. `closed_by`, `closed_at` diisi |

---

## Flow Detail

### Step 1: OPEN (Create)

```
Input:
  - branch_id (cabang mana)
  - payment_method_id (cash)
  - start_date, end_date (periode)

System auto-calculate:
  SELECT SUM(nett_amount), COUNT(*)
  FROM aggregated_transactions
  WHERE branch_id = :branch_id
    AND payment_method_id = :payment_method_id
    AND transaction_date BETWEEN :start_date AND :end_date
    AND deleted_at IS NULL

Output:
  - system_balance = 15.250.000
  - transaction_count = 327
  - status = OPEN
  - physical_count = NULL
  - difference = -15.250.000 (generated: 0 - 15.250.000)
```

Detail per hari disimpan di `cash_count_details` (breakdown).

### Step 2: COUNTED (Physical Count)

```
Input:
  - physical_count = 15.200.000
  - responsible_employee_id = [jika deficit]

Output:
  - difference = 15.200.000 - 15.250.000 = -50.000 (DEFICIT)
  - status = COUNTED
  - counted_by = [user ID]
  - counted_at = NOW()
```

**Accountability rule:**
- `difference < 0` (deficit) → **wajib** isi `responsible_employee_id`
- `difference >= 0` (surplus/balance) → `responsible_employee_id = NULL`

### Step 3: DEPOSITED (Setor ke Bank)

```
Input:
  - deposit_amount = 15.200.000
  - deposit_date = 2026-04-08
  - deposit_bank_account_id = [BCA account]
  - deposit_reference = "SLIP-20260408-001"

Output:
  - status = DEPOSITED
  - deposited_by = [user ID]
  - deposited_at = NOW()
```

`deposit_amount` bisa berbeda dari `physical_count` (misal ada pengeluaran kas kecil sebelum setor).

### Step 4: CLOSED (Reconcile)

Terjadi via flow bank reconciliation yang sudah ada:
1. Bank statement setoran masuk
2. Match bank statement ↔ deposit amount
3. Cash count status → CLOSED

```
Output:
  - status = CLOSED
  - closed_by = [user ID]
  - closed_at = NOW()
```

---

## Data Source

System balance diambil dari `aggregated_transactions`:

```sql
SELECT
  transaction_date,
  SUM(nett_amount) as daily_amount,
  COUNT(*) as daily_count
FROM aggregated_transactions
WHERE branch_id = :branch_id
  AND payment_method_id = :payment_method_id
  AND transaction_date BETWEEN :start_date AND :end_date
  AND deleted_at IS NULL
GROUP BY transaction_date
ORDER BY transaction_date;
```

Setiap row hasil query → 1 row di `cash_count_details`.
Total semua row → `cash_counts.system_balance`.

---

## COA Link

```
cash_counts.payment_method_id
  → payment_methods.id
    → payment_methods.coa_account_id          (akun kas - ASSET)
    → payment_methods.fee_coa_account_id      (akun fee - EXPENSE)
    → payment_methods.fee_liability_coa_account_id (akun fee liability)
```

---

## Accountability (Deficit)

Jika `difference < 0`:
- `responsible_employee_id` → FK ke `employees(id)`
- Deficit akan dipotong dari gaji staff

### Report: Deficit per Employee

```sql
SELECT
  e.full_name,
  e.employee_id,
  COUNT(*) as deficit_count,
  SUM(ABS(cc.difference)) as total_deficit
FROM cash_counts cc
JOIN employees e ON cc.responsible_employee_id = e.id
WHERE cc.company_id = :company_id
  AND cc.difference < 0
  AND cc.deleted_at IS NULL
GROUP BY e.id, e.full_name, e.employee_id
ORDER BY total_deficit DESC;
```

### Report: Deficit per Bulan (untuk potongan gaji)

```sql
SELECT
  cc.responsible_employee_id,
  e.full_name,
  SUM(ABS(cc.difference)) as total_potongan
FROM cash_counts cc
JOIN employees e ON cc.responsible_employee_id = e.id
WHERE cc.company_id = :company_id
  AND cc.difference < 0
  AND cc.status IN ('COUNTED', 'DEPOSITED', 'CLOSED')
  AND cc.start_date >= :month_start
  AND cc.end_date <= :month_end
  AND cc.deleted_at IS NULL
GROUP BY cc.responsible_employee_id, e.full_name;
```

---

## ERD

```
payment_methods ──┐
                  │ payment_method_id → coa_account_id
                  ▼
            cash_counts ◄──── cash_count_details
              │   │   │
              │   │   │ responsible_employee_id
              │   │   ▼
              │   │ employees
              │   │
              │   │ branch_id
              │   ▼
              │ branches
              │
              │ deposit_bank_account_id
              ▼
          bank_accounts
```

---

## Contoh Data

```
cash_counts:
┌──────────┬────────────┬────────────┬──────────────┬───────────────┬──────────────┬──────────┬─────────┐
│ start    │ end        │ branch     │ system_bal   │ physical      │ difference   │ status   │ employee│
├──────────┼────────────┼────────────┼──────────────┼───────────────┼──────────────┼──────────┼─────────┤
│ 01 Apr   │ 07 Apr     │ Sushimas HO│ 15.250.000   │ 15.200.000    │ -50.000      │ DEPOSITED│ Budi    │
│ 08 Apr   │ 14 Apr     │ Sushimas HO│ 12.800.000   │ 12.850.000    │ +50.000      │ COUNTED  │ NULL    │
│ 01 Apr   │ 07 Apr     │ Cabang A   │  8.500.000   │ NULL          │ -8.500.000   │ OPEN     │ NULL    │
└──────────┴────────────┴────────────┴──────────────┴───────────────┴──────────────┴──────────┴─────────┘

cash_count_details (untuk row pertama):
┌────────────┬───────────────┬───────┐
│ date       │ amount        │ count │
├────────────┼───────────────┼───────┤
│ 01 Apr     │ 2.100.000     │ 45    │
│ 02 Apr     │ 2.350.000     │ 52    │
│ 03 Apr     │ 1.900.000     │ 38    │
│ 04 Apr     │ 2.500.000     │ 55    │
│ 05 Apr     │ 2.200.000     │ 48    │
│ 06 Apr     │ 2.100.000     │ 43    │
│ 07 Apr     │ 2.100.000     │ 46    │
├────────────┼───────────────┼───────┤
│ TOTAL      │ 15.250.000    │ 327   │
└────────────┴───────────────┴───────┘
```
