export const JOURNAL_STATUS = {
  DRAFT: 'draft',
  POSTED: 'posted',
  CANCELLED: 'cancelled'
} as const

export const JOURNAL_STATUS_LABELS = {
  [JOURNAL_STATUS.DRAFT]: 'Draft',
  [JOURNAL_STATUS.POSTED]: 'Posted',
  [JOURNAL_STATUS.CANCELLED]: 'Cancelled'
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

export const JOURNAL_SOURCE_TYPE_LABELS = {
  [JOURNAL_SOURCE_TYPES.MANUAL]: 'Manual Entry',
  [JOURNAL_SOURCE_TYPES.SALES]: 'Sales Transaction',
  [JOURNAL_SOURCE_TYPES.PURCHASE]: 'Purchase Transaction',
  [JOURNAL_SOURCE_TYPES.PAYMENT]: 'Payment',
  [JOURNAL_SOURCE_TYPES.RECEIPT]: 'Receipt',
  [JOURNAL_SOURCE_TYPES.ADJUSTMENT]: 'Adjustment'
} as const