import type { SupplierType } from '../types/supplier.types'

export const SUPPLIER_TYPES: Record<SupplierType, { label: string; color: string }> = {
  vegetables: { label: 'Vegetables', color: 'bg-green-100 text-green-800' },
  meat: { label: 'Meat', color: 'bg-red-100 text-red-800' },
  seafood: { label: 'Seafood', color: 'bg-blue-100 text-blue-800' },
  dairy: { label: 'Dairy', color: 'bg-yellow-100 text-yellow-800' },
  beverage: { label: 'Beverage', color: 'bg-purple-100 text-purple-800' },
  dry_goods: { label: 'Dry Goods', color: 'bg-orange-100 text-orange-800' },
  packaging: { label: 'Packaging', color: 'bg-gray-100 text-gray-800' },
  other: { label: 'Other', color: 'bg-slate-100 text-slate-800' },
}

export const SUPPLIER_TYPE_OPTIONS = Object.entries(SUPPLIER_TYPES).map(([value, { label }]) => ({
  value,
  label,
}))

export const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

export const RATING_OPTIONS = [1, 2, 3, 4, 5]