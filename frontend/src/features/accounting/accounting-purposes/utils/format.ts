import type { AppliedToType } from '../types/accounting-purpose.types'

export const formatAppliedTo = (appliedTo: AppliedToType): string => {
  const labels = {
    SALES: 'Sales',
    PURCHASE: 'Purchase',
    CASH: 'Cash',
    BANK: 'Bank',
    INVENTORY: 'Inventory'
  }
  return labels[appliedTo] || appliedTo
}

export const formatPurposeCode = (code: string): string => {
  return code.toUpperCase().replace(/\s+/g, '_')
}