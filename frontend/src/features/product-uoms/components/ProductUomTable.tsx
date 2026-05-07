import { Edit2, Trash2, RotateCcw } from 'lucide-react'
import type { ProductUom } from '../types'

interface ProductUomTableProps {
  uoms: ProductUom[]
  onEdit: (uom: ProductUom) => void
  onDelete: (uom: ProductUom) => void
  onRestore: (id: string) => void
  loading?: boolean
}

export function ProductUomTable({ uoms, onEdit, onDelete, onRestore, loading }: ProductUomTableProps) {
  const baseUnit = uoms.find(u => u.is_base_unit)

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (uoms.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
        <span className="text-4xl">📦</span>
        <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-white">Belum ada satuan</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tambah satuan untuk produk ini.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Satuan</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Konversi</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga Dasar</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Penggunaan</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {uoms.map(uom => (
              <tr key={uom.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${uom.is_deleted ? 'opacity-50 bg-red-50 dark:bg-red-900/10' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${uom.is_deleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {uom.metric_units?.unit_name || '—'}
                    </span>
                    {uom.is_base_unit && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">BASE</span>}
                    {uom.is_deleted && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">DEL</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {uom.is_base_unit ? (
                    <span className="text-gray-400">1 (Satuan Dasar)</span>
                  ) : baseUnit ? (
                    <span>1 {uom.metric_units?.unit_name} = {uom.conversion_factor.toLocaleString('id-ID')} {baseUnit.metric_units?.unit_name}</span>
                  ) : (
                    <span className="font-mono">{uom.conversion_factor}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                  {uom.base_price ? `Rp ${uom.base_price.toLocaleString('id-ID')}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {uom.is_default_stock_unit && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Stok</span>}
                    {uom.is_default_purchase_unit && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Beli</span>}
                    {uom.is_default_transfer_unit && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">Transfer</span>}
                    {!uom.is_default_stock_unit && !uom.is_default_purchase_unit && !uom.is_default_transfer_unit && <span className="text-gray-400">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${uom.status_uom === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                    {uom.status_uom === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {uom.is_deleted ? (
                    <button onClick={() => onRestore(uom.id)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                      <RotateCcw className="w-3.5 h-3.5 inline mr-1" />Pulihkan
                    </button>
                  ) : (
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => onEdit(uom)} disabled={uom.status_uom === 'INACTIVE'}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded disabled:opacity-30">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(uom)} disabled={uom.is_base_unit}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded disabled:opacity-30"
                        title={uom.is_base_unit ? 'Satuan dasar tidak bisa dihapus' : ''}>
                        <Trash2 className="w-3.5 h-3.5" />
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
