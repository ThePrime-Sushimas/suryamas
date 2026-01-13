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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Accounting Purposes</h1>
              <p className="text-sm text-gray-500">Manage accounting purpose codes for transactions</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Purpose
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
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
        <div className="mb-6">
          <AccountingPurposeFilters
            onSearch={handleSearch}
            onFilter={handleFilter}
            loading={loading}
          />
        </div>

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
          <div className="flex justify-center items-center gap-2 mt-6">
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
    </div>
  )
}