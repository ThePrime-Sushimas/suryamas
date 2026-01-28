# 📋 Fee Reconciliation Implementation - TODO

## 🎯 Key Insight (UPDATE!)
```
🎯 MARKETING FEE = SELISIH ANTARA EXPECTED vs ACTUAL

Flow yang benar:
1. POS IMPORT → AGGREGATED (per payment method)
2. HITUNG EXPECTED: Gross - (percentage_fee + fixed_fee)
3. COMPARE: Expected vs Actual dari mutasi bank
4. SELISIH = Marketing Fee (input manual)
```

## ✅ Current Implementation Status

### Phase 1: Types & Database ✅ COMPLETE
- [x] 1.1 Added 3 fee columns ke `PaymentMethod` interface (HAPUS `marketing_fee_percentage`)
- [x] 1.2 Created migration script dengan constraints dan indexes
- [x] 1.3 Updated DTOs (CreatePaymentMethodDto, UpdatePaymentMethodDto)

### Phase 2: Fee Calculation Service ✅ COMPLETE
- [x] 2.1 `calculateExpectedNet()` - Hitung expected net dari fee config
- [x] 2.2 `calculateMarketingFee()` - Hitung marketing fee dari SELISIH expected vs actual
- [x] 2.3 `calculateBatchExpectedNets()` - Batch processing
- [x] 2.4 `validateFeeConfig()` - Validation
- [x] 2.5 `formatFee()` - Display helper
- [x] 2.6 Convenience functions (`calculateSimpleExpectedNet`, dll)

### Phase 3: Fee Reconciliation Service ✅ COMPLETE
- [x] 3.1 `getPaymentMethodFeeConfigs()` - Ambil dari payment-methods module
- [x] 3.2 `calculateExpectedNet()` - Wrapper untuk fee calculation
- [x] 3.3 `reconcilePaymentMethod()` - Reconciliation untuk 1 PM
- [x] 3.4 `reconcileDaily()` - Reconciliation untuk semua PM dalam 1 hari
- [x] 3.5 `approveMarketingFee()` - Approve manual review
- [x] 3.6 `rejectMarketingFee()` - Reject manual review

### Phase 4: Marketing Fee Service ✅ COMPLETE
- [x] 4.1 `identifyMarketingFee()` - Identifikasi dari difference
- [x] 4.2 `identifyBatchMarketingFees()` - Batch identification
- [x] 4.3 `validateManualAdjustment()` - Validasi input manual
- [x] 4.4 `generateMarketingFeeReport()` - Report untuk finance

### Phase 5: Database Migrations ✅ COMPLETE
- [x] 5.1 Created migration: `xxxx_add_fee_columns_to_payment_methods.sql`
- [x] 5.2 Add 3 columns: fee_percentage, fee_fixed_amount, fee_fixed_per_transaction
- [x] 5.3 Add indexes dan constraints
- [x] 5.4 Add trigger untuk updated_at
- [x] 5.5 Add rollback script

### Phase 6: Documentation ✅ COMPLETE
- [x] 6.1 Created `PAYMENT_METHOD_FEE_MD.md` (700+ lines)
- [x] 6.2 Contoh fee per payment type (Gojek, QRIS, OVO, Credit Card)
- [x] 6.3 4 Flowchart alur kerja
- [x] 6.4 Troubleshooting section dengan 7+ problems & solutions
- [x] 6.5 Error codes reference

### Phase 7: Unit Tests ✅ COMPLETE
- [x] 7.1 Test file created: `fee-calculation.service.test.ts`
- [x] 7.2 50+ test cases untuk:
  - [x] Gojek (20% + 500 per tx)
  - [x] QRIS (0.7% per total)
  - [x] Credit Card (2% + 3000 per total)
  - [x] Marketing fee = difference
  - [x] Edge cases (negative, zero, 100%)
  - [x] Batch calculations
  - [x] Validation

**Note:** Install jest types untuk running tests:
```bash
npm install --save-dev @types/jest
```

---

## 📊 Fee Configuration Reference

### Payment Methods dengan Fee

| Payment Method | fee_% | fee_fixed | per_tx | Contoh 3tx @100K |
|----------------|-------|-----------|--------|------------------|
| Gojek/GoFood | 20% | 500 | ✅ | Fee: 61,500, Net: 238,500 |
| QRIS | 0.7% | 0 | ❌ | Fee: 2,100, Net: 497,900 |
| OVO | 15% | 1000 | ✅ | Fee: 48,000, Net: 252,000 |
| Grab | 25% | 500 | ✅ | Fee: 76,500, Net: 223,500 |
| Credit Card | 2% | 3000 | ❌ | Fee: 9,000, Net: 291,000 |
| Debit Card | 0.5% | 500 | ❌ | Fee: 2,000, Net: 298,000 |
| Cash | 0% | 0 | - | Fee: 0, Net: 300,000 |

### Marketing Fee Calculation

```
Marketing Fee = Expected Net (dari fee config) - Actual dari Bank

Contoh Gojek:
- Expected Net: Rp 238,500 (dari fee calculation)
- Actual Bank:  Rp 200,000
- Marketing Fee: Rp 38,500 (SELISIH!)

Contoh QRIS (matched):
- Expected Net: Rp 497,900
- Actual Bank:  Rp 497,900
- Marketing Fee: Rp 0
```

---

## 📁 Files Overview

```
backend/src/modules/
│
├── payment-methods/
│   └── payment-methods.types.ts        ← Updated dengan 3 fee fields
│
└── reconciliation/
    └── fee-reconciliation/
        ├── index.ts                    ← Exports
        ├── fee-calculation.service.ts  ← Core calculation logic
        ├── fee-reconciliation.service.ts ← Reconciliation logic
        ├── marketing-fee.service.ts    ← Marketing fee identification
        ├── migrations/
        │   └── xxxx_add_fee_columns_to_payment_methods.sql
        ├── fee-calculation.service.test.ts  ← Unit tests (50+ cases)
        ├── PAYMENT_METHOD_FEE_MD.md    ← Complete documentation
        └── TODO.md                     ← This file
```

---

## 🔧 Usage Examples

### Example 1: Calculate Expected Net

```typescript
import { feeCalculationService } from './fee-calculation.service'

// Gojek: 20% + 500 per transaksi
const result = feeCalculationService.calculateExpectedNet(300000, 3, {
  fee_percentage: 20,
  fee_fixed_amount: 500,
  fee_fixed_per_transaction: true
})

console.log(result)
// {
//   grossAmount: 300000,
//   transactionCount: 3,
//   percentageFee: 60000,
//   fixedFee: 1500,
//   totalFee: 61500,
//   expectedNet: 238500  ← INI YANG DICOCOKKAN dengan bank
// }
```

### Example 2: Calculate Marketing Fee (SELISIH!)

```typescript
import { feeCalculationService } from './fee-calculation.service'

// Expected: 238,500, Actual dari Bank: 200,000
const marketingFee = feeCalculationService.calculateMarketingFee(238500, 200000)

console.log(marketingFee)
// {
//   difference: 38500,           // Expected - Actual
//   marketingFee: 38500,         // Selisih positif = advertising cost
//   isWithinTolerance: false,
//   needsReview: true
// }
```

### Example 3: Daily Reconciliation

```typescript
import { feeReconciliationService } from './fee-reconciliation.service'

const summary = await feeReconciliationService.reconcileDaily(
  new Date('2024-01-15'),
  'company-id-123',
  1 // tolerance percentage
)

console.log(summary)
// {
//   date: 2024-01-15,
//   totalGrossAmount: 1500000,
//   totalExpectedNet: 1170000,
//   totalActualFromBank: 1100000,
//   totalMarketingFee: 70000,      // Sum of all marketing fees
//   matchedCount: 3,
//   discrepancyCount: 2,
//   needsReviewCount: 2,
//   results: [...]
// }
```

---

## 🚀 Next Steps

### Immediate (Week 1)
1. **Run Migration**
   ```bash
   # Copy isi migrations/xxxx_add_fee_columns_to_payment_methods.sql
   # Jalankan di Supabase SQL Editor
   ```

2. **Install Dependencies**
   ```bash
   npm install --save-dev @types/jest
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

### Short Term (Week 2-3)
4. **Integrate dengan POS Import Module**
   - Ambil aggregated transactions dari `pos_aggregates` table
   - Filter berdasarkan `payment_method_id` dan `transaction_date`

5. **Integrate dengan Bank Statement Module**
   - Ambil deposits dari `bank_statements` table
   - Match dengan payment method (berdasarkan bank account)

6. **Add CRUD untuk Fee Configuration**
   - Update `payment-methods.service.ts` dengan fee validation
   - Add fee fields di form create/edit

### Medium Term (Week 4-6)
7. **Frontend Integration**
   - Add fee fields di Payment Methods form
   - Create Reconciliation Dashboard
   - Add Manual Review UI untuk marketing fee

8. **Approval Workflow**
   - Implement status: `PENDING` → `APPROVED` / `REJECTED`
   - Audit log untuk setiap approval

---

## ⚠️ Important Notes

1. **Marketing Fee TIDAK di payment method!**
   - Marketing fee adalah **SELISIH** expected vs actual
   - Di-input manual saat manual review
   - Bisa berbeda per hari/per settlement

2. **Boolean `fee_fixed_per_transaction` adalah kunci**
   - `true` = Gojek/OVO/Grab/DANA (per transaksi)
   - `false` = QRIS/EDC/Card (per total/settlement)

3. **Expected Net selalu dibandingkan dengan Bank Statement**
   - Bukan dengan settlement dari platform
   - Platform settlement = gross (belum dipotong fee)

4. **Tolerance untuk Auto-match**
   - Default: 1% dari expected net
   - Jika within tolerance = auto matched
   - Jika outside tolerance = needs review

---

## 📚 References

- Documentation: `PAYMENT_METHOD_FEE_MD.md`
- Migration: `migrations/xxxx_add_fee_columns_to_payment_methods.sql`
- Tests: `fee-calculation.service.test.ts`
- Types: `payment-methods/payment-methods.types.ts`

---

**Last Updated:** 2024  
**Version:** 2.0 (Marketing Fee = Difference)
**Status:** ✅ COMPLETE
