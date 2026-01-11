import { Edit2, Trash2, RotateCcw } from 'lucide-react'
import type { ProductUom } from '../types'
import { TableSkeleton } from '@/components/ui/Skeleton'

interface ProductUomTableProps {
  uoms: ProductUom[]
  onEdit: (uom: ProductUom) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  loading?: boolean
}

export function ProductUomTable({ uoms, onEdit, onDelete, onRestore, loading }: ProductUomTableProps) {
  // Find base unit for conversion display
  const baseUnit = uoms.find(uom => uom.is_base_unit)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <TableSkeleton rows={5} columns={6} />
      </div>
    )
  }

  if (uoms.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
          <span className="text-4xl">📦</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Units of Measure</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Add units to define how this product is stocked, purchased, and transferred.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg shadow bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Unit
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Conversion
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price (Base)
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Usage
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {uoms.map((uom) => (
            <tr key={uom.id} className={`hover:bg-gray-50 transition-colors ${uom.is_deleted ? 'bg-red-50' : ''}`}>
              {/* Unit Column */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${uom.is_deleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {uom.metric_units?.unit_name || '-'}
                  </span>
                  {uom.is_base_unit && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Base
                    </span>
                  )}
                  {uom.is_deleted && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Deleted
                    </span>
                  )}
                </div>
              </td>

              {/* Conversion Column - Business Sentence Format */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {uom.is_base_unit ? (
                  <span className="text-gray-500">1 (Base Unit)</span>
                ) : baseUnit ? (
                  <span>
                    1 {uom.metric_units?.unit_name || '-'} = {uom.conversion_factor.toLocaleString('id-ID')} {baseUnit.metric_units?.unit_name || '-'}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>

              {/* Price (Base) Column */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {uom.base_price !== null && uom.base_price !== undefined ? (
                  <span>
                    Rp {uom.base_price.toLocaleString('id-ID')} / {baseUnit?.metric_units?.unit_name || 'Base'}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>

              {/* Usage Column - Colored Badges */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-wrap gap-1">
                  {uom.is_default_stock_unit && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Stock
                    </span>
                  )}
                  {uom.is_default_purchase_unit && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                      Purchase
                    </span>
                  )}
                  {uom.is_default_transfer_unit && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                      Transfer
                    </span>
                  )}
                  {!uom.is_default_stock_unit && !uom.is_default_purchase_unit && !uom.is_default_transfer_unit && (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </div>
              </td>

              {/* Status Column */}
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    uom.status_uom === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {uom.status_uom}
                </span>
              </td>

              {/* Actions Column */}
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  {uom.is_deleted ? (
                    <button
                      onClick={() => onRestore(uom.id)}
                      className="text-green-600 hover:text-green-900 p-1.5 rounded hover:bg-green-50 transition-colors"
                      title="Restore"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onEdit(uom)}
                        className="text-blue-600 hover:text-blue-900 p-1.5 rounded hover:bg-blue-50 transition-colors"
                        title="Edit"
                        disabled={uom.status_uom === 'INACTIVE'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(uom.id)}
                        className="text-red-600 hover:text-red-900 p-1.5 rounded hover:bg-red-50 transition-colors"
                        title={uom.is_base_unit ? 'Base unit cannot be deleted' : 'Delete'}
                        disabled={uom.is_base_unit || uom.status_uom === 'INACTIVE'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

