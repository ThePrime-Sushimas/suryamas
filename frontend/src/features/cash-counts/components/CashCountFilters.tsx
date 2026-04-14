import { Search, RefreshCw } from 'lucide-react'
import type { CashCountListFilter, CashCountStatus } from '../types'

const STATUS_OPTIONS: { value: CashCountStatus | ''; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: 'OPEN', label: 'Open' },
  { value: 'COUNTED', label: 'Counted' },
  { value: 'DEPOSITED', label: 'Deposited' },
  { value: 'CLOSED', label: 'Closed' },
]

interface Props {
  filter: CashCountListFilter
  onFilterChange: (f: Partial<CashCountListFilter>) => void
  onApply: () => void
  isLoading: boolean
}

export function CashCountFilters({ filter, onFilterChange, onApply, isLoading }: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="w-40">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Dari</label>
          <input
            type="date"
            value={filter.start_date || ''}
            onChange={(e) => onFilterChange({ start_date: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-40">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Sampai</label>
          <input
            type="date"
            value={filter.end_date || ''}
            onChange={(e) => onFilterChange({ end_date: e.target.value || undefined })}
            min={filter.start_date}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-40">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Status</label>
          <select
            value={filter.status || ''}
            onChange={(e) => onFilterChange({ status: (e.target.value || undefined) as CashCountStatus | undefined })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button
          onClick={onApply}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Terapkan
        </button>
      </div>
    </div>
  )
}
