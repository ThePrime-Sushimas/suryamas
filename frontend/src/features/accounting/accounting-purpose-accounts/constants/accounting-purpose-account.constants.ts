import type { Side, AccountType } from '../types/accounting-purpose-account.types'

export const SIDES: readonly Side[] = ['DEBIT', 'CREDIT']

export const ACCOUNT_TYPES: readonly AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

export const SIDE_COLORS = {
  DEBIT: 'bg-blue-100 text-blue-800',
  CREDIT: 'bg-green-100 text-green-800'
} as const

export const PRIORITY_THRESHOLDS = {
  high: 10,
  medium: 50
} as const

export const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800', 
  low: 'bg-gray-100 text-gray-800'
} as const

export const DEFAULT_PAGE_SIZE = 25
export const MAX_BULK_OPERATIONS = 100
export const MAX_PRIORITY = 999