# 📋 Payment Method dengan FEE - Implementation Plan

## 🎯 Ringkasan

Dokumen ini menjelaskan implementasi khusus untuk **Payment Method dengan FEE Configuration** yang akan digunakan oleh module `fee-reconciliation`.

> **Catatan Penting:** `payment-methods` dan `fee-reconciliation` **TIDAK DIGABUNG**. Ini adalah dua modul terpisah dengan tanggung jawab yang berbeda namun saling terkait.

---

## 📁 Arsitektur Modul

```
backend/src/modules/
│
├── payment-methods/                           ← MASTER DATA
│   ├── payment-methods.controller.ts          ← CRUD endpoints
│   ├── payment-methods.service.ts             ← Business logic
│   ├── payment-methods.repository.ts          ← Database operations
│   ├── payment-methods.types.ts               ← TypeScript interfaces
│   ├── payment-methods.schema.ts              ← Validation schemas
│   └── payment-methods.openapi.ts             ← OpenAPI specs
│
└── reconciliation/
    └── fee-reconciliation/                    ← BUSINESS PROCESS
        ├── fee-reconciliation.service.ts      ← Reconciliation logic
        ├── fee-calculation.service.ts         ← Fee calculation
        ├── marketing-fee.service.ts           ← Marketing fee logic
        └── ...
```

---

## 🔗 Hubungan Antar Modul

```
┌─────────────────────────┐
│   payment-methods       │  ← Master Data (konfigurasi)
│   (Extracted Fields)    │
├─────────────────────────┤
│ - id                    │
│ - code                  │
│ - name                  │
│ - payment_type          │
│ - fee_percentage        │  ← FEE CONFIG
│ - fee_fixed_amount      │  ← FEE CONFIG
│ - fee_fixed_per_tx      │  ← FEE CONFIG
│ - marketing_fee_pct     │  ← FEE CONFIG
└─────────────────────────┘
            │
            │ (Diakses oleh)
            ▼
┌─────────────────────────┐
│   fee-reconciliation    │  ← Process (menggunakan data)
│   (Usage)               │
├─────────────────────────┤
│ - Ambil semua PM        │
│ - Hitung expected fee   │
│ - Bandingkan dengan     │
│   actual dari settlement│
└─────────────────────────┘
```

---

## 📊 Fee Configuration di Payment Methods

### 1. TypeScript Interfaces

```typescript
// backend/src/modules/payment-methods/payment-methods.types.ts

/**
 * Tipe pembayaran yang mendukung fee
 */
export type PaymentType =
  | 'BANK'
  | 'CARD'
  | 'CASH'
  | 'COMPLIMENT'
  | 'MEMBER_DEPOSIT'
  | 'OTHER_COST'

/**
 * Main payment method interface dengan FEE fields
 */
export interface PaymentMethod {
  // === Basic Info ===
  id: number
  company_id: string
  code: string
  name: string
  description: string | null
  payment_type: PaymentType
  bank_account_id: number | null
  coa_account_id: string | null

  // === Status ===
  is_active: boolean
  is_default: boolean
  requires_bank_account: boolean
  sort_order: number

  // === 🔥 FEE CONFIGURATION ===
  fee_percentage: number              // Persentase biaya (contoh: 2.5 = 2.5%)
  fee_fixed_amount: number           // Jumlah biaya tetap (contoh: 1000)
  fee_fixed_per_transaction: boolean // Apakah fixed fee per transaksi
  marketing_fee_percentage: number   // Persentase marketing fee (contoh: 5 = 5%)

  // === Audit ===
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

/**
 * Payment method dengan detail relasi
 */
export interface PaymentMethodWithDetails extends PaymentMethod {
  // Relasi
  bank_code?: string
  bank_name?: string
  account_number?: string
  account_name?: string
  coa_code?: string
  coa_name?: string
  coa_type?: string

  // Fee dengan format untuk display
  fee_percentage_display?: string
  marketing_fee_display?: string
}

/**
 * DTO untuk membuat payment method dengan fee
 */
export interface CreatePaymentMethodDto {
  company_id: string
  code: string
  name: string
  description?: string | null
  payment_type: PaymentType
  bank_account_id?: number | null
  coa_account_id?: string | null
  is_default?: boolean
  requires_bank_account?: boolean
  sort_order?: number

  // === 🔥 FEE CONFIG ===
  fee_percentage?: number
  fee_fixed_amount?: number
  fee_fixed_per_transaction?: boolean
  marketing_fee_percentage?: number
}

/**
 * DTO untuk update payment method dengan fee
 */
export interface UpdatePaymentMethodDto {
  code?: string
  name?: string
  description?: string | null
  payment_type?: PaymentType
  bank_account_id?: number | null
  coa_account_id?: string | null
  is_active?: boolean
  is_default?: boolean
  requires_bank_account?: boolean
  sort_order?: number

  // === 🔥 FEE CONFIG ===
  fee_percentage?: number
  fee_fixed_amount?: number
  fee_fixed_per_transaction?: boolean
  marketing_fee_percentage?: number
}

/**
 * Query parameters untuk filtering dengan fee
 */
export interface PaymentMethodFilterParams {
  company_id?: string
  payment_type?: PaymentType
  is_active?: boolean
  requires_bank_account?: boolean
  has_fee_config?: boolean      // Filter yang punya fee config
  search?: string
}
```

---

## 🗄️ Database Schema

### Payment Methods Table dengan FEE Columns

```sql
-- migration: xxxx_add_fee_columns_to_payment_methods.sql

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS fee_percentage DECIMAL(5, 2) DEFAULT 0 NOT NULL;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS fee_fixed_amount DECIMAL(15, 2) DEFAULT 0 NOT NULL;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS fee_fixed_per_transaction BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS marketing_fee_percentage DECIMAL(5, 2) DEFAULT 0 NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN payment_methods.fee_percentage IS 'Persentase biaya (MDR/merchant fee). Contoh: 2.5 = 2.5%';
COMMENT ON COLUMN payment_methods.fee_fixed_amount IS 'Jumlah biaya tetap per transaksi. Contoh: 1000 = Rp 1.000';
COMMENT ON COLUMN payment_methods.fee_fixed_per_transaction IS 'Apakah fixed fee diterapkan per transaksi atau per total';
COMMENT ON COLUMN payment_methods.marketing_fee_percentage IS 'Persentase biaya marketing yang dipotong dari nett';

-- Add indexes untuk performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_fee_config 
ON payment_methods(company_id, fee_percentage, fee_fixed_amount) 
WHERE is_active = true AND deleted_at IS NULL;
```

---

## 🔧 Fee Calculation Service

### Fee Calculation Input/Output

```typescript
// backend/src/modules/reconciliation/fee-reconciliation/fee-calculation.service.ts

/**
 * Input untuk perhitungan fee
 */
export interface FeeCalculationInput {
  grossAmount: number
  transactionCount: number
  feePercentage: number              // Dari payment_methods.fee_percentage
  feeFixedAmount: number             // Dari payment_methods.fee_fixed_amount
  feeFixedPerTransaction: boolean    // Dari payment_methods.fee_fixed_per_transaction
  marketingFeePercentage?: number    // Dari payment_methods.marketing_fee_percentage
}

/**
 * Hasil perhitungan fee
 */
export interface FeeCalculationResult {
  // Fee utama
  percentageFee: number              // gross × percentage
  fixedFee: number                   // fixed × (transactionCount atau 1)
  totalExpectedFee: number           // percentageFee + fixedFee

  // Marketing fee (dari nett)
  marketingFee: number               // (gross - totalExpectedFee) × marketing_fee_percentage
  nettAfterMarketingFee: number      // gross - totalExpectedFee - marketingFee

  // Summary
  expectedNet: number                // gross - totalExpectedFee
  grossAmount: number
  transactionCount: number
}

/**
 * Fee configuration dari payment method
 */
export interface PaymentMethodFeeConfig {
  paymentMethodId: number
  paymentMethodCode: string
  paymentMethodName: string
  paymentType: string
  feePercentage: number
  feeFixedAmount: number
  feeFixedPerTransaction: boolean
  marketingFeePercentage: number
}
```

### Fee Calculation Implementation

```typescript
// backend/src/modules/reconciliation/fee-reconciliation/fee-calculation.service.ts

import { logInfo, logError } from '../../../config/logger'

export class FeeCalculationService {
  /**
   * Hitung fee lengkap dengan marketing fee
   */
  calculateCompleteFee(input: FeeCalculationInput): FeeCalculationResult {
    const {
      grossAmount,
      transactionCount,
      feePercentage,
      feeFixedAmount,
      feeFixedPerTransaction,
      marketingFeePercentage = 0
    } = input

    // 1. Hitung percentage fee
    const percentageFee = grossAmount * (feePercentage / 100)

    // 2. Hitung fixed fee
    const fixedFee = feeFixedPerTransaction
      ? transactionCount * feeFixedAmount
      : feeFixedAmount

    // 3. Total expected fee
    const totalExpectedFee = percentageFee + fixedFee

    // 4. Expected net (gross - total fee)
    const expectedNet = grossAmount - totalExpectedFee

    // 5. Marketing fee (dari nett, bukan gross!)
    const marketingFee = expectedNet * (marketingFeePercentage / 100)

    // 6. Nett setelah marketing fee
    const nettAfterMarketingFee = expectedNet - marketingFee

    return {
      percentageFee,
      fixedFee,
      totalExpectedFee,
      marketingFee,
      nettAfterMarketingFee,
      expectedNet,
      grossAmount,
      transactionCount
    }
  }

  /**
   * Hitung fee utama saja (tanpa marketing fee)
   */
  calculateMainFee(
    grossAmount: number,
    feePercentage: number,
    feeFixedAmount: number,
    feeFixedPerTransaction: boolean,
    transactionCount: number = 1
  ): { percentageFee: number; fixedFee: number; totalExpectedFee: number; expectedNet: number } {
    const percentageFee = grossAmount * (feePercentage / 100)
    const fixedFee = feeFixedPerTransaction
      ? transactionCount * feeFixedAmount
      : feeFixedAmount
    const totalExpectedFee = percentageFee + fixedFee
    const expectedNet = grossAmount - totalExpectedFee

    return { percentageFee, fixedFee, totalExpectedFee, expectedNet }
  }

  /**
   * Batch calculation untuk multiple transactions
   */
  calculateBatchFees(
    transactions: Array<{
      grossAmount: number
      transactionCount: number
      paymentMethodFeeConfig: FeeCalculationInput
    }>
  ): {
    totalGross: number
    totalExpectedFee: number
    totalMarketingFee: number
    totalExpectedNet: number
    details: FeeCalculationResult[]
  } {
    let totalGross = 0
    let totalExpectedFee = 0
    let totalMarketingFee = 0
    let totalExpectedNet = 0
    const details: FeeCalculationResult[] = []

    for (const tx of transactions) {
      const result = this.calculateCompleteFee({
        ...tx.paymentMethodFeeConfig,
        grossAmount: tx.grossAmount,
        transactionCount: tx.transactionCount
      })

      totalGross += result.grossAmount
      totalExpectedFee += result.totalExpectedFee
      totalMarketingFee += result.marketingFee
      totalExpectedNet += result.nettAfterMarketingFee

      details.push(result)
    }

    return {
      totalGross,
      totalExpectedFee,
      totalMarketingFee,
      totalExpectedNet,
      details
    }
  }
}

export const feeCalculationService = new FeeCalculationService()
```

---

## 🔗 Integrasi: Fee Reconciliation Service

### Mengambil Fee Config dari Payment Methods

```typescript
// backend/src/modules/reconciliation/fee-reconciliation/fee-reconciliation.service.ts

import { paymentMethodsRepository } from '../../payment-methods/payment-methods.repository'
import { feeCalculationService } from './fee-calculation.service'
import { PaymentMethodFeeConfig, FeeCalculationInput } from './fee-calculation.service'
import { logInfo, logError } from '../../../config/logger'

export class FeeReconciliationService {
  /**
   * Ambil fee configuration dari payment methods
   */
  async getPaymentMethodFeeConfigs(companyId: string): Promise<PaymentMethodFeeConfig[]> {
    const paymentMethods = await paymentMethodsRepository.findAll(
      companyId,
      { limit: 1000, offset: 0 },
      undefined,
      { is_active: true }
    )

    return paymentMethods.data.map(pm => ({
      paymentMethodId: pm.id,
      paymentMethodCode: pm.code,
      paymentMethodName: pm.name,
      paymentType: pm.payment_type,
      feePercentage: pm.fee_percentage,
      feeFixedAmount: pm.fee_fixed_amount,
      feeFixedPerTransaction: pm.fee_fixed_per_transaction,
      marketingFeePercentage: pm.marketing_fee_percentage
    }))
  }

  /**
   * Reconcile fees untuk satu settlement
   */
  async reconcileFeesForSettlement(
    settlementId: string,
    companyId: string
  ): Promise<{
    settlementId: string
    totalGross: number
    totalExpectedFee: number
    totalActualFee: number
    feeDiscrepancy: number
    details: any[]
  }> {
    // 1. Ambil fee configs dari payment methods
    const feeConfigs = await this.getPaymentMethodFeeConfigs(companyId)

    // 2. Ambil transaksi settlement dari database
    // TODO: Implementasi - ambil dari settlement table
    const settlementTransactions = await this.getSettlementTransactions(settlementId)

    // 3. Hitung expected fees
    const calculationResults = feeCalculationService.calculateBatchFees(
      settlementTransactions.map(tx => ({
        grossAmount: tx.gross_amount,
        transactionCount: tx.transaction_count,
        paymentMethodFeeConfig: this.mapToFeeCalculationInput(
          tx.payment_method_id,
          feeConfigs
        )
      }))
    )

    // 4. Ambil actual fees dari settlement
    // TODO: Implementasi - ambil actual fees
    const actualFees = await this.getActualFees(settlementId)

    // 5. Hitung discrepancy
    const feeDiscrepancy = calculationResults.totalExpectedFee - actualFees.total

    return {
      settlementId,
      totalGross: calculationResults.totalGross,
      totalExpectedFee: calculationResults.totalExpectedFee,
      totalActualFee: actualFees.total,
      feeDiscrepancy,
      details: calculationResults.details
    }
  }

  /**
   * Map transaction ke FeeCalculationInput berdasarkan payment method
   */
  private mapToFeeCalculationInput(
    paymentMethodId: number,
    feeConfigs: PaymentMethodFeeConfig[]
  ): FeeCalculationInput {
    const config = feeConfigs.find(c => c.paymentMethodId === paymentMethodId)

    if (!config) {
      logError('Fee config not found', { paymentMethodId })
      // Return default (0% fee) jika tidak ditemukan
      return {
        grossAmount: 0,
        transactionCount: 0,
        feePercentage: 0,
        feeFixedAmount: 0,
        feeFixedPerTransaction: false,
        marketingFeePercentage: 0
      }
    }

    return {
      grossAmount: 0, // Will be overridden per transaction
      transactionCount: 0, // Will be overridden per transaction
      feePercentage: config.feePercentage,
      feeFixedAmount: config.feeFixedAmount,
      feeFixedPerTransaction: config.feeFixedPerTransaction,
      marketingFeePercentage: config.marketingFeePercentage
    }
  }

  // TODO: Implement methods ini
  private async getSettlementTransactions(settlementId: string): Promise<any[]> {
    return []
  }

  private async getActualFees(settlementId: string): Promise<{ total: number }> {
    return { total: 0 }
  }
}

export const feeReconciliationService = new FeeReconciliationService()
```

---

## 📝 Validasi Schema dengan Zod

```typescript
// backend/src/modules/payment-methods/payment-methods.schema.ts

import { z } from '@/lib/openapi'
import { PaymentMethodsConfig } from './payment-methods.errors'

// ... existing schemas ...

// === 🔥 FEE CONFIG SCHEMAS ===

export const feeConfigSchema = z.object({
  fee_percentage: z.number()
    .min(0, 'Fee percentage tidak boleh negatif')
    .max(100, 'Fee percentage tidak boleh lebih dari 100')
    .optional()
    .default(0),
  
  fee_fixed_amount: z.number()
    .min(0, 'Fixed amount tidak boleh negatif')
    .optional()
    .default(0),
  
  fee_fixed_per_transaction: z.boolean()
    .optional()
    .default(false),
  
  marketing_fee_percentage: z.number()
    .min(0, 'Marketing fee tidak boleh negatif')
    .max(100, 'Marketing fee tidak boleh lebih dari 100')
    .optional()
    .default(0)
})

// Create dengan fee config
export const createPaymentMethodWithFeeSchema = z.object({
  body: z.object({
    company_id: z.string().uuid(),
    code: z.string()
      .min(1)
      .max(20)
      .toUpperCase(),
    name: z.string()
      .min(1)
      .max(100),
    description: z.string().max(500).nullable().optional(),
    payment_type: z.enum(['BANK', 'CARD', 'CASH', 'COMPLIMENT', 'MEMBER_DEPOSIT', 'OTHER_COST']),
    bank_account_id: z.number().int().positive().nullable().optional(),
    coa_account_id: z.string().uuid().nullable().optional(),
    is_default: z.boolean().optional().default(false),
    requires_bank_account: z.boolean().optional().default(false),
    sort_order: z.number().int().min(0).optional(),

    // 🔥 FEE CONFIG
    ...feeConfigSchema.shape
  })
})

// Update dengan fee config
export const updatePaymentMethodWithFeeSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/)
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    payment_type: z.enum(['BANK', 'CARD', 'CASH', 'COMPLIMENT', 'MEMBER_DEPOSIT', 'OTHER_COST']).optional(),
    bank_account_id: z.number().int().positive().nullable().optional(),
    coa_account_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
    is_default: z.boolean().optional(),
    requires_bank_account: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),

    // 🔥 FEE CONFIG
    ...feeConfigSchema.shape
  })
})

// Filter dengan fee config
export const paymentMethodWithFeeFilterSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    payment_type: z.enum(['BANK', 'CARD', 'CASH', 'COMPLIMENT', 'MEMBER_DEPOSIT', 'OTHER_COST']).optional(),
    is_active: z.coerce.boolean().optional(),
    has_fee_config: z.coerce.boolean().optional(),  // 🔥 Filter baru
    search: z.string().optional()
  })
})
```

---

## 🚀 API Endpoints

### Payment Methods dengan Fee

```typescript
// backend/src/modules/payment-methods/payment-methods.routes.ts

import { Router } from 'express'
import { paymentMethodsController } from './payment-methods.controller'
import { validateRequest } from '../../middleware/validation.middleware'
import {
  createPaymentMethodWithFeeSchema,
  updatePaymentMethodWithFeeSchema,
  paymentMethodWithFeeFilterSchema
} from './payment-methods.schema'

const router = Router()

// List dengan filter fee config
router.get(
  '/',
  validateRequest(paymentMethodWithFeeFilterSchema),
  paymentMethodsController.list
)

// Create dengan fee config
router.post(
  '/',
  validateRequest(createPaymentMethodWithFeeSchema),
  paymentMethodsController.create
)

// Get by ID
router.get(
  '/:id',
  paymentMethodsController.getById
)

// Update dengan fee config
router.put(
  '/:id',
  validateRequest(updatePaymentMethodWithFeeSchema),
  paymentMethodsController.update
)

// Delete
router.delete(
  '/:id',
  paymentMethodsController.delete
)

// Get options (untuk dropdown) - INCLUDE FEE CONFIG
router.get(
  '/options/with-fee',
  paymentMethodsController.getOptionsWithFee
)

export default router
```

---

## 📊 Contoh Penggunaan

### Contoh 1: QRIS Payment Method dengan MDR 0.7%

```json
{
  "id": 1,
  "code": "QRIS",
  "name": "QRIS",
  "payment_type": "CARD",
  "fee_percentage": 0.7,
  "fee_fixed_amount": 0,
  "fee_fixed_per_transaction": false,
  "marketing_fee_percentage": 0
}
```

**Perhitungan untuk transaksi Rp 1.000.000:**
- Percentage Fee: 1,000,000 × 0.7% = **7,000**
- Fixed Fee: 0
- Total Fee: **7,000**
- Expected Net: 1,000,000 - 7,000 = **993,000**

---

### Contoh 2: GoPay Payment Method dengan Platform Fee

```json
{
  "id": 2,
  "code": "GOPAY",
  "name": "GoPay",
  "payment_type": "BANK",
  "fee_percentage": 20.0,
  "fee_fixed_amount": 2000,
  "fee_fixed_per_transaction": true,
  "marketing_fee_percentage": 5.0
}
```

**Perhitungan untuk 5 transaksi @ Rp 200.000 (Total Rp 1.000.000):**
- Percentage Fee: 1,000,000 × 20% = 200,000
- Fixed Fee: 5 × 2,000 = 10,000
- Total Fee: **210,000**
- Expected Net (sebelum marketing): 1,000,000 - 210,000 = 790,000
- Marketing Fee: 790,000 × 5% = **39,500**
- Expected Net (akhir): 790,000 - 39,500 = **750,500**

---

## 📋 Checklist Implementasi

### Phase 1: Database & Types
- [ ] Tambah kolom fee di tabel `payment_methods`
- [ ] Update TypeScript interfaces dengan fee fields
- [ ] Buat database migration script
- [ ] Tambah indexes untuk query performance

### Phase 2: Payment Methods Module
- [ ] Update service dengan fee validation logic
- [ ] Update repository dengan fee columns
- [ ] Update validation schemas dengan fee config
- [ ] Update OpenAPI specs
- [ ] Tambah endpoint filter `has_fee_config`

### Phase 3: Fee Calculation Service
- [ ] Implement `FeeCalculationService`
- [ ] Implement compound fee calculation
- [ ] Implement marketing fee calculation
- [ ] Implement batch calculation
- [ ] Tambah unit tests

### Phase 4: Fee Reconciliation Service
- [ ] Integrasi dengan `paymentMethodsRepository`
- [ ] Implement reconcile fees logic
- [ ] Implement discrepancy calculation
- [ ] Tambah unit tests

### Phase 5: Testing & Documentation
- [ ] Integration testing
- [ ] Update API documentation
- [ ] User guide untuk konfigurasi fee

---

## ⚠️ Catatan Penting

1. **Default Values**: Fee fields harus memiliki default value (0) agar backward compatible
2. **Validation**: Fee percentage tidak boleh > 100%
3. **Performance**: Index pada kolom fee untuk query yang filter berdasarkan fee config
4. **Audit Trail**: Perubahan fee config harus di-log melalui AuditService
5. **Currency**: Semua amount dalam Rupiah (IDR)

---

---

## 📊 CONTOH FEE UNTUK PAYMENT TYPE

### Tabel Referensi Fee per Payment Type

| Payment Type | Contoh | fee_% | fee_fixed | fee_per_tx | marketing_% | Used By |
|--------------|--------|-------|-----------|------------|-------------|---------|
| **CARD** | QRIS | 0.7 | 0 | false | 0 | Bank/QRIS |
| **CARD** | Debit Card | 0.5 | 500 | false | 0 | Mesin EDC |
| **CARD** | Credit Card | 2.0 | 3000 | false | 0 | Visa/Master |
| **BANK** | GoPay | 20.0 | 2000 | true | 5.0 | Gojek |
| **BANK** | OVO | 15.0 | 1000 | true | 3.0 | OVO |
| **BANK** | DANA | 18.0 | 1500 | true | 4.0 | DANA |
| **BANK** | Transfer Bank | 0 | 0 | false | 0 | Manual |
| **CASH** | Tunai | 0 | 0 | false | 0 | Kasir |
| **COMPLIMENT** | Free | 0 | 0 | false | 0 | Promo |
| **MEMBER_DEPOSIT** | Saldo Anggota | 0 | 0 | false | 0 | Loyalty |
| **OTHER_COST** | Lainnya | 0 | 0 | false | 0 | Custom |

### Contoh Konfigurasi per Platform

#### 🟢 Cash / Tunai (Tanpa Fee)
```json
{
  "code": "CASH",
  "name": "Tunai",
  "payment_type": "CASH",
  "fee_percentage": 0,
  "fee_fixed_amount": 0,
  "fee_fixed_per_transaction": false,
  "marketing_fee_percentage": 0
}
```

#### 🟡 QRIS (MDR 0.7%)
```json
{
  "code": "QRIS",
  "name": "QRIS",
  "payment_type": "CARD",
  "fee_percentage": 0.7,
  "fee_fixed_amount": 0,
  "fee_fixed_per_transaction": false,
  "marketing_fee_percentage": 0
}
```

**Perhitungan:**
| Gross Amount | Fee (0.7%) | Nett |
|--------------|------------|------|
| 100,000 | 700 | 99,300 |
| 500,000 | 3,500 | 496,500 |
| 1,000,000 | 7,000 | 993,000 |

#### 🔴 GoPay (Platform Fee + Marketing)
```json
{
  "code": "GOPAY",
  "name": "GoPay",
  "payment_type": "BANK",
  "fee_percentage": 20.0,
  "fee_fixed_amount": 2000,
  "fee_fixed_per_transaction": true,
  "marketing_fee_percentage": 5.0
}
```

**Perhitungan (10 transaksi @ Rp 150,000 = Rp 1,500,000):**
```
Gross Amount                    : Rp 1,500,000
Transaction Count               : 10

Percentage Fee (20%)            : Rp   300,000
Fixed Fee (10 × 2,000)          : Rp    20,000
─────────────────────────────────────────
Total Fee                       : Rp   320,000

Nett (Sebelum Marketing)        : Rp 1,180,000
Marketing Fee (5% × 1,180,000)  : Rp    59,000
─────────────────────────────────────────
FINAL NETT                      : Rp 1,121,000
```

#### 🟣 OVO (Platform Fee)
```json
{
  "code": "OVO",
  "name": "OVO",
  "payment_type": "BANK",
  "fee_percentage": 15.0,
  "fee_fixed_amount": 1000,
  "fee_fixed_per_transaction": true,
  "marketing_fee_percentage": 3.0
}
```

**Perhitungan (5 transaksi @ Rp 200,000 = Rp 1,000,000):**
```
Gross Amount                    : Rp 1,000,000
Transaction Count               : 5

Percentage Fee (15%)            : Rp   150,000
Fixed Fee (5 × 1,000)           : Rp     5,000
─────────────────────────────────────────
Total Fee                       : Rp   155,000

Nett (Sebelum Marketing)        : Rp   845,000
Marketing Fee (3% × 845,000)    : Rp    25,350
─────────────────────────────────────────
FINAL NETT                      : Rp   819,650
```

#### 🔵 Credit Card (High Fee)
```json
{
  "code": "CC",
  "name": "Kartu Kredit",
  "payment_type": "CARD",
  "fee_percentage": 2.0,
  "fee_fixed_amount": 3000,
  "fee_fixed_per_transaction": false,
  "marketing_fee_percentage": 0
}
```

**Perhitungan (1 transaksi Rp 5,000,000):**
```
Gross Amount                    : Rp 5,000,000
Transaction Count               : 1

Percentage Fee (2%)             : Rp   100,000
Fixed Fee                       : Rp     3,000
─────────────────────────────────────────
Total Fee                       : Rp   103,000
FINAL NETT                      : Rp 4,897,000
```

---

## 🔄 FLOWCHART ALUR KERJA

### Alur 1: Setup Payment Method dengan Fee

```
┌─────────────────┐
│  Admin Login    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Create PM Form  │────▶│ Validate Input  │
└────────┬────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │ Check Duplicate │
         │              │ Code/Name       │
         │              └────────┬────────┘
         │                       │
         │          ┌────────────┴────────────┐
         │          │                         │
         │          ▼                         ▼
         │   ┌─────────────┐          ┌─────────────┐
         │   │  Valid ✅   │          │ Invalid ❌  │
         │   └──────┬──────┘          └─────────────┘
         │          │
         │          ▼
         │   ┌─────────────────┐
         │   │ Save Fee Config │
         │   │ to Database     │
         │   └────────┬────────┘
         │            │
         │            ▼
         │   ┌─────────────────┐
         │   │ Audit Log       │
         │   │ (CREATE action) │
         │   └────────┬────────┘
         │            │
         │            ▼
         │   ┌─────────────────┐
         │   │ Return Created  │
         │   │ Payment Method  │
         │   └─────────────────┘
         │
         ▼
┌─────────────────┐
│   PM Ready!     │
│   (With Fee)    │
└─────────────────┘
```

### Alur 2: Fee Calculation Process

```
┌─────────────────┐
│ Settlement Data │
│ (Multiple TX)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Get All PM with │────▶│ Filter Active   │
│ Fee Config      │     │ Only            │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Loop Through    │
│ Transactions    │
└────────┬────────┘
         │
         ▼
   ┌───────────────┐
   │ For Each TX   │
   └───────┬───────┘
           │
           ▼
   ┌───────────────┐
   │ Get Payment   │
   │ Method Config │
   └───────┬───────┘
           │
           ▼
   ┌───────────────┐     ┌─────────────────┐
   │ Calculate     │────▶│ Percentage Fee  │
   │ Fee           │     │ = Gross × %     │
   └───────────────┘     └─────────────────┘
                         │
                         ▼
               ┌─────────────────┐
               │ Fixed Fee       │
               │ = Fixed × Count │
               └─────────────────┘
                         │
                         ▼
               ┌─────────────────┐
               │ Total Fee       │
               │ = % Fee + Fixed │
               └─────────────────┘
                         │
                         ▼
               ┌─────────────────┐
               │ Marketing Fee   │
               │ = (Net × %)     │
               └─────────────────┘
                         │
                         ▼
               ┌─────────────────┐
               │ Expected Net    │
               │ = Gross - Fees  │
               └─────────────────┘
                         │
                         ▼
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐           ┌─────────────────┐
│ Sum All         │           │ Compare with    │
│ Expected Fees   │           │ Actual Fees     │
└────────┬────────┘           └────────┬────────┘
         │                             │
         └─────────────┬───────────────┘
                       │
                       ▼
             ┌─────────────────┐
             │ Fee Discrepancy │
             │ = Expected -    │
             │ Actual          │
             └─────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│ Discrepancy = 0 │         │ Discrepancy ≠ 0 │
│ ✅ Matched      │         │ ⚠️ Needs Review │
└─────────────────┘         └─────────────────┘
```

### Alur 3: Reconciliation Flow

```
┌─────────────────┐     ┌─────────────────┐
│ Start Daily     │────▶│ Import POS      │
│ Reconciliation  │     │ Transactions    │
└────────┬────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Get Payment     │────▶│ For each PM,    │
│ Methods         │     │ Calculate Fees  │
└────────┬────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Import Bank     │────▶│ Calculate       │
│ Statement       │     │ Expected Net    │
└────────┬────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Auto-Match      │────▶│ Matched ✅      │
│ Transactions    │     │ or              │
└────────┬────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │             ┌─────────────────┐
         │             │ Unmatched       │
         │             │ (Manual Review) │
         │             └────────┬────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│ Generate        │    │ Calculate       │
│ Journal Entries │    │ Marketing Fee   │
└────────┬────────┘    │ from Difference │
         │             └────────┬────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│ Submit for      │    │ Mark as         │
│ Approval        │    │ "Marketing Cost"│
└─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│ ✅ Reconciliation|
│   Complete      │
└─────────────────┘
```

### Alur 4: Error Handling Flow

```
┌─────────────────┐     ┌─────────────────┐
│ Fee Calculation │────▶│ Error Occurred  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Continue        │     │ Log Error       │
│ Processing      │     │ (with context)  │
└─────────────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │             ┌─────────────────┐
         │             │ Classify Error  │
         │             └────────┬────────┘
         │                      │
         │     ┌────────────────┼────────────────┐
         │     │                │                │
         │     ▼                ▼                ▼
         │ ┌──────────┐   ┌──────────┐   ┌──────────┐
         │ │Validation│   │Database  │   │ Business │
         │ │ Error    │   │ Error    │   │ Logic    │
         │ └────┬─────┘   └────┬─────┘   └────┬─────┘
         │      │              │              │
         │      ▼              ▼              ▼
         │ ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ │ Return   │  │ Retry    │  │ Skip &   │
         │ │ 400 Bad  │  │ 3x max   │  │ Continue │
         │ │ Request  │  │          │  │          │
         │ └──────────┘  └──────────┘  └──────────┘
         │
         ▼
┌─────────────────┐
│ Continue to     │
│ Next Transaction│
└─────────────────┘
```

---

## 🔧 TROUBLESHOOTING

### Masalah Umum & Solusi

#### ❌ Problem 1: Fee Percentage > 100%

**Gejala:**
```
Error: "Fee percentage tidak boleh lebih dari 100%"
```

**Penyebab:**
- User memasukkan fee percentage yang tidak valid (> 100)
- Kesalahan input pada form

**Solusi:**
```typescript
// Validasi di schema
fee_percentage: z.number()
  .min(0, 'Fee percentage tidak boleh negatif')
  .max(100, 'Fee percentage tidak boleh lebih dari 100%')
```

**Langkah Fix:**
1. Periksa input dari frontend
2. Tampilkan validasi real-time
3. Jika sudah tersimpan, update dengan nilai yang benar:
```sql
UPDATE payment_methods 
SET fee_percentage = 2.5 
WHERE id = 1 AND fee_percentage > 100;
```

---

#### ❌ Problem 2: Fee Config Tidak Ditemukan

**Gejala:**
```
logError: "Fee config not found for paymentMethodId: 999"
```

**Penyebab:**
- Transaksi menggunakan payment method yang tidak aktif
- Payment method sudah dihapus (soft delete)
- ID payment method tidak valid

**Solusi:**
```typescript
// Di fee-calculation.service.ts
async validatePaymentMethod(paymentMethodId: number): Promise<boolean> {
  const pm = await paymentMethodsRepository.findById(paymentMethodId)
  
  if (!pm) {
    throw PaymentMethodErrors.NOT_FOUND(paymentMethodId)
  }
  
  if (!pm.is_active) {
    throw PaymentMethodErrors.INACTIVE(paymentMethodId)
  }
  
  return true
}

// Handle graceful degradation
private mapToFeeCalculationInput(...): FeeCalculationInput {
  const config = feeConfigs.find(...)
  
  if (!config) {
    logWarn('Fee config not found, using defaults', { paymentMethodId })
    return {
      grossAmount: 0,
      transactionCount: 0,
      feePercentage: 0,  // Default: no fee
      feeFixedAmount: 0,
      feeFixedPerTransaction: false,
      marketingFeePercentage: 0
    }
  }
  
  return { ...config, grossAmount: 0, transactionCount: 0 }
}
```

**Langkah Fix:**
1. Cek apakah payment method masih aktif
2. Restore jika soft-deleted
3. Update settlement untuk menggunakan payment method yang benar

---

#### ❌ Problem 3: Negative Expected Net

**Gejala:**
```
Warning: "Expected net is negative for settlement X"
Gross: 100,000 | Fee: 150,000 | Net: -50,000
```

**Penyebab:**
- Fee percentage terlalu tinggi (> gross amount)
- Fixed fee terlalu besar
- Kombinasi percentage + fixed fee melebihi gross

**Solusi:**
```typescript
// Validasi sebelum calculate
validateFees(grossAmount: number, feePercentage: number, feeFixedAmount: number): void {
  const maxTotalFee = grossAmount * 0.99 // Maksimum 99%
  const estimatedFee = (grossAmount * feePercentage / 100) + feeFixedAmount
  
  if (estimatedFee > maxTotalFee) {
    logWarn('Fee terlalu tinggi untuk gross amount ini', {
      grossAmount,
      feePercentage,
      feeFixedAmount,
      estimatedFee
    })
  }
}

// Handle negative net di result
const expectedNet = grossAmount - totalExpectedFee
if (expectedNet < 0) {
  logWarn('Expected net is negative, setting to 0', { 
    settlementId, 
    expectedNet 
  })
  return 0
}
```

**Langkah Fix:**
1. Review fee configuration untuk payment method tersebut
2. Turunkan fee percentage atau fixed amount
3. Jika memang fee > gross, pertimbangkan untuk pakai fee maksimum = gross

---

#### ❌ Problem 4: Marketing Fee Tidak Sesuai Ekspektasi

**Gejala:**
```
Expected: Marketing fee dari nett (setelah fee utama)
Actual: Marketing fee dihitung dari gross
```

**Penyebab:**
- Kesalahan pemahaman formula
- Marketing fee seharusnya dari gross, bukan nett

**Solusi:**
Pahami alur perhitungan yang benar:

```typescript
// ✅ BENAR: Marketing fee dari nett
const grossAmount = 1_000_000
const feePercentage = 20
const feeFixedAmount = 2000
const marketingFeePct = 5

// Fee utama
const mainFee = (1_000_000 * 20 / 100) + 2000 = 220_000
const nettAfterMainFee = 1_000_000 - 220_000 = 780_000

// Marketing fee (dari nett, BUKAN dari gross!)
const marketingFee = 780_000 * 5 / 100 = 39_000
const finalNett = 780_000 - 39_000 = 741_000
```

**Perbandingan:**

| Skema | Fee Utama | Nett | Marketing Fee | Final Nett |
|-------|-----------|------|---------------|------------|
| Dari Gross ❌ | 220,000 | 780,000 | 50,000 (5%×1M) | 730,000 |
| Dari Nett ✅ | 220,000 | 780,000 | 39,000 (5%×780K) | 741,000 |

---

#### ❌ Problem 5: Fixed Fee Per Transaction vs Total

**Gejala:**
```
5 transaksi @ 200,000 dengan fixed fee 2,000
Expected: 10,000 (5 × 2,000)
Actual: 2,000 (1 × 2,000)
```

**Penyebab:**
- `fee_fixed_per_transaction` diset `false` tapi seharusnya `true`
- Kesalahan konfigurasi

**Solusi:**
```typescript
// FeeCalculationService
calculateFixedFee(
  fixedAmount: number,
  perTransaction: boolean,
  transactionCount: number
): number {
  if (perTransaction) {
    return fixedAmount * transactionCount  // 5 × 2,000 = 10,000
  } else {
    return fixedAmount  // 2,000 saja
  }
}
```

**Checklist Konfigurasi:**
| Payment Type | fee_fixed_per_transaction | Contoh |
|--------------|---------------------------|--------|
| GoPay/OVO/DANA | `true` | Per transaksi |
| EDC Card | `false` | Per settlement |
| QRIS | `false` | Per settlement |

---

#### ❌ Problem 6: Reconciliation Discrepancy Besar

**Gejala:**
```
Fee Discrepancy: Rp 500,000 (Expected: 100K, Actual: 600K)
```

**Penyebab:**
1. Fee configuration berubah setelah settlement dibuat
2. Platform menarik fee berbeda dari yang dikonfigurasi
3. Ada biaya tambahan yang tidak tercatat

**Solusi:**
```typescript
// Debug discrepancy
async debugDiscrepancy(settlementId: string): Promise<DebugResult> {
  return {
    settlement: await getSettlement(settlementId),
    paymentMethod: await getPaymentMethod(settlement.pm_id),
    expectedFee: calculateExpectedFee(settlement),
    actualFee: settlement.fee_amount,
    discrepancy: settlement.fee_amount - calculateExpectedFee(settlement),
    possibleCauses: [
      'Fee config changed after settlement',
      'Platform added new fee',
      'Currency conversion difference',
      'Manual fee adjustment'
    ],
    recommendedAction: 'Manual review required'
  }
}
```

**Langkah Investigasi:**
1. Cek history perubahan fee configuration
2. Bandingkan dengan invoice dari platform
3. Consult dengan finance team

---

#### ❌ Problem 7: Batch Processing Timeout

**Gejala:**
```
Error: "Request timeout after 30000ms"
```

**Penyebab:**
- Terlalu banyak transaksi (> 10,000)
- Query tidak optimal
- Tidak menggunakan pagination

**Solusi:**
```typescript
// Process dalam batch
async reconcileLargeSettlement(
  settlementId: string,
  options: { batchSize: number; delayMs: number } = { batchSize: 1000, delayMs: 100 }
): Promise<ReconciliationResult> {
  const { batchSize, delayMs } = options
  
  const transactions = await getAllTransactions(settlementId)
  const totalBatches = Math.ceil(transactions.length / batchSize)
  
  let results: FeeCalculationResult[] = []
  
  for (let i = 0; i < totalBatches; i++) {
    const batch = transactions.slice(i * batchSize, (i + 1) * batchSize)
    
    const batchResults = feeCalculationService.calculateBatchFees(
      batch.map(tx => ({
        grossAmount: tx.gross_amount,
        transactionCount: tx.transaction_count,
        paymentMethodFeeConfig: this.getFeeConfig(tx.payment_method_id)
      }))
    )
    
    results = [...results, ...batchResults.details]
    
    // Delay untuk prevent overload
    if (i < totalBatches - 1) {
      await delay(delayMs)
    }
    
    // Progress update
    logInfo('Batch processed', { 
      batch: i + 1, 
      total: totalBatches,
      progress: ((i + 1) / totalBatches * 100).toFixed(1) + '%'
    })
  }
  
  return aggregateResults(results)
}
```

**Optimasi Tambahan:**
1. Tambah index pada kolom yang sering di-query
2. Cache fee configuration
3. Gunakan Redis untuk temporary storage

---

### 🚨 Error Codes Reference

| Code | Message | Severity | Action |
|------|---------|----------|--------|
| PM001 | Payment method not found | ERROR | Check ID, restore if needed |
| PM002 | Payment method inactive | WARN | Activate or use different PM |
| PM003 | Fee config not found | WARN | Use default (0 fee) |
| PM004 | Fee percentage invalid | ERROR | Validate input |
| PM005 | Fee exceeds gross amount | WARN | Alert admin |
| PM006 | Marketing fee invalid | ERROR | Validate input |
| REC001 | Reconciliation timeout | ERROR | Increase timeout/batch |
| REC002 | Large discrepancy detected | WARN | Manual review |
| REC003 | Auto-match failed | INFO | Manual match |

---

### 📞 Need Help?

Jika menghadapi masalah yang tidak ter-cover di sini:

1. **Check Logs:** `backend/logs/fee-reconciliation.log`
2. **Check Dashboard:** `/admin/reconciliation/dashboard`
3. **Contact:** Backend Team #support

---

**Last Updated:** 2024  
**Version:** 1.1  
**Focus:** Payment Method dengan FEE Configuration

