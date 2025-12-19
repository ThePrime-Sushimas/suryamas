import { useRef, useEffect } from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import type { MetricUnit } from '@/types/metricUnit'
import { formatDate } from '@/utils/dateUtils'

interface MetricUnitTableProps {
  data: MetricUnit[]
  isLoading?: boolean
  selectedIds?: string[]
  onSelect?: (id: string) => void
  onSelectAll?: (selected: boolean) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

export default function MetricUnitTable({
  data,
  isLoading,
  selectedIds = [],
  onSelect,
  onSelectAll,
  onEdit,
  onDelete
}: MetricUnitTableProps) {
  const selectAllRef = useRef<HTMLInputElement>(null)

  const allSelected = data.length > 0 && selectedIds.length === data.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < data.length

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  if (isLoading) return <div className="text-center py-8 text-gray-500">Loading...</div>
  if (data.length === 0) return <div className="text-center py-8 text-gray-500">No data</div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800 border-b">
          <tr>
            <th className="px-4 py-3 text-left">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={e => onSelectAll?.(e.target.checked)}
                className="rounded"
              />
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Unit Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map(unit => (
            <tr key={unit.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(unit.id)}
                  onChange={() => onSelect?.(unit.id)}
                  className="rounded"
                />
              </td>
              <td className="px-4 py-3 text-sm">{unit.metric_type}</td>
              <td className="px-4 py-3 text-sm font-medium">{unit.unit_name}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">{unit.notes || '-'}</td>
              <td className="px-4 py-3 text-sm">
                <span className={`px-2 py-1 rounded text-xs font-medium ${unit.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {unit.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{formatDate(unit.created_at)}</td>
              <td className="px-4 py-3 text-sm flex gap-2">
                {onEdit && <button onClick={() => onEdit(unit.id)} className="text-amber-600 hover:bg-amber-50 p-1 rounded"><Edit2 size={16} /></button>}
                {onDelete && <button onClick={() => onDelete(unit.id)} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 size={16} /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
