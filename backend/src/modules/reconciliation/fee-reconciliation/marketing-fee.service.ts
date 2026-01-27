/**
 * Marketing Fee Service
 * Handles marketing fee identification from difference calculations
 */

export interface MarketingFeeInput {
  expectedNet: number
  bankSettlement: number
  platformCode: string
}

export interface MarketingFeeResult {
  difference: number
  hasMarketingFee: boolean
  identifiedAmount: number
  needsReview: boolean
}

export class MarketingFeeService {
  /**
   * Identify marketing fee from difference between expected net and bank settlement
   * 
   * @param input - Marketing fee input
   * @returns Marketing fee result
   */
  identifyMarketingFee(input: MarketingFeeInput): MarketingFeeResult {
    const { expectedNet, bankSettlement } = input
    
    // Calculate difference
    const difference = expectedNet - bankSettlement
    
    // If difference is positive, there might be marketing/ads fee
    const hasMarketingFee = difference > 0
    
    // Identified amount is the difference itself
    // This will be refined by marketing_fees configuration
    const identifiedAmount = hasMarketingFee ? difference : 0
    
    // Marketing fee always needs review before approval
    const needsReview = hasMarketingFee
    
    return {
      difference,
      hasMarketingFee,
      identifiedAmount,
      needsReview
    }
  }

  /**
   * Calculate marketing fee based on configuration
   */
  calculateMarketingFee(difference: number, calculationType: string, rate?: number): number {
    switch (calculationType) {
      case 'PERCENTAGE_OF_DIFFERENCE':
        return difference * ((rate || 100) / 100)
      case 'FIXED':
        return rate || 0
      case 'MANUAL':
      default:
        return difference // Use full difference for manual review
    }
  }
}

