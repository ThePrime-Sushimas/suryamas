type AppliedToType = 
| 'PURCHASE'
| 'SALES'
| 'INVENTORY'
| 'EXPENSE'
| 'CASH'
| 'BANK'
| 'ASSET'
| 'TAX'
| 'GENERAL'
| 'OPENING'
| 'RECEIVABLE'
| 'PAYABLE'
| 'PAYROLL'
| 'FINANCING'

interface AppliedToConfig {
  value: AppliedToType
  label: string
  color: string
}

const APPLIED_TO_CONFIG: Record<AppliedToType, AppliedToConfig> = {
  PURCHASE: { value: 'PURCHASE', label: 'Purchase Transactions', color: 'bg-blue-100 text-blue-800' },
  SALES: { value: 'SALES', label: 'Sales Transactions', color: 'bg-green-100 text-green-800' },
  INVENTORY: { value: 'INVENTORY', label: 'Inventory Transactions', color: 'bg-orange-100 text-orange-800' },
  EXPENSE: { value: 'EXPENSE', label: 'Expense Transactions', color: 'bg-amber-100 text-amber-800' },
  CASH: { value: 'CASH', label: 'Cash Transactions', color: 'bg-yellow-100 text-yellow-800' },
  BANK: { value: 'BANK', label: 'Bank Transactions', color: 'bg-purple-100 text-purple-800' },
  ASSET: { value: 'ASSET', label: 'Asset Transactions', color: 'bg-violet-100 text-violet-800' },
  TAX: { value: 'TAX', label: 'Tax Transactions', color: 'bg-fuchsia-100 text-fuchsia-800' },
  GENERAL: { value: 'GENERAL', label: 'General Transactions', color: 'bg-slate-100 text-slate-800' },
  OPENING: { value: 'OPENING', label: 'Opening Transactions', color: 'bg-indigo-100 text-indigo-800' },
  RECEIVABLE: { value: 'RECEIVABLE', label: 'Receivable Transactions', color: 'bg-sky-100 text-sky-800' },
  PAYABLE: { value: 'PAYABLE', label: 'Payable Transactions', color: 'bg-rose-100 text-rose-800' },
  PAYROLL: { value: 'PAYROLL', label: 'Payroll Transactions', color: 'bg-pink-100 text-pink-800' },
  FINANCING: { value: 'FINANCING', label: 'Financing Transactions', color: 'bg-teal-100 text-teal-800' }
} as const

export const APPLIED_TO_OPTIONS = Object.values(APPLIED_TO_CONFIG).map(({ value, label }) => ({ value, label }))
export const APPLIED_TO_COLORS = Object.fromEntries(
  Object.entries(APPLIED_TO_CONFIG).map(([key, { color }]) => [key, color])
) as Record<AppliedToType, string>