export const JOURNAL_STATUS = {
  DRAFT: 'draft',
  POSTED: 'posted',
  CANCELLED: 'cancelled'
} as const

export const ACCOUNT_TYPES = {
  ASSET: 'Asset',
  LIABILITY: 'Liability', 
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense'
} as const

export const ACCOUNT_CATEGORIES = {
  HEADER: 'Header',
  DETAIL: 'Detail'
} as const

export const DEFAULT_PURPOSES = {
  IFRS: 'IFRS Financial Reporting',
  TAX: 'Tax Reporting',
  MANAGEMENT: 'Management Reporting'
} as const

export const JOURNAL_SOURCE_TYPES = {
  MANUAL: 'manual',
  SALES: 'sales',
  PURCHASE: 'purchase',
  PAYMENT: 'payment',
  RECEIPT: 'receipt',
  ADJUSTMENT: 'adjustment'
} as const