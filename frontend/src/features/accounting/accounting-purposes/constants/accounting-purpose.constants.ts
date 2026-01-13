type AppliedToType = 'SALES' | 'PURCHASE' | 'CASH' | 'BANK' | 'INVENTORY'

interface AppliedToConfig {
  value: AppliedToType
  label: string
  color: string
}

const APPLIED_TO_CONFIG: Record<AppliedToType, AppliedToConfig> = {
  SALES: { value: 'SALES', label: 'Sales Transactions', color: 'bg-green-100 text-green-800' },
  PURCHASE: { value: 'PURCHASE', label: 'Purchase Transactions', color: 'bg-blue-100 text-blue-800' },
  CASH: { value: 'CASH', label: 'Cash Transactions', color: 'bg-yellow-100 text-yellow-800' },
  BANK: { value: 'BANK', label: 'Bank Transactions', color: 'bg-purple-100 text-purple-800' },
  INVENTORY: { value: 'INVENTORY', label: 'Inventory Transactions', color: 'bg-orange-100 text-orange-800' }
} as const

export const APPLIED_TO_OPTIONS = Object.values(APPLIED_TO_CONFIG).map(({ value, label }) => ({ value, label }))
export const APPLIED_TO_COLORS = Object.fromEntries(
  Object.entries(APPLIED_TO_CONFIG).map(([key, { color }]) => [key, color])
) as Record<AppliedToType, string>