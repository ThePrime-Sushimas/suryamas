// Supplier Product Table - Data table with actions

import { formatPrice, formatLeadTime, getStatusColor, getPreferredColor } from '../utils/format'
import type { SupplierProductWithRelations } from '../types/supplier-product.types'
import { TableSkeleton } from '@/components/ui/Skeleton'

interface SupplierProductTableProps {
  data: SupplierProductWithRelations[]
  loading: boolean
  selectedItems: string[]
  onSelectAll: (checked: boolean) => void
  onSelectItem: (id: string, checked: boolean) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onView: (id: string) => void
  onRestore: (id: string) => void
  onManagePrices: (id: string) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void
}

const SortIcon = ({ field, sortBy, sortOrder }: { field: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
  if (sortBy !== field) return <span className="ml-1 text-gray-400 dark:text-gray-500">↕</span>
  return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
}

const SortableHeader = ({ field, sortBy, sortOrder, onSort, children }: { field: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; onSort?: (field: string) => void; children: React.ReactNode }) => (
  <th 
    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
    onClick={() => onSort?.(field)}
  >
    <div className="flex items-center">
      {children}
      <SortIcon field={field} sortBy={sortBy} sortOrder={sortOrder} />
    </div>
  </th>
)

export function SupplierProductTable({
  data,
  loading,
  selectedItems,
  onSelectAll,
  onSelectItem,
  onEdit,
  onDelete,
  onView,
  onRestore,
  onManagePrices,
  sortBy,
  sortOrder,
  onSort
}: SupplierProductTableProps) {
  const allSelected = data.length > 0 && selectedItems.length === data.length
  const someSelected = selectedItems.length > 0 && selectedItems.length < data.length

  const handleSelectAll = () => {
    onSelectAll(!allSelected)
  }

  const handleSelectItem = (id: string, checked: boolean) => {
    onSelectItem(id, checked)
  }

  if (loading && data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <TableSkeleton rows={5} columns={10} />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
                <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded" disabled />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lead Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
        </table>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No supplier products</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new supplier product.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = someSelected
                }}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit</th>
            <SortableHeader field="price" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort}>Price</SortableHeader>
            <SortableHeader field="lead_time_days" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort}>Lead Time</SortableHeader>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Min Order</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preferred</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item) => (
            <tr 
              key={item.id} 
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
              onClick={() => onView(item.id)}
            >
              <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.supplier?.supplier_name || '-'}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {item.supplier?.supplier_code || item.supplier_id}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.product?.product_name || '-'}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {item.product?.product_code || item.product_id}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {item.current_unit || item.product?.default_purchase_unit || '-'}
                </div>
                {item.current_unit && (
                  <div className="text-xs text-green-600 dark:text-green-400">From pricelist</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.current_price !== undefined 
                    ? formatPrice(item.current_price, item.current_currency || item.currency)
                    : formatPrice(item.price, item.currency)
                  }
                </div>
                {item.current_price !== undefined && (
                  <div className="text-xs text-green-600 dark:text-green-400">From pricelist</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {formatLeadTime(item.lead_time_days)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {item.min_order_qty ? item.min_order_qty.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPreferredColor(item.is_preferred)}`}>
                  {item.is_preferred ? '★ Yes' : 'No'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {item.deleted_at ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                    Deleted
                  </span>
                ) : (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.is_active)}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                {item.deleted_at ? (
                  <button
                    onClick={() => onRestore(item.id)}
                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                  >
                    Restore
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onManagePrices(item.id)}
                      className="px-2 py-1 text-xs bg-green-600 dark:bg-green-600 text-white rounded hover:bg-green-700 dark:hover:bg-green-500"
                    >
                      Manage Prices
                    </button>
                    <button
                      onClick={() => onEdit(item.id)}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

