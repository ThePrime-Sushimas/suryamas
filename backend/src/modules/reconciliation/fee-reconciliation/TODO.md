# 📋 TODO: Payment Method FEE Implementation

## 📌 Status: IN PROGRESS
**Start Date:** 2024  
**Focus:** Implement Payment Method dengan FEE Configuration

---

## 🔧 IMPLEMENTASI CODE

### Phase 1: Update Payment Methods Module
- [ ] 1.1 Update `payment-methods.types.ts` - Tambah 4 fields fee config
- [ ] 1.2 Update `payment-methods.service.ts` - Fee validation logic
- [ ] 1.3 Update `payment-methods.repository.ts` - Fee columns
- [ ] 1.4 Update `payment-methods.schema.ts` - Fee validation schema

### Phase 2: Fee Calculation Service
- [ ] 2.1 Update `fee-calculation.service.ts` - Complete implementation
- [ ] 2.2 Tambah method `calculateWithMarketing()`
- [ ] 2.3 Tambah method `calculateBatchFees()`

### Phase 3: Fee Reconciliation Service
- [ ] 3.1 Update `fee-reconciliation.service.ts` - Integrasi dengan payment-methods
- [ ] 3.2 Update `fee-reconciliation.repository.ts`

### Phase 4: Update Marketing Fee Service
- [ ] 4.1 Update `marketing-fee.service.ts` - Support fee dari payment-methods

### Phase 5: Database Migration
- [ ] 5.1 Buat migration script untuk 4 kolom fee

---

## 📝 DOKUMENTASI

### Phase 6: Update MD
- [ ] 6.1 Update `PAYMENT_METHOD_FEE_MD.md` - Tambah contoh Gojek lengkap
- [ ] 6.2 Tambah SQL query examples
- [ ] 6.3 Tambah troubleshooting section

---

## 🧪 TESTING

### Phase 7: Unit Tests
- [ ] 7.1 Test `calculateFee()` - Gojek (per transaction)
- [ ] 7.2 Test `calculateFee()` - QRIS (per total)
- [ ] 7.3 Test `calculateWithMarketing()`
- [ ] 7.4 Test batch calculation
- [ ] 7.5 Test edge cases (negative net, etc.)

---

## 📋 DETAIL IMPLEMENTASI

### 1. Payment Methods Types (1.1)
```typescript
// Tambah di interface PaymentMethod:
fee_percentage: number              // 0-100, contoh: 20.0 = 20%
fee_fixed_amount: number           // contoh: 500 = Rp 500
fee_fixed_per_transaction: boolean // true = per tx, false = per total
marketing_fee_percentage: number   // 0-100, contoh: 5.0 = 5%
```

### 2. Fee Calculation Service (2.1)
```typescript
// Existing:
calculateCompoundFee(input: FeeCalculationInput): FeeCalculationResult

// Tambah:
calculateWithMarketing(
  grossAmount: number,
  transactionCount: number,
  feeConfig: FeeConfigWithMarketing
): FeeCalculationWithMarketingResult

calculateBatchFees(
  transactions: BatchFeeInput[]
): BatchFeeResult
```

### 3. Fee Config Interface
```typescript
interface FeeConfig {
  fee_percentage: number
  fee_fixed_amount: number
  fee_fixed_per_transaction: boolean
}

interface FeeConfigWithMarketing extends FeeConfig {
  marketing_fee_percentage: number
}
```

---

## ✅ COMPLETED TASKS

- [x] 1. Analisis project structure
- [x] 2. Buat MD document (PAYMENT_METHOD_FEE_MD.md)
- [x] 3. Tambah flowchart & troubleshooting di MD
- [x] 4. Review fee-calculation.service.ts existing
- [x] 5. Review payment-methods.types.ts existing
- [x] 6. Update payment-methods.types.ts - Tambah 4 fields fee config
- [x] 7. Update CreatePaymentMethodDto & UpdatePaymentMethodDto

---

## 🎯 NEXT ACTION

**Pilih salah satu:**
1. [ ] Mulai Phase 1: Update Payment Methods Types
2. [ ] Mulai Phase 2: Update Fee Calculation Service
3. [ ] Langsung ke Phase 7: Unit Tests

---

**Last Updated:** 2024
**Version:** 1.0

