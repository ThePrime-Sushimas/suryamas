import { useMemo, useState } from 'react'
import type { WasteByItemGroup } from '../api/wasteReport.api'
import { EmptyState } from './EmptyState'
import { fmt, fmtRp } from './wasteReport.constants'

type ByItemSortKey = 'total_cost' | 'total_qty' | 'record_count' | 'item_name'

export function ByItemTab({ groups }: { groups: WasteByItemGroup[] }) {
  const [sortKey, setSortKey] = useState<ByItemSortKey>('total_cost')

  const sortedGroups = useMemo(() => {
    const list = [...groups]
    switch (sortKey) {
      case 'total_qty':
        return list.sort((a, b) => b.total_qty - a.total_qty)
      case 'record_count':
        return list.sort((a, b) => b.record_count - a.record_count)
      case 'item_name':
        return list.sort((a, b) =>
          (a.item_name ?? a.item_id).localeCompare(b.item_name ?? b.item_id, 'id'),
        )
      default:
        return list.sort((a, b) => b.total_cost - a.total_cost)
    }
  }, [groups, sortKey])

  const sortOptions: { key: ByItemSortKey; label: string }[] = [
    { key: 'total_cost', label: 'Total Nilai' },
    { key: 'total_qty', label: 'Total Qty' },
    { key: 'record_count', label: 'Transaksi' },
    { key: 'item_name', label: 'Nama Produk' },
  ]

  if (groups.length === 0) {
    return <EmptyState message="Tidak ada produk dengan waste pada periode ini." />
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900/50">
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortKey(opt.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              sortKey === opt.key
                ? 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {sortedGroups.map((g, i) => (
          <div
            key={g.item_id}
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-all"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300 shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {g.item_name ?? g.item_id}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {g.record_count} transaksi · Qty {fmt(g.total_qty)}
              </p>
            </div>
            <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums shrink-0">
              {fmtRp(g.total_cost)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
