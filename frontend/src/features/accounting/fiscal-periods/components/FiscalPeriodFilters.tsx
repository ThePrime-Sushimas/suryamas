import { useState } from 'react'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'

export function FiscalPeriodFilters() {
  const { filters, setFilters, fetchPeriods } = useFiscalPeriodsStore()
  const [localFilters, setLocalFilters] = useState(filters)

  const handleApply = () => {
    setFilters(localFilters)
    fetchPeriods()
  }

  const handleReset = () => {
    setLocalFilters({})
    setFilters({})
    fetchPeriods()
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i)

  return (
    <div className="flex gap-4 items-end">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="fiscal-year-filter">
          Fiscal Year
        </label>
        <select
          id="fiscal-year-filter"
          value={localFilters.fiscal_year || ''}
          onChange={(e) => setLocalFilters({ ...localFilters, fiscal_year: e.target.value ? Number(e.target.value) : undefined })}
          className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          aria-label="Filter by fiscal year"
        >
          <option value="">All Years</option>
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="status-filter">
          Status
        </label>
        <select
          id="status-filter"
          value={localFilters.is_open === undefined ? '' : localFilters.is_open ? 'true' : 'false'}
          onChange={(e) => setLocalFilters({ ...localFilters, is_open: e.target.value === '' ? undefined : e.target.value === 'true' })}
          className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          aria-label="Filter by status"
        >
          <option value="">All</option>
          <option value="true">Open</option>
          <option value="false">Closed</option>
        </select>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={localFilters.show_deleted || false}
            onChange={(e) => setLocalFilters({ ...localFilters, show_deleted: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show Deleted</span>
        </label>
      </div>

      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="search-filter">
          Search
        </label>
        <input
          id="search-filter"
          type="text"
          placeholder="Search period..."
          value={localFilters.q || ''}
          onChange={(e) => setLocalFilters({ ...localFilters, q: e.target.value })}
          className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          aria-label="Search fiscal periods"
        />
      </div>

      <button
        onClick={handleApply}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Apply
      </button>

      <button
        onClick={handleReset}
        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
      >
        Reset
      </button>
    </div>
  )
}
