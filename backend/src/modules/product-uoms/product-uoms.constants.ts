import { UomStatus } from '../products/products.types'

export const VALID_UOM_STATUSES: UomStatus[] = ['ACTIVE', 'INACTIVE']

export const UOM_DEFAULTS = {
  STATUS: 'ACTIVE' as UomStatus,
  IS_BASE_UNIT: false,
  IS_DEFAULT_STOCK_UNIT: false,
  IS_DEFAULT_PURCHASE_UNIT: false,
  IS_DEFAULT_BASE_UNIT: false,
  IS_DEFAULT_TRANSFER_UNIT: false,
  BASE_CONVERSION_FACTOR: 1,
}

export const UOM_LIMITS = {
  MAX_CONVERSION_FACTOR: 999999.999999,
  MIN_CONVERSION_FACTOR: 0.000001,
  MAX_UNIT_NAME_LENGTH: 50,
}
