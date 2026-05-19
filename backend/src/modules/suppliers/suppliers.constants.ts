export const SUPPLIER_TYPES = {
  VEGETABLES: 'vegetables',
  MEAT: 'meat',
  SEAFOOD: 'seafood',
  DAIRY: 'dairy',
  BEVERAGE: 'beverage',
  DRY_GOODS: 'dry_goods',
  PACKAGING: 'packaging',
  OTHER: 'other',
  FROZEN_FOOD: 'frozen_food',
} as const

export const VALID_SUPPLIER_TYPES = Object.values(SUPPLIER_TYPES)

export const SUPPLIER_DEFAULTS = {
  LEAD_TIME_DAYS: 1,
  MINIMUM_ORDER: 0,
  IS_ACTIVE: true,
  REQUIRES_INVOICE: true,
  DEFAULT_TAX_RATE: 11,
} as const

export const VALID_INVOICE_BYPASS_REASONS = ['marketplace', 'cash', 'informal'] as const

/** Suppliers eligible for purchase-invoice flows (not marketplace / invoice-bypass). */
export const SQL_SUPPLIER_ELIGIBLE_FOR_PI = `(
  COALESCE(s.requires_invoice, true) IS TRUE
  AND (s.invoice_bypass_reason IS NULL OR s.invoice_bypass_reason <> 'marketplace')
)`

/** @deprecated Use SQL_SUPPLIER_ELIGIBLE_FOR_PI */
export const SQL_NOT_MARKETPLACE_SUPPLIER = SQL_SUPPLIER_ELIGIBLE_FOR_PI

/** Only suppliers flagged as marketplace. */
export const SQL_MARKETPLACE_SUPPLIER_ONLY = `(s.invoice_bypass_reason = 'marketplace')`

export const SUPPLIER_LIMITS = {
  SUPPLIER_CODE_MAX_LENGTH: 50,
  SUPPLIER_NAME_MAX_LENGTH: 255,
  CONTACT_PERSON_MAX_LENGTH: 255,
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 15,
  EMAIL_MAX_LENGTH: 255,
  ADDRESS_MAX_LENGTH: 500,
  CITY_MAX_LENGTH: 100,
  PROVINCE_MAX_LENGTH: 100,
  POSTAL_CODE_MAX_LENGTH: 20,
  TAX_ID_MAX_LENGTH: 50,
  BUSINESS_LICENSE_MAX_LENGTH: 100,
  LEAD_TIME_MAX_DAYS: 365,
  RATING_MIN: 1,
  RATING_MAX: 5,
  NOTES_MAX_LENGTH: 1000,
} as const

export const DEFAULT_SORT = {
  FIELD: 'supplier_name',
  ORDER: 'asc',
} as const