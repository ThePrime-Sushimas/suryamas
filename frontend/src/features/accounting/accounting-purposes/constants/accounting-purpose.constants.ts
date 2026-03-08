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
  colorDark: string
}

const APPLIED_TO_CONFIG: Record<AppliedToType, AppliedToConfig> = {
  PURCHASE: { value: 'PURCHASE', label: 'Purchase Transactions', color: 'bg-blue-100 text-blue-800', colorDark: 'dark:bg-blue-900 dark:text-blue-200' },
  SALES: { value: 'SALES', label: 'Sales Transactions', color: 'bg-green-100 text-green-800', colorDark: 'dark:bg-green-900 dark:text-green-200' },
  INVENTORY: { value: 'INVENTORY', label: 'Inventory Transactions', color: 'bg-orange-100 text-orange-800', colorDark: 'dark:bg-orange-900 dark:text-orange-200' },
  EXPENSE: { value: 'EXPENSE', label: 'Expense Transactions', color: 'bg-amber-100 text-amber-800', colorDark: 'dark:bg-amber-900 dark:text-amber-200' },
  CASH: { value: 'CASH', label: 'Cash Transactions', color: 'bg-yellow-100 text-yellow-800', colorDark: 'dark:bg-yellow-900 dark:text-yellow-200' },
  BANK: { value: 'BANK', label: 'Bank Transactions', color: 'bg-purple-100 text-purple-800', colorDark: 'dark:bg-purple-900 dark:text-purple-200' },
  ASSET: { value: 'ASSET', label: 'Asset Transactions', color: 'bg-violet-100 text-violet-800', colorDark: 'dark:bg-violet-900 dark:text-violet-200' },
  TAX: { value: 'TAX', label: 'Tax Transactions', color: 'bg-fuchsia-100 text-fuchsia-800', colorDark: 'dark:bg-fuchsia-900 dark:text-fuchsia-200' },
  GENERAL: { value: 'GENERAL', label: 'General Transactions', color: 'bg-slate-100 text-slate-800', colorDark: 'dark:bg-slate-700 dark:text-slate-300' },
  OPENING: { value: 'OPENING', label: 'Opening Transactions', color: 'bg-indigo-100 text-indigo-800', colorDark: 'dark:bg-indigo-900 dark:text-indigo-200' },
  RECEIVABLE: { value: 'RECEIVABLE', label: 'Receivable Transactions', color: 'bg-sky-100 text-sky-800', colorDark: 'dark:bg-sky-900 dark:text-sky-200' },
  PAYABLE: { value: 'PAYABLE', label: 'Payable Transactions', color: 'bg-rose-100 text-rose-800', colorDark: 'dark:bg-rose-900 dark:text-rose-200' },
  PAYROLL: { value: 'PAYROLL', label: 'Payroll Transactions', color: 'bg-pink-100 text-pink-800', colorDark: 'dark:bg-pink-900 dark:text-pink-200' },
  FINANCING: { value: 'FINANCING', label: 'Financing Transactions', color: 'bg-teal-100 text-teal-800', colorDark: 'dark:bg-teal-900 dark:text-teal-200' }
} as const

export const APPLIED_TO_OPTIONS = Object.values(APPLIED_TO_CONFIG).map(({ value, label }) => ({ value, label }))
export const APPLIED_TO_COLORS = Object.fromEntries(
  Object.entries(APPLIED_TO_CONFIG).map(([key, { color }]) => [key, color])
) as Record<AppliedToType, string>
export const APPLIED_TO_COLORS_DARK = Object.fromEntries(
  Object.entries(APPLIED_TO_CONFIG).map(([key, { colorDark }]) => [key, colorDark])
) as Record<AppliedToType, string>
