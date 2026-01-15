// payment-methods.errors.ts

/**
 * Custom error class for payment method errors
 */
export class PaymentMethodError extends Error {
  public readonly code: string
  public readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message)
    this.name = 'PaymentMethodError'
    this.code = code
    this.statusCode = statusCode
  }
}

/**
 * Error factory for common payment method errors
 */
export const PaymentMethodErrors = {
  NOT_FOUND: (id?: number | string) => new PaymentMethodError(
    `Payment method not found${id ? `: ${id}` : ''}`,
    'PAYMENT_METHOD_NOT_FOUND',
    404
  ),

  COMPANY_NOT_FOUND: (companyId: string) => new PaymentMethodError(
    'Company not found',
    'COMPANY_NOT_FOUND',
    404
  ),

  COMPANY_ACCESS_DENIED: (companyId: string) => new PaymentMethodError(
    'You do not have permission to access this company data',
    'COMPANY_ACCESS_DENIED',
    403
  ),

  BANK_ACCOUNT_NOT_FOUND: (bankAccountId: number) => new PaymentMethodError(
    `Bank account not found: ${bankAccountId}`,
    'BANK_ACCOUNT_NOT_FOUND',
    404
  ),

  COA_ACCOUNT_NOT_FOUND: (coaAccountId: string) => new PaymentMethodError(
    `Chart of account not found: ${coaAccountId}`,
    'COA_ACCOUNT_NOT_FOUND',
    404
  ),

  COA_NOT_POSTABLE: (coaCode: string) => new PaymentMethodError(
    `Chart of account '${coaCode}' is not postable`,
    'COA_NOT_POSTABLE',
    400
  ),

  CODE_EXISTS: (code: string, companyId: string) => new PaymentMethodError(
    `Payment method code '${code}' already exists in this company`,
    'PAYMENT_METHOD_CODE_EXISTS',
    409
  ),

  INVALID_PAYMENT_TYPE: (paymentType: string) => new PaymentMethodError(
    `Invalid payment type: ${paymentType}`,
    'INVALID_PAYMENT_TYPE',
    400
  ),

  BANK_ACCOUNT_INACTIVE: (bankAccountId: number) => new PaymentMethodError(
    `Bank account ${bankAccountId} is not active`,
    'BANK_ACCOUNT_INACTIVE',
    400
  ),

  CANNOT_DELETE_DEFAULT: (id: number) => new PaymentMethodError(
    'Cannot delete default payment method',
    'CANNOT_DELETE_DEFAULT',
    400
  ),

  CANNOT_DEACTIVATE_DEFAULT: (id: number) => new PaymentMethodError(
    'Cannot deactivate default payment method',
    'CANNOT_DEACTIVATE_DEFAULT',
    400
  ),

  ONLY_ONE_DEFAULT_ALLOWED: (companyId: string) => new PaymentMethodError(
    'Only one default payment method is allowed per company',
    'ONLY_ONE_DEFAULT_ALLOWED',
    400
  ),

  CREATE_FAILED: () => new PaymentMethodError(
    'Unable to create payment method. Please try again.',
    'CREATE_FAILED',
    500
  ),

  UPDATE_FAILED: () => new PaymentMethodError(
    'Unable to update payment method. Please try again.',
    'UPDATE_FAILED',
    500
  ),

  DELETE_FAILED: () => new PaymentMethodError(
    'Unable to delete payment method. Please try again.',
    'DELETE_FAILED',
    500
  ),
}

/**
 * Configuration constants for payment methods
 */
export const PaymentMethodsConfig = {
  PAYMENT_TYPES: [
    'CASH',
    'BANK_TRANSFER',
    'GIRO',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'DIGITAL_WALLET',
    'OTHER'
  ] as const,

  EXPORT: {
    MAX_ROWS: 10000,
    FILENAME_PREFIX: 'payment-methods'
  },

  VALIDATION: {
    CODE_MAX_LENGTH: 20,
    NAME_MAX_LENGTH: 100,
    DESCRIPTION_MAX_LENGTH: 500,
    MIN_SORT_ORDER: 0,
    MAX_SORT_ORDER: 9999
  },

  CACHE_TTL: 5 * 60 * 1000 // 5 minutes
}

