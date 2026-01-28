/**
 * Fee Calculation Service - Unit Tests
 * 
 * Test cases untuk fee calculation logic
 * VERSI BARU: Marketing Fee = SELISIH expected vs actual, bukan di payment method!
 * 
 * @see PAYMENT_METHOD_FEE_MD.md untuk detailed documentation
 */

import { 
  FeeCalculationService, 
  FeeConfig,
  FeeCalculationResult
} from './fee-calculation.service'

// ============================================================================
// TEST SETUP
// ============================================================================

describe('FeeCalculationService (New Flow)', () => {
  let service: FeeCalculationService

  beforeEach(() => {
    service = new FeeCalculationService()
  })

  // ============================================================================
  // TEST: calculateExpectedNet() - Gojek (per transaction)
  // ============================================================================

  describe('calculateExpectedNet() - Gojek (20% + 500 per transaksi)', () => {
    it('should calculate for 1 transaction @ Rp 100,000', () => {
      const result = service.calculateExpectedNet(100000, 1, {
        fee_percentage: 20,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: true
      })

      expect(result.grossAmount).toBe(100000)
      expect(result.transactionCount).toBe(1)
      expect(result.percentageFee).toBe(20000) // 100,000 × 20%
      expect(result.fixedFee).toBe(500) // 1 × 500
      expect(result.totalFee).toBe(20500)
      expect(result.expectedNet).toBe(79500) // 100,000 - 20,500
    })

    it('should calculate for 3 transactions @ Rp 100,000 each (total Rp 300,000)', () => {
      const result = service.calculateExpectedNet(300000, 3, {
        fee_percentage: 20,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: true
      })

      expect(result.grossAmount).toBe(300000)
      expect(result.percentageFee).toBe(60000) // 300,000 × 20%
      expect(result.fixedFee).toBe(1500) // 3 × 500
      expect(result.totalFee).toBe(61500)
      expect(result.expectedNet).toBe(238500) // 300,000 - 61,500
    })

    it('should calculate for 10 transactions @ Rp 150,000 each (total Rp 1,500,000)', () => {
      const result = service.calculateExpectedNet(1500000, 10, {
        fee_percentage: 20,
        fee_fixed_amount: 2000,
        fee_fixed_per_transaction: true
      })

      expect(result.percentageFee).toBe(300000) // 1,500,000 × 20%
      expect(result.fixedFee).toBe(20000) // 10 × 2,000
      expect(result.totalFee).toBe(320000)
      expect(result.expectedNet).toBe(1180000)
    })

    it('should handle zero transactions', () => {
      const result = service.calculateExpectedNet(100000, 0, {
        fee_percentage: 20,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: true
      })

      expect(result.fixedFee).toBe(0) // 0 × 500 = 0
      expect(result.percentageFee).toBe(20000)
      expect(result.totalFee).toBe(20000)
      expect(result.expectedNet).toBe(80000)
    })
  })

  // ============================================================================
  // TEST: calculateExpectedNet() - QRIS (0.7% per total)
  // ============================================================================

  describe('calculateExpectedNet() - QRIS (0.7% per total)', () => {
    it('should calculate for 10 transactions @ Rp 50,000 each (total Rp 500,000)', () => {
      const result = service.calculateExpectedNet(500000, 10, {
        fee_percentage: 0.7,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: false
      })

      expect(result.percentageFee).toBe(3500) // 500,000 × 0.7%
      expect(result.fixedFee).toBe(0) // per total = false
      expect(result.totalFee).toBe(3500)
      expect(result.expectedNet).toBe(496500)
    })

    it('should calculate for 1 transaction @ Rp 1,000,000', () => {
      const result = service.calculateExpectedNet(1000000, 1, {
        fee_percentage: 0.7,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: false
      })

      expect(result.percentageFee).toBe(7000)
      expect(result.expectedNet).toBe(993000)
    })

    it('should NOT multiply fixed fee by transaction count when per_transaction = false', () => {
      const result = service.calculateExpectedNet(1000000, 5, {
        fee_percentage: 0,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: false
      })

      // Fixed fee hanya 500 (sekali), bukan 5 × 500
      expect(result.fixedFee).toBe(500)
      expect(result.totalFee).toBe(500)
      expect(result.expectedNet).toBe(999500)
    })
  })

  // ============================================================================
  // TEST: calculateExpectedNet() - Credit Card (2% + 3000 per total)
  // ============================================================================

  describe('calculateExpectedNet() - Credit Card (2% + 3000 per total)', () => {
    it('should calculate for 1 transaction @ Rp 5,000,000', () => {
      const result = service.calculateExpectedNet(5000000, 1, {
        fee_percentage: 2,
        fee_fixed_amount: 3000,
        fee_fixed_per_transaction: false
      })

      expect(result.percentageFee).toBe(100000) // 5,000,000 × 2%
      expect(result.fixedFee).toBe(3000) // per total
      expect(result.totalFee).toBe(103000)
      expect(result.expectedNet).toBe(4897000)
    })

    it('should calculate for 3 transactions @ Rp 2,000,000 each (total Rp 6,000,000)', () => {
      const result = service.calculateExpectedNet(6000000, 3, {
        fee_percentage: 2,
        fee_fixed_amount: 3000,
        fee_fixed_per_transaction: false
      })

      expect(result.percentageFee).toBe(120000)
      expect(result.fixedFee).toBe(3000) // per total, bukan per tx
      expect(result.totalFee).toBe(123000)
      expect(result.expectedNet).toBe(5877000)
    })
  })

  // ============================================================================
  // TEST: calculateMarketingFee() - Marketing Fee = SELISIH!
  // ============================================================================

  describe('calculateMarketingFee() - Marketing Fee = Expected - Actual', () => {
    it('should calculate marketing fee for Gojek scenario', () => {
      // Gojek: Expected Net = 238,500, Actual Bank = 200,000
      // Marketing Fee = 238,500 - 200,000 = 38,500
      const result = service.calculateMarketingFee(238500, 200000)

      expect(result.difference).toBe(38500)
      expect(result.marketingFee).toBe(38500)
      expect(result.isWithinTolerance).toBe(false)
      expect(result.needsReview).toBe(true)
    })

    it('should calculate marketing fee for QRIS (matched)', () => {
      // QRIS: Expected Net = 496,500, Actual Bank = 496,500
      // Marketing Fee = 0
      const result = service.calculateMarketingFee(496500, 496500)

      expect(result.difference).toBe(0)
      expect(result.marketingFee).toBe(0)
      expect(result.isWithinTolerance).toBe(true)
      expect(result.needsReview).toBe(false)
    })

    it('should return 0 marketing fee for negative difference (platform promo)', () => {
      // Jika kita dapat LEBIH dari expected (promo dari platform)
      const result = service.calculateMarketingFee(238500, 250000)

      expect(result.difference).toBe(-11500)
      expect(result.marketingFee).toBe(0) // Bukan advertising cost
      expect(result.needsReview).toBe(true) // Perlu investigasi
    })

    it('should respect tolerance', () => {
      // Within 1% tolerance
      const result = service.calculateMarketingFee(1000000, 995000, 1)

      expect(result.difference).toBe(5000)
      expect(result.isWithinTolerance).toBe(true) // 5000 <= 1% of 1000000 = 10000
      expect(result.needsReview).toBe(false)
    })

    it('should trigger review when outside tolerance', () => {
      const result = service.calculateMarketingFee(1000000, 980000, 1)

      expect(result.difference).toBe(20000)
      expect(result.isWithinTolerance).toBe(false) // 20000 > 10000
      expect(result.needsReview).toBe(true)
    })
  })

  // ============================================================================
  // TEST: Real-world Scenarios
  // ============================================================================

  describe('Real-world Scenarios', () => {
    it('should handle GoFood scenario from documentation', () => {
      // GoFood: 20% + 500 per tx, 10 transaksi @ 100,000
      const expected = service.calculateExpectedNet(1000000, 10, {
        fee_percentage: 20,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: true
      })

      expect(expected.percentageFee).toBe(200000) // 1M × 20%
      expect(expected.fixedFee).toBe(5000) // 10 × 500
      expect(expected.totalFee).toBe(205000)
      expect(expected.expectedNet).toBe(795000)

      // Bank actual = 750,000
      // Marketing Fee = 795,000 - 750,000 = 45,000
      const marketing = service.calculateMarketingFee(795000, 750000)
      expect(marketing.marketingFee).toBe(45000)
      expect(marketing.marketingFee).toBe(45000) // ~5.66% dari expected net
    })

    it('should handle QRIS scenario from documentation', () => {
      // QRIS: 0.7%, 5 transaksi @ 100,000
      const expected = service.calculateExpectedNet(500000, 5, {
        fee_percentage: 0.7,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: false
      })

      expect(expected.percentageFee).toBe(3500)
      expect(expected.fixedFee).toBe(0)
      expect(expected.expectedNet).toBe(496500)

      // Bank actual = 496,500 (matched!)
      const marketing = service.calculateMarketingFee(496500, 496500)
      expect(marketing.marketingFee).toBe(0)
      expect(marketing.isWithinTolerance).toBe(true)
    })
  })

  // ============================================================================
  // TEST: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle zero gross amount', () => {
      const result = service.calculateExpectedNet(0, 10, {
        fee_percentage: 20,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: true
      })

      expect(result.percentageFee).toBe(0)
      expect(result.fixedFee).toBe(5000)
      expect(result.totalFee).toBe(5000)
      expect(result.expectedNet).toBe(-5000) // Negative net
    })

    it('should handle negative gross amount (set to 0)', () => {
      const result = service.calculateExpectedNet(-100000, 1, {
        fee_percentage: 20,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: true
      })

      expect(result.grossAmount).toBe(0)
      expect(result.percentageFee).toBe(0)
    })

    it('should handle zero percentage fee', () => {
      const result = service.calculateExpectedNet(1000000, 5, {
        fee_percentage: 0,
        fee_fixed_amount: 1000,
        fee_fixed_per_transaction: true
      })

      expect(result.percentageFee).toBe(0)
      expect(result.fixedFee).toBe(5000)
      expect(result.totalFee).toBe(5000)
    })

    it('should handle zero fixed fee', () => {
      const result = service.calculateExpectedNet(1000000, 100, {
        fee_percentage: 2.5,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: true
      })

      expect(result.percentageFee).toBe(25000)
      expect(result.fixedFee).toBe(0)
      expect(result.totalFee).toBe(25000)
    })

    it('should handle 100% fee percentage (edge case)', () => {
      const result = service.calculateExpectedNet(1000000, 1, {
        fee_percentage: 100,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: false
      })

      expect(result.percentageFee).toBe(1000000)
      expect(result.totalFee).toBe(1000000)
      expect(result.expectedNet).toBe(0)
    })

    it('should handle fee > gross (negative net)', () => {
      const result = service.calculateExpectedNet(100000, 10, {
        fee_percentage: 50,
        fee_fixed_amount: 10000,
        fee_fixed_per_transaction: true
      })

      // Percentage: 100,000 × 50% = 50,000
      // Fixed: 10 × 10,000 = 100,000
      // Total: 150,000
      expect(result.percentageFee).toBe(50000)
      expect(result.fixedFee).toBe(100000)
      expect(result.totalFee).toBe(150000)
      expect(result.expectedNet).toBe(-50000)
    })
  })

  // ============================================================================
  // TEST: calculateFromPaymentMethod()
  // ============================================================================

  describe('calculateFromPaymentMethod()', () => {
    it('should calculate from payment method object', () => {
      const paymentMethod = {
        fee_percentage: 0.7,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: false
      }

      const result = service.calculateFromPaymentMethod(1000000, 10, paymentMethod)

      expect(result.percentageFee).toBe(7000)
      expect(result.fixedFee).toBe(0)
      expect(result.totalFee).toBe(7000)
      expect(result.expectedNet).toBe(993000)
    })
  })

  // ============================================================================
  // TEST: validateFeeConfig()
  // ============================================================================

  describe('validateFeeConfig()', () => {
    it('should validate correct fee config', () => {
      const result = service.validateFeeConfig({
        fee_percentage: 20,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: true
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject negative fee percentage', () => {
      const result = service.validateFeeConfig({
        fee_percentage: -5,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: true
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('fee_percentage tidak boleh negatif')
    })

    it('should reject fee percentage > 100', () => {
      const result = service.validateFeeConfig({
        fee_percentage: 150,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: true
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('fee_percentage tidak boleh lebih dari 100%')
    })

    it('should reject negative fixed amount', () => {
      const result = service.validateFeeConfig({
        fee_percentage: 20,
        fee_fixed_amount: -100,
        fee_fixed_per_transaction: true
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('fee_fixed_amount tidak boleh negatif')
    })

    it('should accept zero values', () => {
      const result = service.validateFeeConfig({
        fee_percentage: 0,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: false
      })

      expect(result.isValid).toBe(true)
    })
  })

  // ============================================================================
  // TEST: calculateMaxFee()
  // ============================================================================

  describe('calculateMaxFee()', () => {
    it('should calculate maximum fee for given gross amount', () => {
      const maxFee = service.calculateMaxFee(1000000, {
        fee_percentage: 20,
        fee_fixed_amount: 5000,
        fee_fixed_per_transaction: true
      })

      expect(maxFee).toBe(205000) // 200K + 5K
    })
  })

  // ============================================================================
  // TEST: Batch Calculation
  // ============================================================================

  describe('calculateBatchExpectedNets()', () => {
    it('should calculate for multiple transactions', () => {
      const transactions = [
        {
          grossAmount: 500000,
          transactionCount: 5,
          feeConfig: {
            fee_percentage: 20,
            fee_fixed_amount: 500,
            fee_fixed_per_transaction: true
          }
        },
        {
          grossAmount: 300000,
          transactionCount: 3,
          feeConfig: {
            fee_percentage: 0.7,
            fee_fixed_amount: 0,
            fee_fixed_per_transaction: false
          }
        }
      ]

      const result = service.calculateBatchExpectedNets(transactions)

      // Transaction 1: 20% × 500K = 100K, 5 × 500 = 2.5K, expected = 397.5K
      // Transaction 2: 0.7% × 300K = 2.1K, expected = 297.9K
      expect(result.totalGross).toBe(800000)
      expect(result.totalExpectedFee).toBe(104600) // 102500 + 2100
      expect(result.totalExpectedNet).toBe(695400) // 397500 + 297900
    })

    it('should handle empty array', () => {
      const result = service.calculateBatchExpectedNets([])

      expect(result.totalGross).toBe(0)
      expect(result.totalExpectedFee).toBe(0)
      expect(result.totalExpectedNet).toBe(0)
      expect(result.details).toHaveLength(0)
    })
  })

  // ============================================================================
  // TEST: formatFee()
  // ============================================================================

  describe('formatFee()', () => {
    it('should format Gojek fee', () => {
      const formatted = service.formatFee({
        fee_percentage: 20,
        fee_fixed_amount: 500,
        fee_fixed_per_transaction: true
      })

      expect(formatted).toBe('20% + Rp 500/tx')
    })

    it('should format QRIS fee', () => {
      const formatted = service.formatFee({
        fee_percentage: 0.7,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: false
      })

      expect(formatted).toBe('0.7%')
    })

    it('should format Credit Card fee', () => {
      const formatted = service.formatFee({
        fee_percentage: 2,
        fee_fixed_amount: 3000,
        fee_fixed_per_transaction: false
      })

      expect(formatted).toBe('2% + Rp 3,000')
    })

    it('should format Cash (gratis)', () => {
      const formatted = service.formatFee({
        fee_percentage: 0,
        fee_fixed_amount: 0,
        fee_fixed_per_transaction: false
      })

      expect(formatted).toBe('Gratis')
    })
  })
})

// ============================================================================
// CONVENIENCE FUNCTIONS TESTS
// ============================================================================

describe('Convenience Functions', () => {
  describe('calculateSimpleExpectedNet()', () => {
    it('should calculate simple expected net correctly', () => {
      const { fee, net } = calculateSimpleExpectedNet(100000, 10, 1000, true, 5)

      expect(fee).toBe(15000) // 10K + 5K
      expect(net).toBe(85000)
    })
  })

  describe('calculateSimpleMarketingFee()', () => {
    it('should calculate marketing fee from difference', () => {
      // Expected: 238,500, Actual: 200,000
      // Marketing Fee: 38,500
      const marketingFee = calculateSimpleMarketingFee(238500, 200000)
      expect(marketingFee).toBe(38500)
    })

    it('should return 0 for negative difference', () => {
      // Expected: 238,500, Actual: 250,000 (promo!)
      const marketingFee = calculateSimpleMarketingFee(238500, 250000)
      expect(marketingFee).toBe(0)
    })
  })

  describe('isMarketingFeeWithinTolerance()', () => {
    it('should return true when within tolerance', () => {
      const result = isMarketingFeeWithinTolerance(1000000, 995000, 1)
      expect(result).toBe(true)
    })

    it('should return false when outside tolerance', () => {
      const result = isMarketingFeeWithinTolerance(1000000, 980000, 1)
      expect(result).toBe(false)
    })
  })
})

// ============================================================================
// EXPORTED CONVENIENCE FUNCTIONS
// ============================================================================

function calculateSimpleExpectedNet(
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

function calculateSimpleMarketingFee(
  expectedNet: number,
  actualFromBank: number
): number {
  const difference = expectedNet - actualFromBank
  return difference > 0 ? difference : 0
}

function isMarketingFeeWithinTolerance(
  expectedNet: number,
  actualFromBank: number,
  tolerancePercentage: number = 1
): boolean {
  const tolerance = expectedNet * (tolerancePercentage / 100)
  return Math.abs(expectedNet - actualFromBank) <= tolerance
}

