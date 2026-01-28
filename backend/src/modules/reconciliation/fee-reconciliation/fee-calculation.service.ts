/**
 * Fee Calculation Service
 * Handles fee calculations (percentage + fixed per transaction)
 * 
 * Supports:
 * - Percentage-based fee (e.g., 0.7% MDR, 20% Gojek)
 * - Fixed fee per transaction (e.g., Rp 500 per tx)
 * - Fixed fee per total (e.g., Rp 3000 per settlement)
 * 
 * NOTE: Marketing Fee = Expected Net - Actual Bank Deposit (calculated during reconciliation)
 *       Bukan percentage di payment method!
 * 
 * @see PAYMENT_METHOD_FEE_MD.md for detailed documentation
 */

import { logInfo, logWarn, logError } from '../../../config/logger'

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Fee configuration dari payment method (HANYA 3 KOLOM)
 */
export interface FeeConfig {
  fee_percentage: number              // Persentase (contoh: 20.0 = 20%)
  fee_fixed_amount: number           // Fixed amount (contoh: 500 = Rp 500)
  fee_fixed_per_transaction: boolean // true = per transaksi, false = per total
}

/**
 * Input untuk perhitungan fee
 */
export interface FeeCalculationInput {
  grossAmount: number
  transactionCount: number
  fee_percentage: number
  fee_fixed_amount: number
  fee_fixed_per_transaction: boolean
}

/**
 * Hasil perhitungan fee
 */
export interface FeeCalculationResult {
  grossAmount: number
  transactionCount: number
  percentageFee: number              // gross × percentage
  fixedFee: number                   // fixed × count atau fixed
  totalFee: number                   // percentageFee + fixedFee
  expectedNet: number                // gross - totalFee (YANG DICOCOKKAN dengan bank)
}

/**
 * Batch calculation input
 */
export interface BatchFeeInput {
  grossAmount: number
  transactionCount: number
  feeConfig: FeeConfig
}

/**
 * Batch calculation result
 */
export interface BatchFeeResult {
  totalGross: number
  totalExpectedFee: number
  totalExpectedNet: number
  details: FeeCalculationResult[]
}

/**
 * Reconciliation result dengan marketing fee
 * Marketing fee = SELISIH expected vs actual
 */
export interface ReconciliationResult {
  paymentMethodId: number
  paymentMethodCode: string
  paymentMethodName: string
  date: Date
  
  // From POS aggregation
  totalGross: number
  transactionCount: number
  
  // Calculated expected
  percentageFee: number
  fixedFee: number
  totalFee: number
  expectedNet: number  // INI YANG DIBANDINGKAN dengan bank
  
  // From Bank Statement
  actualFromBank: number
  
  // Marketing Fee = SELISIH (Expected - Actual)
  difference: number
  marketingFee: number  // Positive = advertising cost
  
  // Status
  isWithinTolerance: boolean
  needsReview: boolean
}

// ============================================================================
// FEE CALCULATION SERVICE
// ============================================================================

export class FeeCalculationService {
  
  /**
   * Hitung expected net dari gross amount dan fee configuration
   * 
   * @param grossAmount - Total gross amount (semua transaksi)
   * @param transactionCount - Jumlah transaksi
   * @param feeConfig - Fee configuration dari payment method
   * @returns Fee calculation result dengan expectedNet (YANG DICOCOKKAN dengan bank)
   * 
   * @example
   * // Gojek: 20% + 500 per transaksi
   * const result = calculateExpectedNet(300000, 3, { fee_percentage: 20, fee_fixed_amount: 500, fee_fixed_per_transaction: true })
   * // Result: { percentageFee: 60000, fixedFee: 1500, totalFee: 61500, expectedNet: 238500 }
   */
  calculateExpectedNet(
    grossAmount: number,
    transactionCount: number,
    feeConfig: FeeConfig
  ): FeeCalculationResult {
    const { fee_percentage, fee_fixed_amount, fee_fixed_per_transaction } = feeConfig

    // Validasi input
    if (grossAmount < 0) {
      logWarn('calculateExpectedNet: grossAmount negatif, set ke 0', { grossAmount })
      grossAmount = 0
    }

    if (transactionCount < 0) {
      logWarn('calculateExpectedNet: transactionCount negatif, set ke 0', { transactionCount })
      transactionCount = 0
    }

    // 1. Hitung percentage fee (dari total gross)
    const percentageFee = grossAmount * (fee_percentage / 100)

    // 2. Hitung fixed fee
    const fixedFee = fee_fixed_per_transaction
      ? transactionCount * fee_fixed_amount  // Per transaksi
      : fee_fixed_amount                     // Per total

    // 3. Total fee
    const totalFee = percentageFee + fixedFee

    // 4. Expected net (YANG DICOCOKKAN dengan bank)
    const expectedNet = grossAmount - totalFee

    // Handle negative net ( fee > gross )
    if (expectedNet < 0) {
      logWarn('calculateExpectedNet: expectedNet negatif', { 
        grossAmount, 
        totalFee, 
        expectedNet 
      })
    }

    return {
      grossAmount,
      transactionCount,
      percentageFee,
      fixedFee,
      totalFee,
      expectedNet
    }
  }

  /**
   * Calculate marketing fee dari selisih expected vs actual
   * 
   * Marketing Fee = Expected Net - Actual From Bank
   * 
   * @param expectedNet - Dari calculateExpectedNet()
   * @param actualFromBank - Dari bank statement
   * @param tolerancePercentage - Tolerance untuk auto-match (default 1%)
   * @returns Reconciliation result dengan marketing fee
   */
  calculateMarketingFee(
    expectedNet: number,
    actualFromBank: number,
    tolerancePercentage: number = 1
  ): {
    difference: number           // expected - actual
    marketingFee: number         // Selisih positif = advertising cost
    isWithinTolerance: boolean
    needsReview: boolean
  } {
    const difference = expectedNet - actualFromBank
    const tolerance = expectedNet * (tolerancePercentage / 100)
    const isWithinTolerance = Math.abs(difference) <= tolerance
    const needsReview = !isWithinTolerance

    // Marketing fee hanya jika positive (kita dapat kurang dari expected)
    const marketingFee = difference > 0 ? difference : 0

    return {
      difference,
      marketingFee,
      isWithinTolerance,
      needsReview
    }
  }

  /**
   * Batch calculation untuk multiple transactions
   * Berguna untuk settlement dengan berbagai payment methods
   * 
   * @param transactions - Array of transactions dengan fee config
   * @returns Aggregated result
   */
  calculateBatchExpectedNets(transactions: BatchFeeInput[]): BatchFeeResult {
    let totalGross = 0
    let totalExpectedFee = 0
    let totalExpectedNet = 0
    const details: FeeCalculationResult[] = []

    for (const tx of transactions) {
      const result = this.calculateExpectedNet(
        tx.grossAmount,
        tx.transactionCount,
        tx.feeConfig
      )

      totalGross += result.grossAmount
      totalExpectedFee += result.totalFee
      totalExpectedNet += result.expectedNet

      details.push(result)
    }

    return {
      totalGross,
      totalExpectedFee,
      totalExpectedNet,
      details
    }
  }

  /**
   * Calculate expected net dari payment method object lengkap
   * Mengambil fee config langsung dari object PaymentMethod
   * 
   * @param grossAmount - Total gross amount
   * @param transactionCount - Jumlah transaksi
   * @param paymentMethod - Payment method object (dari payment-methods module)
   * @returns Fee calculation result
   */
  calculateFromPaymentMethod(
    grossAmount: number,
    transactionCount: number,
    paymentMethod: {
      fee_percentage: number
      fee_fixed_amount: number
      fee_fixed_per_transaction: boolean
    }
  ): FeeCalculationResult {
    const feeConfig: FeeConfig = {
      fee_percentage: paymentMethod.fee_percentage,
      fee_fixed_amount: paymentMethod.fee_fixed_amount,
      fee_fixed_per_transaction: paymentMethod.fee_fixed_per_transaction
    }

    return this.calculateExpectedNet(grossAmount, transactionCount, feeConfig)
  }

  /**
   * Validate fee configuration
   * Memastikan fee configuration valid sebelum disimpan
   * 
   * @param feeConfig - Fee configuration untuk divalidasi
   * @returns Object dengan isValid dan errors
   */
  validateFeeConfig(feeConfig: FeeConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (feeConfig.fee_percentage < 0) {
      errors.push('fee_percentage tidak boleh negatif')
    }

    if (feeConfig.fee_percentage > 100) {
      errors.push('fee_percentage tidak boleh lebih dari 100%')
    }

    if (feeConfig.fee_fixed_amount < 0) {
      errors.push('fee_fixed_amount tidak boleh negatif')
    }

    // Warning jika fee > 99% dari gross (akan menghasilkan negative net)
    if (feeConfig.fee_percentage > 99) {
      logWarn('validateFeeConfig: fee_percentage > 99%, kemungkinan menghasilkan negative net')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Calculate maximum possible fee untuk given gross amount
   * Berguna untuk validasi sebelum save
   * 
   * @param grossAmount - Gross amount yang akan dihitung
   * @param feeConfig - Fee configuration
   * @returns Maximum possible fee
   */
  calculateMaxFee(grossAmount: number, feeConfig: FeeConfig): number {
    const maxPercentageFee = grossAmount * (feeConfig.fee_percentage / 100)
    // Fixed fee sudah fixed, tidak ada "max" (kecuali jika per transaction, 
    // maka asumsikan 1 transaksi)
    const maxFixedFee = feeConfig.fee_fixed_amount
    
    return maxPercentageFee + maxFixedFee
  }

  /**
   * Format fee untuk display
   */
  formatFee(feeConfig: FeeConfig): string {
    const parts: string[] = []

    if (feeConfig.fee_percentage > 0) {
      parts.push(`${feeConfig.fee_percentage}%`)
    }

    if (feeConfig.fee_fixed_amount > 0) {
      const fixedLabel = feeConfig.fee_fixed_per_transaction 
        ? `Rp ${feeConfig.fee_fixed_amount.toLocaleString()}/tx`
        : `Rp ${feeConfig.fee_fixed_amount.toLocaleString()}`
      parts.push(fixedLabel)
    }

    return parts.length > 0 ? parts.join(' + ') : 'Gratis'
  }
}

// Export instance
export const feeCalculationService = new FeeCalculationService()

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Simple expected net calculation function
 * Cocok untuk use case yang sederhana
 * 
 * @param grossAmount - Total gross
 * @param feePercentage - Percentage fee (contoh: 2.5 = 2.5%)
 * @param fixedAmount - Fixed amount
 * @param perTransaction - Apakah fixed fee per transaksi
 * @param transactionCount - Jumlah transaksi (jika perTransaction = true)
 */
export function calculateSimpleExpectedNet(
  grossAmount: number,
  feePercentage: number,
  fixedAmount: number,
  perTransaction: boolean,
  transactionCount: number = 1
): { fee: number; net: number } {
  const percentageFee = grossAmount * (feePercentage / 100)
  const fixedFee = perTransaction 
    ? transactionCount * fixedAmount 
    : fixedAmount
  const totalFee = percentageFee + fixedFee
  const net = grossAmount - totalFee

  return { fee: totalFee, net }
}

/**
 * Calculate marketing fee dari difference
 * Marketing fee = expected - actual
 */
export function calculateMarketingFeeFromDifference(
  expectedNet: number,
  actualFromBank: number
): number {
  const difference = expectedNet - actualFromBank
  // Marketing fee hanya jika positive (kita dapat kurang)
  return difference > 0 ? difference : 0
}

/**
 * Check jika perbedaan within tolerance
 */
export function isWithinTolerance(
  expected: number,
  actual: number,
  tolerancePercentage: number = 1
): boolean {
  const tolerance = expected * (tolerancePercentage / 100)
  return Math.abs(expected - actual) <= tolerance
}

