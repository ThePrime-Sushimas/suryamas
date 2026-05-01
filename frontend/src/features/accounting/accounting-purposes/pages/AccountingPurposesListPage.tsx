import { useEffect, useState } from 'react'
import { Plus, Trash2, RotateCcw } from 'lucide-react'
import { useAccountingPurposesStore } from '../store/accountingPurposes.store'
import { AccountingPurposeTable } from '../components/AccountingPurposeTable'
import { AccountingPurposeFilters } from '../components/AccountingPurposeFilters'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
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
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

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

  const handleLimitChange = (limit: number) => {
    fetchPurposes(1, limit)
  }

  const handleBulkDelete = async () => {
    setIsBulkProcessing(true)
    try {
      await bulkDelete(selectedIds)
      setShowBulkDeleteConfirm(false)
    } catch (error) {
      console.error('Bulk delete failed:', error)
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handleBulkRestore = async () => {
    setIsBulkProcessing(true)
    try {
      await bulkRestore(selectedIds)
      setShowBulkRestoreConfirm(false)
    } catch (error) {
      console.error('Bulk restore failed:', error)
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const hasDeletedSelected = selectedIds.some(id => 
    purposes.find(p => p.id === id)?.is_deleted
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Accounting Purposes</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage accounting purpose codes for transactions</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
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
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <p className="text-red-800 dark:text-red-300">{error}</p>
              <button
                onClick={clearError}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
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
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-sm text-blue-800 dark:text-blue-300">
              {selectedIds.length} item(s) selected
            </span>
            <div className="flex gap-2">
              {hasDeletedSelected ? (
                <button
                  onClick={() => setShowBulkRestoreConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-800"
                >
                  <RotateCcw size={16} />
                  Restore Selected
                </button>
              ) : (
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800"
                >
                  <Trash2 size={16} />
                  Delete Selected
                </button>
              )}
              <button
                onClick={clearSelection}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
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
          <div className="mt-6">
            <Pagination
              pagination={{
                page: pagination.page,
                limit: pagination.limit,
                total: pagination.total,
                totalPages: pagination.totalPages,
                hasNext: pagination.hasNext,
                hasPrev: pagination.hasPrev
              }}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              loading={loading}
            />
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Confirm Bulk Delete"
        message={`Are you sure you want to delete ${selectedIds.length} item(s)?`}
        confirmText={isBulkProcessing ? 'Deleting...' : 'Delete'}
        variant="danger"
        isLoading={isBulkProcessing}
      />

      {/* Bulk Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkRestoreConfirm}
        onClose={() => setShowBulkRestoreConfirm(false)}
        onConfirm={handleBulkRestore}
        title="Confirm Bulk Restore"
        message={`Are you sure you want to restore ${selectedIds.length} item(s)?`}
        confirmText={isBulkProcessing ? 'Restoring...' : 'Restore'}
        variant="success"
        isLoading={isBulkProcessing}
      />
    </div>
  )
}
