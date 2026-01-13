import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useAccountingPurposesStore } from '../store/accountingPurposes.store'
import { AccountingPurposeTable } from '../components/AccountingPurposeTable'
import { AccountingPurposeFilters } from '../components/AccountingPurposeFilters'
import type { FilterParams } from '../types/accounting-purpose.types'

interface AccountingPurposesListPageProps {
  onCreateNew: () => void
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export const AccountingPurposesListPage = ({
  onCreateNew,
  onView,
  onEdit,
  onDelete
}: AccountingPurposesListPageProps) => {
  const {
    purposes,
    loading,
    error,
    pagination,
    fetchPurposes,
    searchPurposes,
    setFilter,
    clearError
  } = useAccountingPurposesStore()

  useEffect(() => {
    fetchPurposes(1, 25)
  }, [])

  const handleSearch = (query: string) => {
    if (query.trim()) {
      searchPurposes(query)
    } else {
      fetchPurposes(1, 25)
    }
  }

  const handleFilter = (filters: FilterParams) => {
    setFilter(filters)
  }

  const handlePageChange = (page: number) => {
    fetchPurposes(page, pagination.limit)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting Purposes</h1>
          <p className="text-gray-600">Manage accounting purpose codes for transactions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            New Purpose
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <p className="text-red-800">{error}</p>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <AccountingPurposeFilters
        onSearch={handleSearch}
        onFilter={handleFilter}
        loading={loading}
      />

      {/* Table */}
      <AccountingPurposeTable
        purposes={purposes}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        loading={loading}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev || loading}
            className="px-3 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNext || loading}
            className="px-3 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}