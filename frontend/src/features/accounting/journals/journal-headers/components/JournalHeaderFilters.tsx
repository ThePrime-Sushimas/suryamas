import { useState, useEffect } from 'react'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JOURNAL_TYPES, JOURNAL_STATUS } from '../../shared/journal.constants'
import type { JournalType, JournalStatus } from '../../shared/journal.types'
import { branchesApi } from '@/features/branches/api/branches.api'
import type { Branch } from '@/features/branches/types'
import type { JournalSortParams } from '../types/journal-header.types'
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'

type JournalFilter = {
  branch_id?: string
  journal_type?: JournalType
  status?: JournalStatus
  date_from?: string
  date_to?: string
  period?: string
  search?: string
  show_deleted?: boolean
}

export function JournalHeaderFilters() {
  const { filters, setFilters, fetchJournals, setHasAppliedFilters } = useJournalHeadersStore()
  const [localFilters, setLocalFilters] = useState<JournalFilter & JournalSortParams>(filters)
  const [branches, setBranches] = useState<Branch[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const response = await branchesApi.list(1, 1000)
        setBranches(response.data)
      } catch (error) {
        console.error('Failed to fetch branches:', error)
      }
    }
    loadBranches()
  }, [])

  const handleApply = () => {
    setFilters(localFilters)
    setHasAppliedFilters(true)
    fetchJournals(localFilters)
  }

  const handleReset = () => {
    const resetFilters: JournalFilter & JournalSortParams = {
      sort: 'journal_date',
      order: 'desc',
    }
    setLocalFilters(resetFilters)
    setFilters(resetFilters)
    setHasAppliedFilters(false)
  }

  const activeFilterCount = [
    localFilters.branch_id,
    localFilters.journal_type,
    localFilters.status,
    localFilters.period,
    localFilters.date_from,
    localFilters.date_to,
    localFilters.search,
  ].filter(Boolean).length

  const quickFilters = [
    { label: 'Hari Ini', getValue: () => {
      const today = new Date().toISOString().split('T')[0]
      return { date_from: today, date_to: today }
    }},
    { label: 'Minggu Ini', getValue: () => {
      const now = new Date()
      const start = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0]
      return { date_from: start, date_to: new Date().toISOString().split('T')[0] }
    }},
    { label: 'Bulan Ini', getValue: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      return { date_from: start, date_to: new Date().toISOString().split('T')[0] }
    }},
  ]

  const handleQuickFilter = (getValue: () => { date_from: string; date_to: string }) => {
    const newFilters = { ...localFilters, ...getValue() }
    const cleanedFilters = Object.fromEntries(
      Object.entries(newFilters).filter(([, v]) => v !== undefined)
    ) as JournalFilter & JournalSortParams
    setLocalFilters(cleanedFilters)
    setFilters(cleanedFilters)
    setHasAppliedFilters(true)
    fetchJournals(cleanedFilters)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={localFilters.search || ''}
              onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value || undefined })}
              placeholder="Cari nomor, deskripsi..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white dark:placeholder-gray-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            {quickFilters.map((qf, idx) => (
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
                Branch
              </label>
              <select
                value={localFilters.branch_id || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, branch_id: e.target.value || undefined })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
              >
                <option value="">Semua Branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Tipe
              </label>
              <select
                value={localFilters.journal_type || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, journal_type: e.target.value as JournalType || undefined })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
              >
                <option value="">Semua Tipe</option>
                {Object.values(JOURNAL_TYPES).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Status
              </label>
              <select
                value={localFilters.status || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value as JournalStatus || undefined })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
              >
                <option value="">Semua Status</option>
                {Object.values(JOURNAL_STATUS).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Periode
              </label>
              <input
                type="month"
                value={localFilters.period || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, period: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Tanggal Dari
              </label>
              <input
                type="date"
                value={localFilters.date_from || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, date_from: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Tanggal Sampai
              </label>
              <input
                type="date"
                value={localFilters.date_to || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, date_to: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

