import { SUPPLIER_TYPES } from '../constants/supplier.constants'
import type { SupplierType } from '../types/supplier.types'

const DARK_MODE_MAP: Record<string, string> = {
  'bg-green-100 text-green-800': 'dark:bg-green-900 dark:text-green-200',
  'bg-red-100 text-red-800': 'dark:bg-red-900 dark:text-red-200',
  'bg-blue-100 text-blue-800': 'dark:bg-blue-900 dark:text-blue-200',
  'bg-yellow-100 text-yellow-800': 'dark:bg-yellow-900 dark:text-yellow-200',
  'bg-purple-100 text-purple-800': 'dark:bg-purple-900 dark:text-purple-200',
  'bg-orange-100 text-orange-800': 'dark:bg-orange-900 dark:text-orange-200',
  'bg-gray-100 text-gray-800': 'dark:bg-gray-700 dark:text-gray-300',
  'bg-slate-100 text-slate-800': 'dark:bg-slate-700 dark:text-slate-300',
}

interface SupplierTypeBadgeProps {
  type: SupplierType
}

export function SupplierTypeBadge({ type }: SupplierTypeBadgeProps) {
  const config = SUPPLIER_TYPES[type] || SUPPLIER_TYPES.other
  const darkClass = DARK_MODE_MAP[config.color] || 'dark:bg-gray-700 dark:text-gray-300'

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${darkClass}`}>
      {config.label}
    </span>
  )
}
