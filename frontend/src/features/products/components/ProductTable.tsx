import { TableSkeleton } from '@/components/ui/Skeleton'

import type { Product, ProductStatus, ProductType } from '../types'

const statusColors: Record<ProductStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  DISCONTINUED: 'bg-red-100 text-red-800'
}

const typeColors: Record<ProductType, string> = {
  raw: 'bg-blue-100 text-blue-800',
  semi_finished: 'bg-yellow-100 text-yellow-800',
  finished_goods: 'bg-green-100 text-green-800'
}

const typeLabels: Record<ProductType, string> = {
  raw: 'Raw',
  semi_finished: 'Semi',
  finished_goods: 'Finished'
}

interface ProductTableProps {
  products: Product[]
  selectedIds: string[]
  deletingId: string | null
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onManageUoms: (id: string) => void
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  loading?: boolean
}

export const ProductTable = ({
  products,
  selectedIds,
  deletingId,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onManageUoms,
  onToggleSelect,
  onToggleSelectAll
, loading}: ProductTableProps) => {
  if (loading) {
    return <TableSkeleton rows={6} columns={6} />
  }

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new product.
          </p>
        </div>
      </div>
    )
  }

  const allSelected = products.length > 0 && selectedIds.length === products.length

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Cost
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                BOM Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Flags
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.map(product => {
              const isSelected = selectedIds.includes(product.id)
              const isDeleting = deletingId === product.id
              const isDeleted = product.is_deleted

              return (
                <tr
                  key={product.id}
                  onClick={() => onView(product.id)}
                  className={`hover:bg-gray-50 transition cursor-pointer ${
                    isSelected ? 'bg-blue-50' : ''
                  } ${isDeleting ? 'opacity-50' : ''} ${isDeleted ? 'bg-red-50' : ''}`}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(product.id)}
                      disabled={isDeleting}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {product.product_code}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {product.product_name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        typeColors[product.product_type]
                      }`}
                    >
                      {typeLabels[product.product_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0
                    }).format(product.average_cost)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {product.bom_name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        statusColors[product.status]
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="flex gap-2">
                      {product.is_requestable && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          REQ
                        </span>
                      )}
                      {product.is_purchasable && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          PUR
                        </span>
                      )}
                      {isDeleted && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          DEL
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm space-x-2" onClick={(e) => e.stopPropagation()}>
                    {isDeleted ? (
                      <button
                        onClick={() => onRestore(product.id)}
                        disabled={isDeleting}
                        className="text-green-600 hover:text-green-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Restore
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onManageUoms(product.id)}
                          disabled={isDeleting}
                          className="text-purple-600 hover:text-purple-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          UOMs
                        </button>
                        <button
                          onClick={() => onEdit(product.id)}
                          disabled={isDeleting}
                          className="text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(product.id)}
                          disabled={isDeleting}
                          className="text-red-600 hover:text-red-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
