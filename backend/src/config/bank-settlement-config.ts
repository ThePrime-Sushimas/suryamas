/**
 * Bank Settlement Group Configuration
 * Environment-based configuration for settlement operations
 */

import { z } from 'zod';

// Configuration schema for validation
const bankSettlementConfigSchema = z.object({
  defaultTolerancePercent: z.number().min(0).max(1),
  differenceThreshold: z.number().min(0),
  maxAggregatesPerGroup: z.number().int().min(1).max(1000),
  maxPageSize: z.number().int().min(1).max(50000),
  defaultPageSize: z.number().int().min(1),
  suggestionMaxResults: z.number().int().min(1).max(50),
  suggestionDefaultTolerance: z.number().min(0).max(1),
});

export type BankSettlementConfig = z.infer<typeof bankSettlementConfigSchema>;

// Default configuration values
const defaultConfig: BankSettlementConfig = {
  defaultTolerancePercent: 0.05, // 5% tolerance
  differenceThreshold: 100, // Rp 100 difference threshold
  maxAggregatesPerGroup: 100,
  maxPageSize: 50000,
  defaultPageSize: 10000,
  suggestionMaxResults: 20,
  suggestionDefaultTolerance: 0.05,
};

// Load configuration from environment variables with fallbacks
export const bankSettlementConfig: BankSettlementConfig = {
  defaultTolerancePercent: parseFloat(process.env.SETTLEMENT_TOLERANCE_PERCENT || defaultConfig.defaultTolerancePercent.toString()),
  differenceThreshold: parseInt(process.env.SETTLEMENT_DIFFERENCE_THRESHOLD || defaultConfig.differenceThreshold.toString()),
  maxAggregatesPerGroup: parseInt(process.env.MAX_AGGREGATES_PER_GROUP || defaultConfig.maxAggregatesPerGroup.toString()),
  maxPageSize: parseInt(process.env.SETTLEMENT_MAX_PAGE_SIZE || defaultConfig.maxPageSize.toString()),
  defaultPageSize: parseInt(process.env.SETTLEMENT_DEFAULT_PAGE_SIZE || defaultConfig.defaultPageSize.toString()),
  suggestionMaxResults: parseInt(process.env.SETTLEMENT_SUGGESTION_MAX_RESULTS || defaultConfig.suggestionMaxResults.toString()),
  suggestionDefaultTolerance: parseFloat(process.env.SETTLEMENT_SUGGESTION_TOLERANCE || defaultConfig.suggestionDefaultTolerance.toString()),
};

// Validate configuration on module load
try {
  bankSettlementConfigSchema.parse(bankSettlementConfig);
} catch (error) {
  throw new Error(`Invalid bank settlement configuration: ${error}`);
}

// Export for use in other modules
export default bankSettlementConfig;
