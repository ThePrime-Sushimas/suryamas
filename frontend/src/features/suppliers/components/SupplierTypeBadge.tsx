import { SUPPLIER_TYPES } from '../constants/supplier.constants'
import type { SupplierType } from '../types/supplier.types'

interface SupplierTypeBadgeProps {
  type: SupplierType
}

export function SupplierTypeBadge({ type }: SupplierTypeBadgeProps) {
  const config = SUPPLIER_TYPES[type] || SUPPLIER_TYPES.other
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}