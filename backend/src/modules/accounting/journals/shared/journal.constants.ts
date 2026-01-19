import { JournalType, JournalStatus } from './journal.types'

export const JOURNAL_TYPES: Record<JournalType, JournalType> = {
  EXPENSE: 'EXPENSE',
  PURCHASE: 'PURCHASE',
  SALES: 'SALES',
  INVENTORY: 'INVENTORY',
  CASH: 'CASH',
  BANK: 'BANK',
  ASSET: 'ASSET',
  TAX: 'TAX',
  GENERAL: 'GENERAL',
  OPENING: 'OPENING',
  RECEIVABLE: 'RECEIVABLE',
  PAYROLL: 'PAYROLL',
  PAYABLE: 'PAYABLE',
  FINANCING: 'FINANCING'
} as const

export const JOURNAL_STATUS: Record<JournalStatus, JournalStatus> = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
  REJECTED: 'REJECTED'
} as const

export const JOURNAL_TYPE_LABELS: Record<JournalType, string> = {
  EXPENSE: 'Expense Journal',
  PURCHASE: 'Purchase Journal',
  PAYABLE: 'Payable Journal',
  SALES: 'Sales Journal',
  INVENTORY: 'Inventory Journal',
  CASH: 'Cash Journal',
  BANK: 'Bank Journal',
  ASSET: 'Asset Journal',
  TAX: 'Tax Journal',
  GENERAL: 'General Journal',
  OPENING: 'Opening Balance',
  RECEIVABLE: 'Receivable Journal',
  PAYROLL: 'Payroll Journal',
  FINANCING: 'Financing Journal'
}

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  POSTED: 'Posted',
  REVERSED: 'Reversed',
  REJECTED: 'Rejected'
}

export const JOURNAL_NUMBER_PREFIX: Record<JournalType, string> = {
  EXPENSE: 'JE',
  PURCHASE: 'JP',
  SALES: 'JS',
  INVENTORY: 'JI',
  PAYABLE: 'JX',
  CASH: 'JC',
  BANK: 'JB',
  ASSET: 'JA',
  TAX: 'JT',
  GENERAL: 'JG',
  OPENING: 'JO',
  RECEIVABLE: 'JR',
  PAYROLL: 'JY',
  FINANCING: 'JF'
}

// State Machine: Allowed status transitions
export const JOURNAL_STATUS_TRANSITIONS: Record<JournalStatus, JournalStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['POSTED', 'REJECTED'],
  REJECTED: ['DRAFT'],
  POSTED: ['REVERSED'],
  REVERSED: []
} as const
