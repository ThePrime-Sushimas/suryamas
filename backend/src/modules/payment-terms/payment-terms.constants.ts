// backend/src/modules/payment-terms/payment-terms.constants.ts

export const CALCULATION_TYPE = {
  FROM_INVOICE: 'from_invoice',
  FROM_DELIVERY: 'from_delivery',
  FIXED_DATE: 'fixed_date',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const

export const VALID_CALCULATION_TYPES = Object.values(CALCULATION_TYPE)

export const PAYMENT_TERM_DEFAULTS = {
  CALCULATION_TYPE: CALCULATION_TYPE.FROM_INVOICE,
  DAYS: 0,
  EARLY_PAYMENT_DISCOUNT: 0,
  EARLY_PAYMENT_DAYS: 0,
  LATE_PAYMENT_PENALTY: 0,
  GRACE_PERIOD_DAYS: 0,
  MINIMUM_ORDER_AMOUNT: 0,
  REQUIRES_GUARANTEE: false,
  IS_ACTIVE: true,
} as const

export const PAYMENT_TERM_LIMITS = {
  TERM_CODE_MAX_LENGTH: 30,
  TERM_NAME_MAX_LENGTH: 100,
  GUARANTEE_TYPE_MAX_LENGTH: 50,
  MAX_DISCOUNT_PERCENT: 100,
  MAX_PENALTY_PERCENT: 100,
} as const
