# Split Payment Support untuk POS Aggregates

## 📋 Latar Belakang

Saat ini model `aggregated_transactions` hanya mendukung **satu payment method** per transaksi:

```typescript
// Current Model (Single Payment)
interface AggregatedTransaction {
  payment_method_id: number  // Hanya satu
  net_amount: number         // Total bill
}
```

**Keterbatasan:**
- Jika customer bayar bill Rp 100,000 dengan split:
  - Cash: Rp 50,000
  - Credit Card: Rp 50,000
- Tidak bisa dimodelkan dengan current schema

---

## 🎯 Konsep Split Payment

### Definisi
**Split Payment** adalah pembayaran satu tagihan (bill) menggunakan **multiple payment methods**.

### Contoh Scenario
```
Bill Number: INV-2024-001
Total Bill: Rp 100,000

Split Payment:
├── Cash: Rp 30,000
├── Credit Card: Rp 50,000
└── Debit Card: Rp 20,000
────────────────────────────
Total: Rp 100,000 ✓
```

---

## 🔄 Model Data yang Direkomendasikan

### Option A: Separate Table (Recommended)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SPLIT PAYMENT DATA MODEL                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐
│  aggregated_transactions    │  (Parent - informasi bill)
├─────────────────────────────┤
│ id                          │
│ split_ref      ◄────────────┼──┐ Unique reference untuk group split
│ source_type                   │
│ source_id                     │
│ source_ref   (bill_number)    │
│ transaction_date              │
│ total_bill_amount             │  Total keseluruhan bill
│ currency                      │
│ status                        │
└─────────────────────────────┘
                                  │
                                  │ 1:N
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  aggregated_transaction_payments  (Child - per payment)     │
├─────────────────────────────────────────────────────────────┤
│ id                                                        │
│ aggregated_transaction_id  (FK ke parent)                 │
│ split_ref      (sama dengan parent, untuk query)          │
│ split_seq      (1, 2, 3... untuk urutan)                  │
│ payment_method_id                                        │
│ amount        (jumlah untuk payment ini)                  │
│ is_reconciled                                            │
│ reconciled_at                                            │
│ reconciled_by                                            │
└─────────────────────────────────────────────────────────────┘
```

### Option B: JSONB Column (Alternative)

```typescript
// Lebih simple, tapi kurang normalized

interface AggregatedTransaction {
  id: string
  split_ref: string
  source_ref: string
  transaction_date: string
  total_bill_amount: number
  
  // JSONB untuk split payments
  split_payments: Array<{
    payment_method_id: number
    amount: number
    is_reconciled?: boolean
    reconciled_at?: string
    reconciled_by?: string
  }>
  
  // Field lama (deprecated, untuk backward compatibility)
  payment_method_id?: number
  net_amount?: number
}
```

**Rekomendasi:** Option A (Separate Table) lebih baik untuk:
- Database normalization
- Query performance
- Flexibility untuk future enhancements
- Audit trail yang lebih baik

---

## 📊 Implementation Plan

### Step 1: Database Migration

```sql
-- 1. Rename/alter existing table (if keeping data)
ALTER TABLE aggregated_transactions 
  ADD COLUMN split_ref VARCHAR(50) DEFAULT NULL,
  ADD COLUMN split_seq INT DEFAULT NULL,
  ADD COLUMN split_amount DECIMAL(15,2) DEFAULT NULL;

-- 2. Create new split payments table
CREATE TABLE IF NOT EXISTS aggregated_transaction_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregated_transaction_id UUID NOT NULL REFERENCES aggregated_transactions(id) ON DELETE CASCADE,
  split_ref VARCHAR(50) NOT NULL,
  split_seq INT NOT NULL,
  payment_method_id INT NOT NULL REFERENCES payment_methods(id),
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'IDR',
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  reconciled_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID,
  
  CONSTRAINT chk_amount_positive CHECK (amount > 0),
  CONSTRAINT uq_split UNIQUE (split_ref, split_seq)
);

-- 3. Create indexes
CREATE INDEX idx_agg_tx_payments_split_ref ON aggregated_transaction_payments(split_ref);
CREATE INDEX idx_agg_tx_payments_tx_id ON aggregated_transaction_payments(aggregated_transaction_id);
CREATE INDEX idx_agg_tx_payments_pm ON aggregated_transaction_payments(payment_method_id);

-- 4. Add unique constraint for single payment (backward compatibility)
ALTER TABLE aggregated_transactions ADD CONSTRAINT uq_source_ref_single UNIQUE (source_type, source_ref) WHERE split_ref IS NULL;
```

### Step 2: TypeScript Types

```typescript
// backend/src/modules/pos-imports/pos-aggregates/pos-aggregates.types.ts

// Tambah interface baru
export interface AggregatedTransactionPayment {
  id: string
  aggregated_transaction_id: string
  split_ref: string
  split_seq: number
  payment_method_id: number
  amount: number
  currency: string
  is_reconciled: boolean
  reconciled_at: string | null
  reconciled_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
}

// Update parent interface
export interface AggregatedTransaction {
  id: string
  split_ref: string | null  // NULL jika single payment, populated jika split
  split_seq: number | null  // NULL jika single payment, 1,2,3 jika split
  split_amount: number | null // NULL jika single payment, partial amount jika split
  
  source_type: AggregatedTransactionSourceType
  source_id: string
  source_ref: string
  transaction_date: string
  
  // Field lama (deprecated, untuk backward compatibility)
  payment_method_id?: number
  net_amount?: number
  
  total_bill_amount: number  // Total keseluruhan bill
  currency: string
  
  journal_id: string | null
  is_reconciled: boolean
  status: AggregatedTransactionStatus
  
  // ... other fields
}

// Split payment DTO
export interface SplitPaymentDto {
  split_ref: string
  payments: Array<{
    payment_method_id: number | string
    amount: number
  }>
}
```

### Step 3: Service Layer Changes

```typescript
// backend/src/modules/pos-imports/pos-aggregates/pos-aggregates.service.ts

class PosAggregatesService {
  
  /**
   * Create aggregated transaction dengan split payment support
   */
  async createTransactionWithSplit(
    data: CreateAggregatedTransactionDto,
    splitPayments?: SplitPaymentDto['payments']
  ): Promise<{ parent: AggregatedTransaction; payments: AggregatedTransactionPayment[] }> {
    
    const splitRef = splitPayments 
      ? `${data.source_type}-${data.source_ref}-${Date.now()}`
      : null;

    // Create parent record
    const parent = await this.createParentTransaction(data, splitRef);

    if (splitPayments) {
      // Create child payment records
      const payments: AggregatedTransactionPayment[] = [];
      let totalSplitAmount = 0;

      for (let i = 0; i < splitPayments.length; i++) {
        const pmId = await this.resolvePaymentMethodId(splitPayments[i].payment_method_id);
        const amount = splitPayments[i].amount;
        totalSplitAmount += amount;

        const payment = await this.createPaymentRecord({
          aggregated_transaction_id: parent.id,
          split_ref: splitRef!,
          split_seq: i + 1,
          payment_method_id: pmId,
          amount: amount
        });
        payments.push(payment);
      }

      // Validate total matches
      if (totalSplitAmount !== data.net_amount) {
        throw new Error(`Split amount total (${totalSplitAmount}) does not match net_amount (${data.net_amount})`);
      }

      return { parent, payments };
    }

    // Single payment (backward compatibility)
    return { 
      parent, 
      payments: [] 
    };
  }

  /**
   * Get transaction dengan split payments
   */
  async getTransactionWithPayments(id: string) {
    const transaction = await this.getById(id);
    const payments = await this.getPaymentsByTransactionId(id);
    
    return {
      ...transaction,
      split_payments: payments,
      is_split: payments.length > 0
    };
  }

  /**
   * Generate journals untuk split payments
   * Satu bill dengan split payments = multiple journal lines (satu per payment method)
   */
  async generateJournalForSplitPayment(
    transactionId: string,
    companyId: string
  ): Promise<GenerateJournalResult> {
    const transaction = await this.getById(transactionId);
    const payments = await this.getPaymentsByTransactionId(transactionId);

    // Group payments by date/branch (sama seperti existing logic)
    const paymentsByDateBranch = this.groupPaymentsByDateBranch(payments);

    // Create journal header (satu header per bill)
    const journalHeader = await this.createJournalHeader({
      companyId,
      branchId: await this.findBranchId(transaction.branch_name),
      journalNumber: `RCP-${transaction.branch_name}-${transaction.transaction_date}`,
      journalDate: transaction.transaction_date,
      totalAmount: transaction.total_bill_amount
    });

    // Create journal lines (satu line per payment method)
    const journalLines: any[] = [];
    let lineNumber = 1;

    for (const payment of payments) {
      // DEBIT: Dari payment_methods.coa_account_id
      const pm = await this.getPaymentMethod(payment.payment_method_id);
      journalLines.push({
        journal_header_id: journalHeader.id,
        line_number: lineNumber++,
        account_id: pm.coa_account_id,
        description: `Split Payment - ${pm.name}`,
        debit_amount: payment.amount,
        credit_amount: 0,
        // ... other fields
      });
    }

    // CREDIT: Dari accounting_purpose_accounts (satu line total)
    const salesCoa = await this.getSalesCoaAccount();
    journalLines.push({
      journal_header_id: journalHeader.id,
      line_number: lineNumber++,
      account_id: salesCoa,
      description: 'Total Sales',
      debit_amount: 0,
      credit_amount: transaction.total_bill_amount
    });

    // Insert journal lines
    await this.insertJournalLines(journalLines);

    return {
      date: transaction.transaction_date,
      branch_name: transaction.branch_name!,
      transaction_ids: [transactionId],
      journal_id: journalHeader.id,
      total_amount: transaction.total_bill_amount
    };
  }

  private groupPaymentsByDateBranch(payments: AggregatedTransactionPayment[]) {
    const groups = new Map<string, AggregatedTransactionPayment[]>();
    
    for (const payment of payments) {
      // Group by transaction info dari parent
      const key = `${payment.split_ref}`; // Bisa dimodifikasi jika perlu
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(payment);
    }
    
    return groups;
  }
}
```

### Step 4: Import Flow Changes

```typescript
// backend/src/modules/pos-imports/pos-transactions.import.ts

/**
 * Parse Excel dengan split payment detection
 * 
 * Excel format untuk split payment:
 * | Bill Number | Sales Date | Payment Method | Amount    |
 * |-------------|------------|----------------|-----------|
 * | INV-001     | 2024-01-01 | Cash           | 30000     |
 * | INV-001     | 2024-01-01 | Credit Card    | 50000     |
 * | INV-001     | 2024-01-01 | Debit Card     | 20000     |
 */

interface ParsedPaymentRow {
  bill_number: string
  sales_date: string
  payment_method: string
  amount: number
}

function detectSplitPayments(rows: ParsedPaymentRow[]): Map<string, ParsedPaymentRow[]> {
  const billGroups = new Map<string, ParsedPaymentRow[]>();
  
  for (const row of rows) {
    const key = row.bill_number;
    if (!billGroups.has(key)) {
      billGroups.set(key, []);
    }
    billGroups.get(key)!.push(row);
  }
  
  // Tandai bills yang split (> 1 payment method)
  for (const [billNumber, payments] of billGroups) {
    if (payments.length > 1) {
      console.log(`Split payment detected: ${billNumber} (${payments.length} methods)`);
    }
  }
  
  return billGroups;
}

async function processImportWithSplitPayments(
  rows: ParsedPaymentRow[],
  companyId: string
) {
  const billGroups = detectSplitPayments(rows);
  const results: AggregatedTransactionBatchResult = {
    success: [],
    failed: [],
    total_processed: 0
  };

  for (const [billNumber, payments] of billGroups) {
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const firstPayment = payments[0];

    try {
      // Determine if split payment
      const isSplitPayment = payments.length > 1;

      if (isSplitPayment) {
        // Create with split payments
        const splitPayments = payments.map(p => ({
          payment_method_id: p.payment_method,
          amount: p.amount
        }));

        await posAggregatesService.createTransactionWithSplit({
          source_type: 'POS',
          source_id: importId,
          source_ref: billNumber,
          transaction_date: firstPayment.sales_date,
          net_amount: totalAmount,
          status: 'READY'
        }, splitPayments);
      } else {
        // Single payment (backward compatibility)
        await posAggregatesService.createTransaction({
          source_type: 'POS',
          source_id: importId,
          source_ref: billNumber,
          transaction_date: firstPayment.sales_date,
          payment_method_id: firstPayment.payment_method,
          net_amount: totalAmount,
          status: 'READY'
        });
      }

      results.success.push(billNumber);
    } catch (error) {
      results.failed.push({
        source_ref: billNumber,
        error: error.message
      });
    }
    
    results.total_processed++;
  }

  return results;
}
```

### Step 5: API Endpoints

```typescript
// backend/src/modules/pos-imports/pos-aggregates/pos-aggregates.routes.ts

router.get('/:id/payments', canView('pos_aggregates'), (req, res) => 
  posAggregatesController.getPayments(req as AuthenticatedRequest, res));

router.post('/with-split', canInsert('pos_aggregates'), validateSchema(createWithSplitSchema), 
  (req, res) => posAggregatesController.createWithSplit(req as ValidatedAuthRequest, res));

router.post('/:id/generate-journal', canInsert('journals'), 
  (req, res) => posAggregatesController.generateJournal(req as AuthenticatedRequest, res));
```

---

## 📋 Journal Entry untuk Split Payment

### Contoh: Bill Rp 100,000 dengan 3 Payment Methods

**Input:**
```
Bill: INV-001
Tanggal: 2024-01-15
Branch: SUSHI-001
Split Payment:
├── Cash: Rp 30,000
├── Credit Card: Rp 50,000
└── Debit Card: Rp 20,000
```

**Journal Entry (Satu Header, Multiple Lines):**
```
┌────────────────────────────────────────────────────────────────┐
│ Journal Header                                                  │
├────────────────────────────────────────────────────────────────┤
│ journal_number: RCP-SUSHI-001-2024-01-15                       │
│ journal_date: 2024-01-15                                       │
│ journal_type: SALES                                            │
│ total_amount: 100,000                                          │
│ status: POSTED                                                 │
└────────────────────────────────────────────────────────────────┘

Journal Lines:
┌────┬────────────────────────────┬──────────+──────────┐
│ No │ Account                    │ Debit    │ Credit   │
├────┼────────────────────────────┼──────────+──────────┤
│ 1  │ Bank - Cash (CSH)          │ 30,000   │          │
│ 2  │ Bank - Credit Card (CRD)   │ 50,000   │          │
│ 3  │ Bank - Debit Card (DBT)    │ 20,000   │          │
│ 4  │ Pendapatan Penjualan       │          │ 100,000  │
├────┼────────────────────────────┼──────────+──────────┤
│    │ TOTAL                      │ 100,000  │ 100,000  │
└────┴────────────────────────────┴──────────┴──────────┘
```

**Comparison dengan Single Payment:**
- **Single Payment:** 1 DEBIT line + 1 CREDIT line = 2 lines
- **Split Payment:** N DEBIT lines + 1 CREDIT line = (N+1) lines

---

## 🔄 Backward Compatibility

### Strategy:

1. **Existing Data:**
   - Rows dengan `split_ref = NULL` diperlakukan sebagai single payment
   - `payment_method_id` dan `net_amount` tetap valid

2. **New Data:**
   - Jika hanya satu payment method: bisa pake old way atau new way
   - Jika multiple payment methods: wajib pake new way (split_payments table)

3. **Queries:**
   - `getById()` return semua data + split payments
   - `list()` filter berdasarkan split status

```typescript
// Query untuk backward compatibility
async function getTransactionSummary(sourceRef: string) {
  const transaction = await repo.findBySourceRef(sourceRef);
  const payments = await paymentRepo.findBySplitRef(transaction.split_ref);
  
  return {
    ...transaction,
    is_split: payments.length > 1,
    payment_count: payments.length || 1,
    total_amount: payments.length > 0 
      ? payments.reduce((sum, p) => sum + p.amount, 0)
      : transaction.net_amount
  };
}
```

---

## ⚠️ Pertimbangan Lain

### 1. Duplicate Bill Number
```
Masalah: Satu bill number bisa muncul multiple rows di Excel
Solusi: Grouping by bill_number sebelum create
```

### 2. Total Amount Mismatch
```
Masalah: Split amounts tidak equals total bill
Solusi: Validation sebelum insert
```

### 3. Performance
```
Pertimbangan: Split payment = lebih banyak records
Solusi: Use batch insert untuk payments
```

### 4. Reporting
```
Pertanyaan: Gimana report untuk split payments?
Solusi: Aggregate dari payments table, bukan transactions table
```

---

## 📝 Kesimpulan

### Apa yang Perlu Dibuat:

| Component | File | Priority |
|-----------|------|----------|
| Database migration | `migrations/xxx_split_payment.sql` | High |
| New types | `pos-aggregates.types.ts` | High |
| Service methods | `pos-aggregates.service.ts` | High |
| Import processor update | `pos-transactions.import.ts` | High |
| API endpoints | `pos-aggregates.routes.ts` | Medium |
| Frontend support | `pos-aggregates.feature.tsx` | Medium |

### Estimasi Effort:
- **Backend:** 3-5 hari
- **Database:** 1 hari (migration + indexes)
- **Testing:** 2 hari
- **Frontend:** 2-3 hari (jika diperlukan UI untuk split payment)

---

Apakah Anda ingin saya melanjutkan dengan implementasi salah satu bagian ini?
1. Buat database migration
2. Update TypeScript types
3. Update service layer
4. Update import processor

