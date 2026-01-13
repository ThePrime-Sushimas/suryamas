/**
 * Configuration interface for accounting purposes module
 * Defines cache settings, operational limits, and validation rules
 */
export interface AccountingPurposesConfig {
  cache: {
    /** Cache time-to-live in milliseconds */
    ttl: number
    /** Maximum number of cache entries */
    maxSize: number
    /** Cache cleanup interval in milliseconds */
    cleanupInterval: number
  }
  limits: {
    /** Maximum records for bulk update operations */
    bulkUpdate: number
    /** Maximum records for bulk delete operations */
    bulkDelete: number
    /** Maximum records for export operations */
    export: number
    /** Maximum page size for pagination */
    pageSize: number
  }
  validation: {
    /** Maximum length for purpose code */
    purposeCodeMaxLength: number
    /** Maximum length for purpose name */
    purposeNameMaxLength: number
    /** Maximum length for description */
    descriptionMaxLength: number
  }
  correlation: {
    /** Prefix for correlation IDs */
    idPrefix: string
    /** Entropy bytes for correlation ID generation */
    entropyBytes: number
  }
}

/**
 * Validates and parses environment variable as integer
 * @param envVar Environment variable value
 * @param defaultValue Default value if parsing fails
 * @returns Parsed integer or default value
 */
function parseEnvInt(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) return defaultValue
  const parsed = parseInt(envVar, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

export const defaultConfig: AccountingPurposesConfig = {
  cache: {
    ttl: parseEnvInt(process.env.ACCOUNTING_PURPOSES_CACHE_TTL, 300000), // 5 minutes
    maxSize: parseEnvInt(process.env.ACCOUNTING_PURPOSES_CACHE_MAX_SIZE, 1000),
    cleanupInterval: parseEnvInt(process.env.ACCOUNTING_PURPOSES_CACHE_CLEANUP_INTERVAL, 60000) // 1 minute
  },
  limits: {
    bulkUpdate: parseEnvInt(process.env.ACCOUNTING_PURPOSES_BULK_UPDATE_LIMIT, 1000),
    bulkDelete: parseEnvInt(process.env.ACCOUNTING_PURPOSES_BULK_DELETE_LIMIT, 100),
    export: parseEnvInt(process.env.ACCOUNTING_PURPOSES_EXPORT_LIMIT, 10000),
    pageSize: parseEnvInt(process.env.ACCOUNTING_PURPOSES_PAGE_SIZE_LIMIT, 1000)
  },
  validation: {
    purposeCodeMaxLength: parseEnvInt(process.env.ACCOUNTING_PURPOSES_CODE_MAX_LENGTH, 50),
    purposeNameMaxLength: parseEnvInt(process.env.ACCOUNTING_PURPOSES_NAME_MAX_LENGTH, 255),
    descriptionMaxLength: parseEnvInt(process.env.ACCOUNTING_PURPOSES_DESCRIPTION_MAX_LENGTH, 500)
  },
  correlation: {
    idPrefix: process.env.ACCOUNTING_PURPOSES_CORRELATION_PREFIX || 'ap',
    entropyBytes: parseEnvInt(process.env.ACCOUNTING_PURPOSES_CORRELATION_ENTROPY, 8)
  }
}

/** Applied to types for accounting purposes */
export const APPLIED_TO_TYPES = ['SALES', 'PURCHASE', 'CASH', 'BANK', 'INVENTORY'] as const