/**
 * Pagination.tsx
 * 
 * Global reusable pagination component.
 * Used across all features in the application.
 * Follows backend pagination utility structure.
 */

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext?: boolean
  hasPrev?: boolean
}

export interface PaginationProps {
  pagination: PaginationInfo
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  currentLength?: number
  loading?: boolean
  limitOptions?: number[]
  showLimitSelect?: boolean
  className?: string
}

const DEFAULT_LIMIT_OPTIONS = [10, 25, 50, 100]

export const Pagination: React.FC<PaginationProps> = ({
  pagination,
  onPageChange,
  onLimitChange,
  currentLength,
  loading = false,
  limitOptions = DEFAULT_LIMIT_OPTIONS,
  showLimitSelect = true,
  className = '',
}) => {
  const { page, limit, total, totalPages, hasNext, hasPrev } = pagination

  const showingStart = total === 0 ? 0 : (page - 1) * limit + 1
  const showingEnd = currentLength ? Math.min(page * limit, (page - 1) * limit + currentLength) : page * limit

  if (total === 0 && !loading) return null

  if (loading) {
    return (
      <div
        className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
        role="navigation"
        aria-label="Pagination"
      >
        <div className="flex items-center gap-3">
          <div className="animate-pulse h-4 w-32 sm:w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="animate-pulse h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <div className="animate-pulse h-8 w-8 sm:w-28 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="animate-pulse h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="animate-pulse h-8 w-8 sm:w-28 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
      role="navigation"
      aria-label="Pagination"
    >
      {/* Left: info + limit */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 w-full sm:w-auto">
        <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">{showingStart}</span>
          {' - '}
          <span className="font-medium">{showingEnd}</span>
          <span className="hidden sm:inline"> dari</span>
          <span className="sm:hidden"> /</span>
          {' '}<span className="font-medium">{total}</span>
          <span className="hidden sm:inline"> data</span>
        </span>

        {showLimitSelect && onLimitChange && (
          <div className="flex items-center gap-1.5">
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              disabled={loading}
              className="px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Jumlah data per halaman"
            >
              {limitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
              per halaman
            </span>
          </div>
        )}
      </div>

      {/* Right: navigation */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || loading}
          className="inline-flex items-center px-2 py-1.5 sm:px-3 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        <span className="px-2 py-1.5 text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
          <span className="font-medium">{page}</span>
          <span className="mx-1">/</span>
          <span className="font-medium">{totalPages}</span>
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || loading}
          className="inline-flex items-center px-2 py-1.5 sm:px-3 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          aria-label="Halaman berikutnya"
        >
          <span className="hidden sm:inline">Berikutnya</span>
          <ChevronRight className="w-4 h-4 sm:ml-1" />
        </button>
      </div>
    </div>
  )
}

export default Pagination
