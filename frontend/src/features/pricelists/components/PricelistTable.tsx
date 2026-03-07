/**
 * Pricelist Table Component
 * Displays pricelists with actions
 * 
 * @module pricelists/components
 */

import { memo, useCallback, useState } from 'react'
import type { PricelistWithRelations, SortField, SortOrder } from '../types/pricelist.types'
import { formatPrice, formatDate, formatStatus, getValidityStatus, getStatusColorClass, getValidityColorClass } from '../utils/format'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

// Static class mapping for Tailwind purging safety - with dark mode

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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const validityStatus = getValidityStatus(pricelist.valid_from, pricelist.valid_to)
  const statusColor = getStatusColorClass(pricelist.status)
  const validityColorClass = getValidityColorClass(validityStatus.color)
  const isDeleted = !!pricelist.deleted_at

  const handleDeleteClick = () => {
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = () => {
    onDelete(pricelist.id)
    setDeleteModalOpen(false)
  }

  return (
    <>
      <tr 
        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isDeleted ? 'bg-red-50 dark:bg-red-900/10 opacity-75' : ''} cursor-pointer`}
        onClick={() => onView(pricelist.id)}
      >
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
          {pricelist.supplier_name || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
          {pricelist.product_name || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
          {pricelist.uom_name || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
          {formatPrice(pricelist.price, pricelist.currency)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
          {formatDate(pricelist.valid_from)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
          {formatDate(pricelist.valid_to)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={statusColor}>
            {formatStatus(pricelist.status)}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={validityColorClass}>
            {validityStatus.label}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex justify-end gap-2">
            {!isDeleted && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(pricelist.id) }}
                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
              >
                Edit
              </button>
            )}
            {isDeleted && onRestore ? (
              <button
                onClick={(e) => { e.stopPropagation(); onRestore(pricelist.id) }}
                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
              >
                Restore
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteClick() }}
                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
              >
                Delete
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Pricelist"
        message={`Are you sure you want to delete the pricelist for "${pricelist.product_name || 'this product'}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </>
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

  // Debug: Check for duplicate IDs
  const ids = data.map(p => p.id)
  const uniqueIds = new Set(ids)
  if (ids.length !== uniqueIds.size) {
    console.warn('Duplicate pricelist IDs found:', ids.filter((id, index) => ids.indexOf(id) !== index))
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <TableSkeleton rows={5} columns={9} />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No pricelists found</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                UOM
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
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
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('valid_from')}
                role="columnheader"
                aria-sort={sortBy === 'valid_from' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                aria-label={`Sort by valid from date, currently ${sortBy === 'valid_from' ? sortOrder : 'none'}`}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('valid_from')}
              >
                Valid From {sortBy === 'valid_from' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Valid To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Validity
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((pricelist) => {
              // Use a more robust unique key
              const uniqueKey = `${pricelist.id}-${pricelist.created_at}-${pricelist.updated_at || ''}`
              return (
                <PricelistRow
                  key={uniqueKey}
                  pricelist={pricelist}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRestore={onRestore}
                  onView={onView}
                  onApprove={onApprove}
                  showDeleted={showDeleted}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})

