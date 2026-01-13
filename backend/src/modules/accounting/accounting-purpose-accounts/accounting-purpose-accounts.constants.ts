export const AccountingPurposeAccountsConfig = {
  SIDES: ['DEBIT', 'CREDIT'] as const,
  
  EXPORT: {
    MAX_ROWS: 10000,
    FILENAME_PREFIX: 'accounting-purpose-accounts'
  },
  
  VALIDATION: {
    MAX_PRIORITY: 999,
    MIN_PRIORITY: 1,
    MAX_BULK_OPERATIONS: 100
  },
  
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
}