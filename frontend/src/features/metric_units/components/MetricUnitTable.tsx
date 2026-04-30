import { Pencil, Trash2, RotateCcw, Ruler } from 'lucide-react'
import type { MetricUnit } from '../types'

const TABLE_COLS = 5

interface MetricUnitTableProps {
  metricUnits: MetricUnit[]
  loading: boolean
  onEdit: (id: string) => void
  onDelete: (unit: MetricUnit) => void
  onRestore: (unit: MetricUnit) => void
}

export const MetricUnitTable = ({ metricUnits, loading, onEdit, onDelete, onRestore }: MetricUnitTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama Satuan</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Catatan</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: TABLE_COLS }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : metricUnits.length === 0 ? (
            <tr>
              <td colSpan={TABLE_COLS} className="px-6 py-16 text-center">
                <Ruler className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">Tidak ada satuan ditemukan</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Coba ubah filter atau tambah satuan baru</p>
              </td>
            </tr>
          ) : metricUnits.map(unit => (
            <tr key={unit.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3 text-gray-900 dark:text-white">{unit.metric_type}</td>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{unit.unit_name}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                <div className="max-w-xs truncate" title={unit.notes || undefined}>
                  {unit.notes || <span className="text-gray-400">-</span>}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                  unit.is_active
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {unit.is_active ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => onEdit(unit.id)} className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {unit.is_active ? (
                    <button onClick={() => onDelete(unit)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Hapus">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => onRestore(unit)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Pulihkan">
                      <RotateCcw className="w-4 h-4" />
                    </button>
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
