import { JournalType, JournalStatus } from './journal.types'

export const JOURNAL_TYPES: Record<JournalType, JournalType> = {
  MANUAL: 'MANUAL',
  PURCHASE: 'PURCHASE',
  SALES: 'SALES',
  PAYMENT: 'PAYMENT',
  RECEIPT: 'RECEIPT',
  ADJUSTMENT: 'ADJUSTMENT',
  OPENING: 'OPENING',
  CLOSING: 'CLOSING'
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
  MANUAL: 'Manual Journal',
  PURCHASE: 'Purchase Journal',
  SALES: 'Sales Journal',
  PAYMENT: 'Payment Journal',
  RECEIPT: 'Receipt Journal',
  ADJUSTMENT: 'Adjustment Journal',
  OPENING: 'Opening Balance',
  CLOSING: 'Closing Entry'
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
  MANUAL: 'JM',
  PURCHASE: 'JP',
  SALES: 'JS',
  PAYMENT: 'JY',
  RECEIPT: 'JR',
  ADJUSTMENT: 'JA',
  OPENING: 'JO',
  CLOSING: 'JC'
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
