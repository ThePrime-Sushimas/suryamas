/**
 * Pricelist Table Component
 * Displays pricelists with actions
 * 
 * @module pricelists/components
 */

import { memo, useCallback } from 'react'
import type { PricelistWithRelations, SortField, SortOrder } from '../types/pricelist.types'
import { formatPrice, formatDate, formatStatus, getValidityStatus } from '../utils/format'
import { getStatusColor, isEditable } from '../constants/pricelist.constants'

// Static class mapping for Tailwind purging safety - moved outside component
const STATUS_CLASSES: Record<string, string> = {
  green: 'px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800',
  yellow: 'px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800',
  red: 'px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800',
  gray: 'px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800',
}

// Memoized row component for performance
const PricelistRow = memo(function PricelistRow({
  pricelist,
  onEdit,
  onDelete,
  onRestore,
  onView,
}: {
  pricelist: PricelistWithRelations
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRestore?: (id: string) => void
  onView: (id: string) => void
  onApprove: (id: string) => void
  showDeleted?: boolean
}) {
  const validityStatus = getValidityStatus(pricelist.valid_from, pricelist.valid_to)
  const statusColor = getStatusColor(pricelist.status)
  const canEdit = isEditable(pricelist.status)
  const isDeleted = !!pricelist.deleted_at

  return (
    <tr className={`hover:bg-gray-50 ${isDeleted ? 'bg-red-50 opacity-75' : ''}`}>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {pricelist.supplier_name || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {pricelist.product_name || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {pricelist.uom_name || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {formatPrice(pricelist.price, pricelist.currency)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(pricelist.valid_from)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(pricelist.valid_to)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={STATUS_CLASSES[statusColor] || STATUS_CLASSES.gray}>
          {formatStatus(pricelist.status)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={STATUS_CLASSES[validityStatus.color] || STATUS_CLASSES.gray}>
          {validityStatus.label}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onView(pricelist.id)}
            className="text-blue-600 hover:text-blue-900"
          >
            View
          </button>
          {!isDeleted && canEdit && (
            <button
              onClick={() => onEdit(pricelist.id)}
              className="text-indigo-600 hover:text-indigo-900"
            >
              Edit
            </button>
          )}
          {isDeleted && onRestore ? (
            <button
              onClick={() => onRestore(pricelist.id)}
              className="text-green-600 hover:text-green-900"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={() => {
                if (confirm('Delete this pricelist?')) {
                  onDelete(pricelist.id)
                }
              }}
              className="text-red-600 hover:text-red-900"
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  )
})

interface PricelistTableProps {
  data: PricelistWithRelations[]
  loading: boolean
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRestore?: (id: string) => void
  onView: (id: string) => void
  onApprove: (id: string) => void
  sortBy?: SortField
  sortOrder?: SortOrder
  onSort: (field: SortField) => void
  showDeleted?: boolean
}

export const PricelistTable = memo(function PricelistTable({
  data,
  loading,
  onEdit,
  onDelete,
  onRestore,
  onView,
  onApprove,
  sortBy,
  sortOrder,
  onSort,
  showDeleted
}: PricelistTableProps) {
  const handleSort = useCallback((field: SortField) => {
    onSort(field)
  }, [onSort])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading pricelists...</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No pricelists found</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                UOM
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('price')}
                role="columnheader"
                aria-sort={sortBy === 'price' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                aria-label={`Sort by price, currently ${sortBy === 'price' ? sortOrder : 'none'}`}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('price')}
              >
                Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('valid_from')}
                role="columnheader"
                aria-sort={sortBy === 'valid_from' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                aria-label={`Sort by valid from date, currently ${sortBy === 'valid_from' ? sortOrder : 'none'}`}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('valid_from')}
              >
                Valid From {sortBy === 'valid_from' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valid To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Validity
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((pricelist) => (
              <PricelistRow
                key={pricelist.id}
                pricelist={pricelist}
                onEdit={onEdit}
                onDelete={onDelete}
                onRestore={onRestore}
                onView={onView}
                onApprove={onApprove}
                showDeleted={showDeleted}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})
