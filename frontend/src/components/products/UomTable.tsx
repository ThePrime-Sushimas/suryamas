import type { ProductUom } from '../../types/product'
import { Trash2, Edit2, RotateCcw } from 'lucide-react'

interface UomTableProps {
  uoms: ProductUom[]
  onDelete: (id: string) => void
  onEdit: (uom: ProductUom) => void
  onRestore?: (id: string) => void
  onUpdateDefault?: (id: string, field: string, value: boolean) => void
}

export const UomTable = ({ uoms, onDelete, onEdit, onRestore, onUpdateDefault }: UomTableProps) => {
  const baseUnit = uoms.find(u => u.is_base_unit && !u.is_deleted)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="p-3 text-left font-semibold">Unit</th>
            <th className="p-3 text-center font-semibold">Conversion Factor</th>
            <th className="p-3 text-left font-semibold">Base Unit</th>
            <th className="p-3 text-center font-semibold">Base Price</th>
            <th colSpan={4} className="p-3 text-center font-semibold">Default</th>
            <th className="p-3 text-center font-semibold">Actions</th>
          </tr>
          <tr className="bg-gray-50 border-b">
            <th colSpan={4}></th>
            <th className="p-3 text-center text-xs font-medium">Stock Unit</th>
            <th className="p-3 text-center text-xs font-medium">Purchase Unit</th>
            <th className="p-3 text-center text-xs font-medium">Base Unit</th>
            <th className="p-3 text-center text-xs font-medium">Transfer Unit</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {uoms.map((uom) => (
            <tr key={uom.id} className={`border-b hover:bg-gray-50 ${uom.is_deleted ? 'bg-red-50' : ''}`}>
              <td className="p-3">
                {uom.unit_name}
                {uom.is_deleted && <span className="text-red-600 text-xs ml-2">(Deleted)</span>}
              </td>
              <td className="p-3 text-center font-semibold">{uom.conversion_factor}</td>
                <td className="p-3">{baseUnit?.unit_name || '-'} </td> 
              <td className="p-3 text-center">{uom.base_price || 0}</td>
              {!uom.is_deleted && (
                <>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={uom.is_default_stock_unit || false}
                      onChange={(e) => onUpdateDefault?.(uom.id, 'is_default_stock_unit', e.target.checked)}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={uom.is_default_purchase_unit || false}
                      onChange={(e) => onUpdateDefault?.(uom.id, 'is_default_purchase_unit', e.target.checked)}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={uom.is_default_base_unit || false}
                      onChange={(e) => onUpdateDefault?.(uom.id, 'is_default_base_unit', e.target.checked)}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={uom.is_default_transfer_unit || false}
                      onChange={(e) => onUpdateDefault?.(uom.id, 'is_default_transfer_unit', e.target.checked)}
                    />
                  </td>
                </>
              )}
              <td className="p-3 text-center space-x-2 flex justify-center">
                {uom.is_deleted ? (
                  <button
                    onClick={() => onRestore?.(uom.id)}
                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded"
                    title="Restore"
                  >
                    <RotateCcw size={16} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onEdit(uom)}
                      className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(uom.id)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
