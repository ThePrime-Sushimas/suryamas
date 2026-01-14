import { useEffect, useState } from 'react'
import { Plus, Trash2, RotateCcw } from 'lucide-react'
import { useAccountingPurposesStore } from '../store/accountingPurposes.store'
import { AccountingPurposeTable } from '../components/AccountingPurposeTable'
import { AccountingPurposeFilters } from '../components/AccountingPurposeFilters'
import type { FilterParams } from '../types/accounting-purpose.types'

interface AccountingPurposesListPageProps {
  onCreateNew: () => void
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
}

export const AccountingPurposesListPage = ({
  onCreateNew,
  onView,
  onEdit,
  onDelete,
  onRestore
}: AccountingPurposesListPageProps) => {
  const {
    purposes,
    selectedIds,
    loading,
    error,
    pagination,
    fetchPurposes,
    searchPurposes,
    setFilter,
    bulkDelete,
    bulkRestore,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    clearError
  } = useAccountingPurposesStore()

  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = useState(false)

  useEffect(() => {
    fetchPurposes(1, 25)
  }, [fetchPurposes])

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

  const handleBulkDelete = async () => {
    try {
      await bulkDelete(selectedIds)
      setShowBulkDeleteConfirm(false)
    } catch (error) {
      console.error('Bulk delete failed:', error)
    }
  }

  const handleBulkRestore = async () => {
    try {
      await bulkRestore(selectedIds)
      setShowBulkRestoreConfirm(false)
    } catch (error) {
      console.error('Bulk restore failed:', error)
    }
  }

  const hasDeletedSelected = selectedIds.some(id => 
    purposes.find(p => p.id === id)?.is_deleted
  )

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

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedIds.length} item(s) selected
            </span>
            <div className="flex gap-2">
              {hasDeletedSelected ? (
                <button
                  onClick={() => setShowBulkRestoreConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <RotateCcw size={16} />
                  Restore Selected
                </button>
              ) : (
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 size={16} />
                  Delete Selected
                </button>
              )}
              <button
                onClick={clearSelection}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <AccountingPurposeTable
          purposes={purposes}
          selectedIds={selectedIds}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
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

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Bulk Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedIds.length} item(s)?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Restore Confirmation Modal */}
      {showBulkRestoreConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Bulk Restore</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to restore {selectedIds.length} item(s)?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBulkRestoreConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkRestore}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}