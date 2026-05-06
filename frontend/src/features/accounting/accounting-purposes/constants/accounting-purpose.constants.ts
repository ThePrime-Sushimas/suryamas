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
  PURCHASE: { value: 'PURCHASE', label: 'Transaksi Pembelian', color: 'bg-blue-100 text-blue-800', colorDark: 'dark:bg-blue-900 dark:text-blue-200' },
  SALES: { value: 'SALES', label: 'Transaksi Penjualan', color: 'bg-green-100 text-green-800', colorDark: 'dark:bg-green-900 dark:text-green-200' },
  INVENTORY: { value: 'INVENTORY', label: 'Transaksi Persediaan', color: 'bg-orange-100 text-orange-800', colorDark: 'dark:bg-orange-900 dark:text-orange-200' },
  EXPENSE: { value: 'EXPENSE', label: 'Transaksi Beban', color: 'bg-amber-100 text-amber-800', colorDark: 'dark:bg-amber-900 dark:text-amber-200' },
  CASH: { value: 'CASH', label: 'Transaksi Kas', color: 'bg-yellow-100 text-yellow-800', colorDark: 'dark:bg-yellow-900 dark:text-yellow-200' },
  BANK: { value: 'BANK', label: 'Transaksi Bank', color: 'bg-purple-100 text-purple-800', colorDark: 'dark:bg-purple-900 dark:text-purple-200' },
  ASSET: { value: 'ASSET', label: 'Transaksi Aset', color: 'bg-violet-100 text-violet-800', colorDark: 'dark:bg-violet-900 dark:text-violet-200' },
  TAX: { value: 'TAX', label: 'Transaksi Pajak', color: 'bg-fuchsia-100 text-fuchsia-800', colorDark: 'dark:bg-fuchsia-900 dark:text-fuchsia-200' },
  GENERAL: { value: 'GENERAL', label: 'Transaksi Umum', color: 'bg-slate-100 text-slate-800', colorDark: 'dark:bg-slate-700 dark:text-slate-300' },
  OPENING: { value: 'OPENING', label: 'Transaksi Pembukaan', color: 'bg-indigo-100 text-indigo-800', colorDark: 'dark:bg-indigo-900 dark:text-indigo-200' },
  RECEIVABLE: { value: 'RECEIVABLE', label: 'Transaksi Piutang', color: 'bg-sky-100 text-sky-800', colorDark: 'dark:bg-sky-900 dark:text-sky-200' },
  PAYABLE: { value: 'PAYABLE', label: 'Transaksi Utang', color: 'bg-rose-100 text-rose-800', colorDark: 'dark:bg-rose-900 dark:text-rose-200' },
  PAYROLL: { value: 'PAYROLL', label: 'Transaksi Penggajian', color: 'bg-pink-100 text-pink-800', colorDark: 'dark:bg-pink-900 dark:text-pink-200' },
  FINANCING: { value: 'FINANCING', label: 'Transaksi Pembiayaan', color: 'bg-teal-100 text-teal-800', colorDark: 'dark:bg-teal-900 dark:text-teal-200' }
} as const

export const APPLIED_TO_OPTIONS = Object.values(APPLIED_TO_CONFIG).map(({ value, label }) => ({ value, label }))
export const APPLIED_TO_COLORS = Object.fromEntries(
  Object.entries(APPLIED_TO_CONFIG).map(([key, { color }]) => [key, color])
) as Record<AppliedToType, string>
export const APPLIED_TO_COLORS_DARK = Object.fromEntries(
  Object.entries(APPLIED_TO_CONFIG).map(([key, { colorDark }]) => [key, colorDark])
) as Record<AppliedToType, string>
