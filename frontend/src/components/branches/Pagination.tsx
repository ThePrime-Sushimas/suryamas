import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

export const Pagination = ({ page, limit, total, onPageChange, onLimitChange }: PaginationProps) => {
  const totalPages = Math.ceil(total / limit)
  const hasNext = page < totalPages
  const hasPrev = page > 1

  return (
    <div className="flex items-center justify-between py-4 px-4 bg-white border-t border-gray-200">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Show</span>
        <select
          value={limit}
          onChange={(e) => {
            onLimitChange(Number(e.target.value))
            onPageChange(1)
          }}
          className="px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span className="text-sm text-gray-600">entries</span>
      </div>

      <div className="text-sm text-gray-600">
        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="p-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, page - 2) + i
            if (pageNum > totalPages) return null
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-2 py-1 rounded text-sm ${
                  pageNum === page
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>

        {totalPages > 5 && (
          <input
            type="number"
            min="1"
            max={totalPages}
            value={page}
            onChange={(e) => {
              const newPage = Math.max(1, Math.min(totalPages, Number(e.target.value)))
              onPageChange(newPage)
            }}
            className="w-12 px-2 py-1 border border-gray-300 rounded text-sm text-center"
            title="Jump to page"
          />
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="p-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
