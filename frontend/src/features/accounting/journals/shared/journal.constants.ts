// Shared constants for journal module
// Must match backend enums exactly

export const JOURNAL_TYPES = {
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

export const JOURNAL_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
  REJECTED: 'REJECTED',
} as const

export const JOURNAL_TYPE_LABELS: Record<keyof typeof JOURNAL_TYPES, string> = {
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

export const JOURNAL_STATUS_LABELS: Record<keyof typeof JOURNAL_STATUS, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  POSTED: 'Posted',
  REVERSED: 'Reversed',
  REJECTED: 'Rejected',
}

export const JOURNAL_STATUS_COLORS: Record<keyof typeof JOURNAL_STATUS, string> = {
  DRAFT: 'gray',
  SUBMITTED: 'blue',
  APPROVED: 'green',
  POSTED: 'purple',
  REVERSED: 'red',
  REJECTED: 'orange',
}

// Status transition rules (state machine)
export const JOURNAL_STATUS_TRANSITIONS: Record<keyof typeof JOURNAL_STATUS, (keyof typeof JOURNAL_STATUS)[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['POSTED', 'REJECTED'],
  REJECTED: ['DRAFT'],
  POSTED: ['REVERSED'],
  REVERSED: [],
}

// Check if status transition is allowed
export const canTransitionTo = (
  currentStatus: keyof typeof JOURNAL_STATUS,
  targetStatus: keyof typeof JOURNAL_STATUS
): boolean => {
  return JOURNAL_STATUS_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false
}

// Get available actions for current status
export const getAvailableActions = (status: keyof typeof JOURNAL_STATUS) => {
  const actions: string[] = []
  
  if (status === 'DRAFT') {
    actions.push('edit', 'delete', 'submit')
  } else if (status === 'SUBMITTED') {
    actions.push('approve', 'reject')
  } else if (status === 'APPROVED') {
    actions.push('post', 'reject')
  } else if (status === 'REJECTED') {
    actions.push('edit', 'delete')
  } else if (status === 'POSTED') {
    actions.push('reverse')
  }
  
  return actions
}
