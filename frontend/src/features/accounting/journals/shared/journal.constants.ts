// Shared constants for journal module
// Must match backend enums exactly

export const JOURNAL_TYPES = {
  MANUAL: 'MANUAL',
  PURCHASE: 'PURCHASE',
  SALES: 'SALES',
  PAYMENT: 'PAYMENT',
  RECEIPT: 'RECEIPT',
  ADJUSTMENT: 'ADJUSTMENT',
  OPENING: 'OPENING',
  CLOSING: 'CLOSING',
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
  MANUAL: 'Manual Journal',
  PURCHASE: 'Purchase Journal',
  SALES: 'Sales Journal',
  PAYMENT: 'Payment Journal',
  RECEIPT: 'Receipt Journal',
  ADJUSTMENT: 'Adjustment Journal',
  OPENING: 'Opening Balance',
  CLOSING: 'Closing Entry',
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
