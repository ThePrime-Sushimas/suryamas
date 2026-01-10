/**
 * Pricelist Table Component
 * Displays pricelists with actions
 * 
 * @module pricelists/components
 */

import { memo, useCallback } from 'react'
import type { PricelistWithRelations, SortField, SortOrder } from '../types/pricelist.types'
import { formatPrice, formatDate, formatStatus, getValidityStatus } from '../utils/format'
import { getStatusColor, isEditable, isApprovable } from '../constants/pricelist.constants'

interface PricelistTableProps {
  data: PricelistWithRelations[]
  loading: boolean
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onView: (id: string) => void
  onApprove: (id: string) => void
  sortBy?: SortField
  sortOrder?: SortOrder
  onSort: (field: string) => void
}

export const PricelistTable = memo(function PricelistTable({
  data,
  loading,
  onEdit,
  onDelete,
  onView,
  onApprove,
  sortBy,
  sortOrder,
  onSort
}: PricelistTableProps) {
  const handleSort = useCallback((field: string) => {
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
              >
                Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('valid_from')}
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
            {data.map((pricelist) => {
              const validityStatus = getValidityStatus(pricelist.valid_from, pricelist.valid_to)
              const statusColor = getStatusColor(pricelist.status)
              const canEdit = isEditable(pricelist.status)
              const canApprove = isApprovable(pricelist.status)

              return (
                <tr key={pricelist.id} className="hover:bg-gray-50">
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
                    <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${statusColor}-100 text-${statusColor}-800`}>
                      {formatStatus(pricelist.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${validityStatus.color}-100 text-${validityStatus.color}-800`}>
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
                      {canEdit && (
                        <button
                          onClick={() => onEdit(pricelist.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                      )}
                      {canApprove && (
                        <button
                          onClick={() => onApprove(pricelist.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(pricelist.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})
