
import { useState } from 'react'
import { Search, Filter, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import { useBankStatementImportStore } from '../store/bank-statement-import.store'
import { 
  BANK_STATEMENT_IMPORT_STATUS_LABELS, 
  BANK_STATEMENT_IMPORT_QUICK_FILTERS 
} from '../constants/bank-statement-import.constants'
import type { BankStatementImportStatus } from '../types/bank-statement-import.types'

type LocalFilter = {
  status?: BankStatementImportStatus | 'ALL'
  dateFrom?: string
  dateTo?: string
  search?: string
}

export function BankStatementImportFilters() {
  const { 
    filters, 
    setFilters, 
    fetchImports, 
    setPagination 
  } = useBankStatementImportStore()
  
  const [localFilters, setLocalFilters] = useState<LocalFilter>({
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    search: filters.search,
  })
  const [isExpanded, setIsExpanded] = useState(false)

  const handleApply = () => {
    setFilters(localFilters)
    setPagination(1)
    fetchImports({ page: 1, filters: localFilters })
  }

  const handleReset = () => {
    const resetFilters: LocalFilter = {}
    setLocalFilters(resetFilters)
    setFilters(resetFilters)
    setPagination(1)
    fetchImports({ page: 1, filters: resetFilters })
  }

  const activeFilterCount = [
    localFilters.status,
    localFilters.dateFrom,
    localFilters.dateTo,
    localFilters.search,
  ].filter(Boolean).length

  const handleQuickFilter = (getValue: () => { dateFrom: string; dateTo: string }) => {
    const newFilters = { ...localFilters, ...getValue() }
    const cleanedFilters = Object.fromEntries(
      Object.entries(newFilters).filter(([, v]) => v !== undefined && v !== 'ALL')
    ) as LocalFilter
    setLocalFilters(cleanedFilters)
    setFilters(cleanedFilters)
    setPagination(1)
    fetchImports({ page: 1, filters: cleanedFilters })
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={localFilters.search || ''}
              onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value || undefined })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleApply()
                }
              }}
              placeholder="Cari nama file, akun bank..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white dark:placeholder-gray-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            {BANK_STATEMENT_IMPORT_QUICK_FILTERS.map((qf, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickFilter(qf.getValue)}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                {qf.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
              isExpanded || activeFilterCount > 0
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            Terapkan
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Status
              </label>
              <select
                value={localFilters.status || 'ALL'}
                onChange={(e) => setLocalFilters({ 
                  ...localFilters, 
                  status: e.target.value === 'ALL' ? undefined : e.target.value as BankStatementImportStatus 
                })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
              >
                <option value="ALL">Semua Status</option>
                {Object.entries(BANK_STATEMENT_IMPORT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Tanggal Dari
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={localFilters.dateFrom || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, dateFrom: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Tanggal Sampai
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={localFilters.dateTo || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, dateTo: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

