export const BANKS_CONFIG = {
  PAGINATION: {
    DEFAULT_LIMIT: parseInt(process.env.BANKS_PAGE_SIZE || '10'),
    MAX_LIMIT: parseInt(process.env.BANKS_MAX_PAGE_SIZE || '100')
  },
  CACHE: {
    TTL_SECONDS: parseInt(process.env.BANKS_CACHE_TTL || '3600'),
    KEY_PREFIX: 'banks:'
  },
  VALIDATION: {
    BANK_CODE_MIN_LENGTH: 2,
    BANK_CODE_MAX_LENGTH: 20,
    BANK_CODE_PATTERN: /^[A-Z0-9_]+$/,
    BANK_NAME_MIN_LENGTH: 3,
    BANK_NAME_MAX_LENGTH: 100
  },
  RATE_LIMIT: {
    CREATE_MAX: 10,
    UPDATE_MAX: 20,
    WINDOW_MS: 60000
  }
} as const

export const BANK_ACCOUNTS_CONFIG = {
  PAGINATION: {
    DEFAULT_LIMIT: parseInt(process.env.BANK_ACCOUNTS_PAGE_SIZE || '10'),
    MAX_LIMIT: parseInt(process.env.BANK_ACCOUNTS_MAX_PAGE_SIZE || '100')
  },
  VALIDATION: {
    ACCOUNT_NAME_MAX_LENGTH: 150,
    ACCOUNT_NUMBER_MAX_LENGTH: 50,
    ACCOUNT_NUMBER_PATTERN: /^[0-9]+$/
  }
} as const
