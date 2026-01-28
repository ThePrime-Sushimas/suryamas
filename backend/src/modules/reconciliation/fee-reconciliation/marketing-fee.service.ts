/**
 * Marketing Fee Service
 * Handles marketing fee identification from difference between expected and actual
 * 
 * 🎯 KEY INSIGHT:
 * Marketing Fee = Expected Net (dari fee config) - Actual dari Bank
 * 
 * Flow:
 * 1. POS IMPORT → AGGREGATED (per payment method)
 * 2. HITUNG EXPECTED: Gross - (percentage_fee + fixed_fee)
 * 3. COMPARE: Expected vs Actual dari mutasi bank
 * 4. SELISIH = Marketing Fee (input manual)
 * 
 * @see PAYMENT_METHOD_FEE_MD.md for detailed documentation
 */

import { logInfo, logWarn, logError } from '../../../config/logger'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input untuk marketing fee calculation
 */
export interface MarketingFeeInput {
  expectedNet: number              // Nett setelah fee (percentage + fixed)
  actualFromBank: number           // Amount yang masuk ke bank
  paymentMethodCode: string
  transactionDate: Date
}

/**
 * Hasil identifikasi marketing fee
 */
export interface MarketingFeeResult {
  paymentMethodCode: string
  transactionDate: Date
  expectedNet: number              // Dari fee config
  actualFromBank: number           // Dari bank statement
  difference: number               // expected - actual
  marketingFee: number             // Selisih positif = advertising cost
  status: 'MATCHED' | 'DISCREPANCY' | 'REVIEW_REQUIRED'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  isWithinTolerance: boolean
  needsReview: boolean
}

/**
 * Batch result summary
 */
export interface MarketingFeeSummary {
  totalTransactions: number
  totalExpectedNet: number
  totalActualFromBank: number
  totalMarketingFee: number
  matchedCount: number
  discrepancyCount: number
  needsReviewCount: number
  results: MarketingFeeResult[]
}

/**
 * Manual review input
 */
export interface ManualMarketingFeeInput {
  reconciliationId: string
  suggestedMarketingFee: number
  actualMarketingFee: number
  notes?: string
  adjustedBy: string
}

// ============================================================================
// MARKETING FEE SERVICE
// ============================================================================

export class MarketingFeeService {
  
  /**
   * Identify marketing fee dari difference antara expected net dan actual bank
   * 
   * Marketing Fee = Expected Net - Actual From Bank
   * 
   * @param input - Marketing fee input
   * @returns Marketing fee result
   */
  identifyMarketingFee(input: MarketingFeeInput): MarketingFeeResult {
    const { expectedNet, actualFromBank, paymentMethodCode, transactionDate } = input
    
    // 1. Calculate difference
    const difference = expectedNet - actualFromBank
    
    // 2. Determine status
    const isPositiveDiff = difference > 0
    const isMatched = Math.abs(difference) < 1 // Tolerance 1 rupiah

    // 3. Determine confidence based on difference magnitude
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'
    let marketingFee = 0
    let status: 'MATCHED' | 'DISCREPANCY' | 'REVIEW_REQUIRED' = 'MATCHED'
    let needsReview = false

    if (isMatched) {
      // Tidak ada selisih - matched
      status = 'MATCHED'
      confidence = 'HIGH'
      marketingFee = 0
      needsReview = false
    } else if (isPositiveDiff) {
      // Selisih positif - kemungkinan marketing/advertising fee
      status = 'DISCREPANCY'
      marketingFee = difference
      needsReview = true // Selalu perlu review untuk marketing fee

      // Confidence berdasarkan magnitude relative terhadap expected
      const diffPercentage = (difference / expectedNet) * 100
      if (diffPercentage > 20) {
        confidence = 'LOW' // Terlalu besar, perlu investigasi
        logWarn('Marketing fee suspicion: difference > 20%', {
          paymentMethodCode,
          expectedNet,
          actualFromBank,
          difference,
          diffPercentage
        })
      } else if (diffPercentage > 10) {
        confidence = 'MEDIUM'
      } else {
        confidence = 'HIGH' // Normal range untuk marketing fee
      }
    } else {
      // Selisih negatif - undercharge atau ada promo dari platform
      status = 'DISCREPANCY'
      marketingFee = 0 // Negative difference bukan marketing fee
      needsReview = true // Perlu investigasi
      confidence = 'LOW'

      logWarn('Negative difference detected - possible platform promo', {
        paymentMethodCode,
        expectedNet,
        actualFromBank,
        difference
      })
    }

    return {
      paymentMethodCode,
      transactionDate,
      expectedNet,
      actualFromBank,
      difference,
      marketingFee,
      status,
      confidence,
      isWithinTolerance: isMatched,
      needsReview
    }
  }

  /**
   * Batch processing untuk multiple reconciliations
   */
  identifyBatchMarketingFees(
    inputs: MarketingFeeInput[]
  ): MarketingFeeSummary {
    const results: MarketingFeeResult[] = inputs.map(input => 
      this.identifyMarketingFee(input)
    )

    let totalExpectedNet = 0
    let totalActualFromBank = 0
    let totalMarketingFee = 0
    let matchedCount = 0
    let discrepancyCount = 0
    let needsReviewCount = 0

    for (const result of results) {
      totalExpectedNet += result.expectedNet
      totalActualFromBank += result.actualFromBank
      totalMarketingFee += result.marketingFee

      if (result.status === 'MATCHED') {
        matchedCount++
      } else {
        discrepancyCount++
      }

      if (result.needsReview) {
        needsReviewCount++
      }
    }

    return {
      totalTransactions: results.length,
      totalExpectedNet,
      totalActualFromBank,
      totalMarketingFee,
      matchedCount,
      discrepancyCount,
      needsReviewCount,
      results
    }
  }

  /**
   * Validate manual marketing fee adjustment
   * 
   * @param suggestedFee - Fee yang suggested dari sistem (difference)
   * @param actualFee - Fee yang diinput manual oleh user
   * @returns Validation result dengan warning jika ada perbedaan signifikan
   */
  validateManualAdjustment(
    suggestedFee: number,
    actualFee: number
  ): { isValid: boolean; warning?: string } {
    if (suggestedFee === 0 && actualFee === 0) {
      return { isValid: true }
    }

    if (suggestedFee === 0 && actualFee > 0) {
      return { 
        isValid: true,
        warning: 'Sistem tidak mendeteksi marketing fee, tapi Anda input fee. Mohon konfirmasi.'
      }
    }

    if (suggestedFee > 0 && actualFee === 0) {
      return {
        isValid: true,
        warning: 'Sistem mendeteksi marketing fee, tapi Anda set ke 0. Mohon konfirmasi.'
      }
    }

    const diff = Math.abs(suggestedFee - actualFee)
    const diffPercentage = (diff / suggestedFee) * 100

    // Warning jika adjustment berbeda > 20% dari suggestion
    if (diffPercentage > 20) {
      return {
        isValid: true,
        warning: `Adjustment berbeda ${diffPercentage.toFixed(1)}% dari suggestion. Perhatikan reason.`
      }
    }

    return { isValid: true }
  }

  /**
   * Calculate tolerance untuk auto-match
   */
  calculateTolerance(
    expectedNet: number,
    tolerancePercentage: number = 1
  ): number {
    return expectedNet * (tolerancePercentage / 100)
  }

  /**
   * Check jika within tolerance
   */
  isWithinTolerance(
    expectedNet: number,
    actualFromBank: number,
    tolerancePercentage: number = 1
  ): boolean {
    const tolerance = this.calculateTolerance(expectedNet, tolerancePercentage)
    return Math.abs(expectedNet - actualFromBank) <= tolerance
  }

  /**
   * Generate report untuk finance team
   */
  generateMarketingFeeReport(
    summary: MarketingFeeSummary,
    period: { startDate: Date; endDate: Date }
  ): {
    period: string
    totalMarketingFee: number
    byPaymentMethod: { [key: string]: number }
    needsReview: MarketingFeeResult[]
    recommendation: string
  } {
    // Group by payment method
    const byPaymentMethod: { [key: string]: number } = {}
    const needsReview: MarketingFeeResult[] = []

    for (const result of summary.results) {
      byPaymentMethod[result.paymentMethodCode] = 
        (byPaymentMethod[result.paymentMethodCode] || 0) + result.marketingFee
      
      if (result.needsReview) {
        needsReview.push(result)
      }
    }

    // Generate recommendation
    let recommendation = 'OK'
    if (summary.needsReviewCount > summary.totalTransactions * 0.1) {
      recommendation = 'WARNING: More than 10% transactions need review'
    }
    if (summary.totalMarketingFee > summary.totalExpectedNet * 0.1) {
      recommendation = 'ALERT: Marketing fee > 10% of expected net'
    }

    return {
      period: `${period.startDate.toISOString()} - ${period.endDate.toISOString()}`,
      totalMarketingFee: summary.totalMarketingFee,
      byPaymentMethod,
      needsReview,
      recommendation
    }
  }
}

// Export instance
export const marketingFeeService = new MarketingFeeService()

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Simple function untuk calculate marketing fee dari difference
 */
export function calculateSimpleMarketingFee(
  expectedNet: number,
  actualFromBank: number
): number {
  const difference = expectedNet - actualFromBank
  // Marketing fee hanya jika positive (kita dapat kurang)
  return difference > 0 ? difference : 0
}

/**
 * Check jika difference within tolerance
 */
export function isMarketingFeeWithinTolerance(
  expectedNet: number,
  actualFromBank: number,
  tolerancePercentage: number = 1
): boolean {
  const tolerance = expectedNet * (tolerancePercentage / 100)
  return Math.abs(expectedNet - actualFromBank) <= tolerance
}

