export const SUPPLIER_PRODUCT_DEFAULTS = {
  CURRENCY: process.env.DEFAULT_CURRENCY || 'IDR',
  IS_PREFERRED: false,
  IS_ACTIVE: true,
  PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE || '10'),
  MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE || '100'),
} as const

export const SUPPLIER_PRODUCT_LIMITS = {
  MAX_BULK_OPERATION_SIZE: parseInt(process.env.MAX_BULK_OPERATION_SIZE || '100'),
  MAX_LEAD_TIME_DAYS: parseInt(process.env.MAX_LEAD_TIME_DAYS || '365'),
  MIN_PRICE: 0,
  MAX_PRICE: parseInt(process.env.MAX_PRICE || '999999999999'),
  MIN_ORDER_QTY_MIN: 0.01,
  PRICE_DECIMAL_PLACES: 2,
  MAX_SEARCH_LENGTH: parseInt(process.env.MAX_SEARCH_LENGTH || '100'),
  REQUEST_RATE_LIMIT: parseInt(process.env.SUPPLIER_PRODUCTS_RATE_LIMIT || '100'),
} as const

export const VALID_CURRENCIES = (process.env.SUPPORTED_CURRENCIES || 'IDR,USD,EUR,SGD,MYR').split(',')

export const SUPPLIER_PRODUCT_SORT_FIELDS = [
  'price',
  'currency', 
  'lead_time_days',
  'min_order_qty',
  'is_preferred',
  'is_active',
  'created_at',
  'updated_at',
]

export const SUPPLIER_PRODUCT_FILTER_FIELDS = [
  'supplier_id',
  'product_id',
  'is_preferred',
  'is_active',
] as const

// Business rules
export const BUSINESS_RULES = {
  MAX_PREFERRED_SUPPLIERS_PER_PRODUCT: 3,
  REQUIRE_ACTIVE_SUPPLIER: true,
  REQUIRE_ACTIVE_PRODUCT: true,
} as const