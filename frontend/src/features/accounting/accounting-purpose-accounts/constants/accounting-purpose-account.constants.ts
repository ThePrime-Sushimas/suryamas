import type { Side, AccountType } from '../types/accounting-purpose-account.types'

export const SIDES: readonly Side[] = ['DEBIT', 'CREDIT']

export const ACCOUNT_TYPES: readonly AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

export const SIDE_COLORS = {
  DEBIT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  CREDIT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
} as const

export const PRIORITY_THRESHOLDS = {
  high: 10,
  medium: 50
} as const

export const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', 
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
} as const

export const DEFAULT_PAGE_SIZE = 25
export const MAX_BULK_OPERATIONS = 100
export const MAX_PRIORITY = 999

export const FIELD_MAPPING_OPTIONS = [
  { value: 'gross_revenue', label: 'Pendapatan Kotor (Penjualan)' },
  { value: 'tax_payable', label: 'Utang Pajak (PB1/PPN)' },
  { value: 'bill_discount', label: 'Diskon Tagihan' },
  { value: 'service_charge_payable', label: 'Utang Service Charge' },
  { value: 'other_vat_payable', label: 'Utang PPN Lainnya' },
  { value: 'order_fee_revenue', label: 'Pendapatan Biaya Order' },
  { value: 'delivery_revenue', label: 'Pendapatan Pengiriman' },
  { value: 'promotion_discount', label: 'Diskon Promosi' },
  { value: 'voucher_discount', label: 'Diskon Voucher' },
  { value: 'rounding_expense', label: 'Beban Pembulatan' },
] as const