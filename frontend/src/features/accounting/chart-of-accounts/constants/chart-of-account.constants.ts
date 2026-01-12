import type { AccountType, NormalBalance } from '../types/chart-of-account.types'

export const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability', 
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense'
}

export const NORMAL_BALANCE_MAP: Record<AccountType, NormalBalance> = {
  ASSET: 'DEBIT',
  EXPENSE: 'DEBIT',
  LIABILITY: 'CREDIT',
  EQUITY: 'CREDIT',
  REVENUE: 'CREDIT'
}

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  ASSET: 'bg-green-100 text-green-800',
  LIABILITY: 'bg-red-100 text-red-800',
  EQUITY: 'bg-blue-100 text-blue-800',
  REVENUE: 'bg-purple-100 text-purple-800',
  EXPENSE: 'bg-orange-100 text-orange-800'
}

export const CURRENCY_CODES = ['IDR', 'USD', 'EUR', 'SGD', 'MYR']

export const DEFAULT_CURRENCY = 'IDR'

export const MAX_ACCOUNT_CODE_LENGTH = 30
export const MAX_ACCOUNT_NAME_LENGTH = 255
export const MAX_TREE_DEPTH = 10