/**
 * Fee Calculation Service
 * Handles compound fee calculations (percentage + fixed per transaction)
 */

export interface FeeCalculationInput {
  grossAmount: number
  transactionCount: number
  feePercentage: number
  feeFixedAmount: number
  feeFixedPerTransaction: boolean
}

export interface FeeCalculationResult {
  percentageAmount: number
  fixedAmount: number
  totalExpectedFee: number
  expectedNet: number
}

export class FeeCalculationService {
  /**
   * Calculate compound fee
   * 
   * @param input - Fee calculation input
   * @returns Fee calculation result
   */
  calculateCompoundFee(input: FeeCalculationInput): FeeCalculationResult {
    const { grossAmount, transactionCount, feePercentage, feeFixedAmount, feeFixedPerTransaction } = input
    
    // Calculate percentage fee
    const percentageAmount = grossAmount * (feePercentage / 100)
    
    // Calculate fixed fee
    const fixedAmount = feeFixedPerTransaction 
      ? transactionCount * feeFixedAmount 
      : feeFixedAmount
    
    // Calculate total expected fee
    const totalExpectedFee = percentageAmount + fixedAmount
    
    // Calculate expected net
    const expectedNet = grossAmount - totalExpectedFee
    
    return {
      percentageAmount,
      fixedAmount,
      totalExpectedFee,
      expectedNet
    }
  }

  /**
   * Calculate simple percentage fee
   */
  calculatePercentageFee(grossAmount: number, percentage: number): number {
    return grossAmount * (percentage / 100)
  }

  /**
   * Calculate simple fixed fee
   */
  calculateFixedFee(fixedAmount: number, perTransaction: boolean = false, transactionCount: number = 1): number {
    return perTransaction ? fixedAmount * transactionCount : fixedAmount
  }
}

