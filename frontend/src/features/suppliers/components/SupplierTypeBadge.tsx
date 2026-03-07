import { SUPPLIER_TYPES } from '../constants/supplier.constants'
import type { SupplierType } from '../types/supplier.types'

interface SupplierTypeBadgeProps {
  type: SupplierType
}

export function SupplierTypeBadge({ type }: SupplierTypeBadgeProps) {
  const config = SUPPLIER_TYPES[type] || SUPPLIER_TYPES.other
  
  // Add dark mode support to the colors
  const darkModeColors = {
    'bg-blue-100 text-blue-800': 'dark:bg-blue-900 dark:text-blue-200',
    'bg-green-100 text-green-800': 'dark:bg-green-900 dark:text-green-200',
    'bg-purple-100 text-purple-800': 'dark:bg-purple-900 dark:text-purple-200',
    'bg-yellow-100 text-yellow-800': 'dark:bg-yellow-900 dark:text-yellow-200',
    'bg-red-100 text-red-800': 'dark:bg-red-900 dark:text-red-200',
    'bg-gray-100 text-gray-800': 'dark:bg-gray-700 dark:text-gray-300',
  }
  
  const darkModeClass = darkModeColors[config.color as keyof typeof darkModeColors] || darkModeColors['bg-gray-100 text-gray-800']
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${darkModeClass}`}>
      {config.label}
    </span>
  )
}
