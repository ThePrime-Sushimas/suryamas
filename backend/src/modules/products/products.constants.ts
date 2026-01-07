export const PRODUCT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DISCONTINUED: 'DISCONTINUED',
} as const

export const PRODUCT_TYPE = {
  RAW: 'raw',
  SEMI_FINISHED: 'semi_finished',
  FINISHED_GOODS: 'finished_goods',
} as const

export const VALID_PRODUCT_STATUSES = Object.values(PRODUCT_STATUS)
export const VALID_PRODUCT_TYPES = Object.values(PRODUCT_TYPE)

export const PRODUCT_DEFAULTS = {
  STATUS: PRODUCT_STATUS.ACTIVE,
  PRODUCT_TYPE: PRODUCT_TYPE.RAW,
  AVERAGE_COST: 0,
  IS_REQUESTABLE: true,
  IS_PURCHASABLE: true,
  PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 1000,
} as const

export const PRODUCT_LIMITS = {
  MAX_BULK_OPERATION_SIZE: 100,
  MAX_MINIMAL_PRODUCTS: 1000,
  PRODUCT_CODE_MAX_LENGTH: 50,
  PRODUCT_NAME_MAX_LENGTH: 255,
  NOTES_MAX_LENGTH: 1000,
} as const

export const PRODUCT_SORT_FIELDS = [
  'product_name',
  'product_code',
  'status',
  'product_type',
  'average_cost',
  'category_id',
  'sub_category_id',
  'created_at',
  'updated_at',
] as const

export const PRODUCT_FILTER_FIELDS = [
  'status',
  'product_type',
  'category_id',
  'sub_category_id',
  'is_requestable',
  'is_purchasable',
] as const
