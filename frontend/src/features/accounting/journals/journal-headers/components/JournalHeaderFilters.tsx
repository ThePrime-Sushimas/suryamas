import { useState, useEffect } from 'react'
import { useJournalHeadersStore } from '../store/journalHeaders.store'
import { JOURNAL_TYPES, JOURNAL_STATUS } from '../../shared/journal.constants'
import type { JournalType, JournalStatus } from '../../shared/journal.types'
import { branchesApi } from '@/features/branches/api/branches.api'
import type { Branch } from '@/features/branches/types'

export function JournalHeaderFilters() {
  const { filters, setFilters, fetchJournals } = useJournalHeadersStore()
  const [localFilters, setLocalFilters] = useState(filters)
  const [branches, setBranches] = useState<Branch[]>([])

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
    fetchJournals(localFilters)
  }

  const handleReset = () => {
    const resetFilters = {}
    setLocalFilters(resetFilters)
    setFilters(resetFilters)
    fetchJournals(resetFilters)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <select
            value={localFilters.branch_id || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, branch_id: e.target.value || undefined })}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={localFilters.journal_type || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, journal_type: e.target.value as JournalType || undefined })}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">All Types</option>
            {Object.values(JOURNAL_TYPES).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={localFilters.status || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value as JournalStatus || undefined })}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">All Status</option>
            {Object.values(JOURNAL_STATUS).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
          <input
            type="month"
            value={localFilters.period || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, period: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
          <input
            type="date"
            value={localFilters.date_from || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, date_from: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
          <input
            type="date"
            value={localFilters.date_to || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, date_to: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            type="text"
            value={localFilters.search || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
            placeholder="Journal number, description..."
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Apply Filters
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
