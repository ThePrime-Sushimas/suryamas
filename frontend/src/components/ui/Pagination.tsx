/**
 * Pagination.tsx
 * 
 * Global reusable pagination component.
 * Used across all features in the application.
 * Follows backend pagination utility structure.
 */

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

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

// =============================================================================
// DEFAULT OPTIONS
// =============================================================================

const DEFAULT_LIMIT_OPTIONS = [10, 25, 50, 100]

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Global reusable pagination component
 * Works with any data table that needs pagination
 */
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

  // Calculate showing range
  const showingStart = total === 0 ? 0 : (page - 1) * limit + 1
  const showingEnd = currentLength ? Math.min(page * limit, (page - 1) * limit + currentLength) : page * limit

  // Don't render if no data
  if (total === 0) {
    return null
  }

  return (
    <div 
      className={`flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
      role="navigation"
      aria-label="Pagination"
    >
      {/* Left side: Info and limit select */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Showing info */}
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Menampilkan <span className="font-medium">{showingStart}</span> -{' '}
          <span className="font-medium">{showingEnd}</span> dari{' '}
          <span className="font-medium">{total}</span> data
        </span>

        {/* Limit select */}
        {showLimitSelect && onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            disabled={loading}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Jumlah data per halaman"
          >
            {limitOptions.map((option) => (
              <option key={option} value={option}>
                {option} per halaman
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Right side: Page navigation */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || loading}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Sebelumnya
        </button>

        {/* Page info */}
        <span className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
          Halaman <span className="font-medium">{page}</span> dari{' '}
          <span className="font-medium">{totalPages}</span>
        </span>

        {/* Next button */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || loading}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          aria-label="Halaman berikutnya"
        >
          Berikutnya
          <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// EXPORT
// =============================================================================

export default Pagination

