import type { AppliedToType } from '../types/accounting-purpose.types'

export const formatAppliedTo = (appliedTo: AppliedToType): string => {
  const labels: Record<AppliedToType, string> = {
    PURCHASE: 'Purchase',
    SALES: 'Sales',
    INVENTORY: 'Inventory',
    EXPENSE: 'Expense',
    CASH: 'Cash',
    BANK: 'Bank',
    ASSET: 'Asset',
    TAX: 'Tax',
    GENERAL: 'General',
    OPENING: 'Opening',
    RECEIVABLE: 'Receivable',
    PAYABLE: 'Payable',
    PAYROLL: 'Payroll',
    FINANCING: 'Financing'
  }
  return labels[appliedTo] || appliedTo
}

export const formatPurposeCode = (code: string): string => {
  return code.toUpperCase().replace(/\s+/g, '_')
}