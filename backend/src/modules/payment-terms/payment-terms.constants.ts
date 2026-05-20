// backend/src/modules/payment-terms/payment-terms.constants.ts

import type { CalculationType } from './payment-terms.types'

export const CALCULATION_TYPE = {
  FROM_INVOICE: 'from_invoice',
  FROM_DELIVERY: 'from_delivery',
  FIXED_DATE: 'fixed_date',
  FIXED_DATE_IMMEDIATE: 'fixed_date_immediate',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  /** Same as monthly, but a payment slot on the same calendar day as the anchor counts (>=). */
  MONTHLY_IMMEDIATE: 'monthly_immediate',
} as const

export const VALID_CALCULATION_TYPES = Object.values(CALCULATION_TYPE)

/**
 * Terms where PO `payment_due_date` is derived when goods receipt is confirmed,
 * using GR `received_date` as the anchor in `calculateDueDate`.
 *
 * Excludes `from_invoice` — that is computed when Purchase Invoice is posted (invoice anchor).
 *
 * Keep in sync with due-date rules: any new `CalculationType` that should use GR date
 * at confirm time belongs here (and in `calculateDueDate` switch if needed).
 */
export const PAYMENT_DUE_AT_GR_CONFIRM_TYPES: readonly CalculationType[] = [
  CALCULATION_TYPE.FROM_DELIVERY,
  CALCULATION_TYPE.WEEKLY,
  CALCULATION_TYPE.FIXED_DATE,
  CALCULATION_TYPE.FIXED_DATE_IMMEDIATE,
  CALCULATION_TYPE.MONTHLY,
  CALCULATION_TYPE.MONTHLY_IMMEDIATE,
]

/**
 * Schedule-based calculation types (excludes `from_delivery`).
 * Used where `days === 0` must not be treated as tunai/COD (e.g. PI cash-term heuristic).
 */
export const PAYMENT_TERM_SCHEDULE_TYPES: readonly CalculationType[] = [
  CALCULATION_TYPE.WEEKLY,
  CALCULATION_TYPE.FIXED_DATE,
  CALCULATION_TYPE.FIXED_DATE_IMMEDIATE,
  CALCULATION_TYPE.MONTHLY,
  CALCULATION_TYPE.MONTHLY_IMMEDIATE,
]

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
