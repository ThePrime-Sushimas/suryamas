/**
 * Fee Reconciliation Config
 * Configuration for fee reconciliation module
 * 
 * Matches pattern from bank-reconciliation.config.ts
 */

import { z } from 'zod'

/**
 * Fee Reconciliation runtime configuration
 */
export interface FeeReconciliationConfig {
  /**
   * Default tolerance percentage for auto-match (1% = 0.01)
   */
  defaultTolerancePercentage: number
  
  /**
   * Maximum tolerance percentage allowed
   */
  maxTolerancePercentage: number
  
  /**
   * Minimum absolute difference for manual review (Rp)
   */
  reviewThreshold: number
  
  /**
   * Batch size for daily reconciliation
   */
  batchSize: number
  
  /**
   * Date buffer days for bank statement lookup (±)
   */
  dateBufferDays: number
  
  /**
   * Maximum marketing fee percentage of gross (sanity check)
   */
  maxMarketingFeePercent: number
}

/**
 * Default configuration
 */
const defaultConfig: FeeReconciliationConfig = {
  defaultTolerancePercentage: 1.0,    // 1%
  maxTolerancePercentage: 5.0,         // Max 5%
  reviewThreshold: 1000,               // Rp 1,000
  batchSize: 50,                       // Process 50 payment methods at once
  dateBufferDays: 2,                   // ±2 days for bank matching
  maxMarketingFeePercent: 10.0,        // Max 10% of gross
}

/**
 * Validate config
 */
const configSchema = z.object({
  defaultTolerancePercentage: z.number().min(0).max(10),
  maxTolerancePercentage: z.number().min(0.1).max(20),
  reviewThreshold: z.number().min(0).max(100000),
  batchSize: z.number().int().min(1).max(200),
  dateBufferDays: z.number().int().min(0).max(7),
  maxMarketingFeePercent: z.number().min(0).max(50),
})

/**
 * Get validated configuration
 * Throws if invalid
 */
export function getFeeReconciliationConfig(): FeeReconciliationConfig {
  const config = { ...defaultConfig }
  
  // Validate
  const result = configSchema.safeParse(config)
  if (!result.success) {
    throw new Error(`Invalid fee reconciliation config: ${result.error.message}`)
  }
  
  return config
}

/**
 * Convenience exports
 */
export const feeReconciliationConfig = getFeeReconciliationConfig()
// Export type { FeeReconciliationConfig }

