import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountingPurposeAccountsStore } from '../store/accountingPurposeAccounts.store'
import { AccountingPurposeAccountTable } from '../components/AccountingPurposeAccountTable'
import { AccountingPurposeAccountFilters } from '../components/AccountingPurposeAccountFilters'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import ExportButton from '@/components/ExportButton'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContext } from '@/features/branch_context/hooks/useBranchContext'
import type { AccountingPurposeAccountFilter, AccountingPurposeAccountWithDetails } from '../types/accounting-purpose-account.types'
import { DEFAULT_PAGE_SIZE } from '../constants/accounting-purpose-account.constants'

export const AccountingPurposeAccountsListPage = () => {
  const navigate = useNavigate()
  const { success, error } = useToast()
  const branchContext = useBranchContext()
  
  const {
    accounts,
    loading,
    error: storeError,
    pagination,
    fetchAccounts,
    deleteAccount,
    bulkUpdateStatus,
    fetchPostableAccounts,
    fetchActivePurposes,
    clearError
  } = useAccountingPurposeAccountsStore()

  const [filter, setFilter] = useState<AccountingPurposeAccountFilter>({})
  const [sort, setSort] = useState<{ field: string; order: 'asc' | 'desc' }>({ field: 'priority', order: 'asc' })
  
  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<AccountingPurposeAccountWithDetails | null>(null)
  
  // Bulk delete modal state
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [bulkActionIds, setBulkActionIds] = useState<string[]>([])
  const [bulkActionType, setBulkActionType] = useState<'activate' | 'deactivate' | 'delete'>('delete')

  // Reload data when company changes
  useEffect(() => {
    if (branchContext?.company_id) {
      fetchPostableAccounts()
      fetchActivePurposes()
      fetchAccounts(1, DEFAULT_PAGE_SIZE, sort, filter)
    }
  }, [branchContext?.company_id, fetchPostableAccounts, fetchActivePurposes, fetchAccounts, sort, filter])

  useEffect(() => {
    if (storeError) {
      error(storeError.message)
      clearError()
    }
  }, [storeError, error, clearError])

  const handlePageChange = useCallback((page: number) => {
    fetchAccounts(page, pagination.limit, sort, filter)
  }, [fetchAccounts, pagination.limit, sort, filter])

  const handleLimitChange = useCallback((newLimit: number) => {
    fetchAccounts(1, newLimit, sort, filter)
  }, [fetchAccounts, sort, filter])

  const handleSort = useCallback((field: string) => {
    const newOrder: 'asc' | 'desc' = sort.field === field && sort.order === 'asc' ? 'desc' : 'asc'
    const newSort = { field, order: newOrder }
    setSort(newSort)
    fetchAccounts(pagination.page, pagination.limit, newSort, filter)
  }, [sort, fetchAccounts, pagination, filter])

  const handleFilterChange = useCallback((newFilter: AccountingPurposeAccountFilter) => {
    setFilter(newFilter)
    fetchAccounts(1, pagination.limit, sort, newFilter)
  }, [fetchAccounts, pagination.limit, sort])

  const handleEdit = useCallback((account: AccountingPurposeAccountWithDetails) => {
    navigate(`/accounting-purpose-accounts/${account.id}/edit`)
  }, [navigate])

  const handleDelete = useCallback((account: AccountingPurposeAccountWithDetails) => {
    setAccountToDelete(account)
    setIsDeleteModalOpen(true)
  }, [])

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return
    
    try {
      await deleteAccount(accountToDelete.id)
      success('Account mapping deleted successfully')
    } catch (err) {
      console.error('Delete error:', err)
      error('Failed to delete account mapping')
    } finally {
      setIsDeleteModalOpen(false)
      setAccountToDelete(null)
    }
  }

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setAccountToDelete(null)
  }

  const handleBulkAction = useCallback((action: 'activate' | 'deactivate' | 'delete', ids: string[]) => {
    setBulkActionIds(ids)
    setBulkActionType(action)
    if (action === 'delete') {
      setIsBulkDeleteModalOpen(true)
    }
  }, [])

  const handleConfirmBulkAction = async () => {
    try {
      if (bulkActionType === 'delete') {
        await Promise.all(bulkActionIds.map(id => deleteAccount(id)))
        success(`${bulkActionIds.length} account mappings deleted`)
      } else {
        await bulkUpdateStatus(bulkActionIds, bulkActionType === 'activate')
        success(`${bulkActionIds.length} account mappings ${bulkActionType}d`)
      }
    } catch (err) {
      console.error('Bulk action error:', err)
      error(`Failed to ${bulkActionType} account mappings`)
    } finally {
      setIsBulkDeleteModalOpen(false)
      setBulkActionIds([])
    }
  }

  const handleCloseBulkDeleteModal = () => {
    setIsBulkDeleteModalOpen(false)
    setBulkActionIds([])
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Purpose Account Mappings
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage accounting purpose to account mappings
            </p>
          </div>

          <div className="flex gap-2 mt-4 sm:mt-0">
            <button
              onClick={() => navigate('/accounting-purpose-accounts/deleted')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Show Deleted
            </button>
            <ExportButton
              endpoint="/accounting-purpose-accounts"
              filename="accounting-purpose-accounts"
              filter={filter as Record<string, string | number | boolean>}
            />
            <button
              onClick={() => navigate('/accounting-purpose-accounts/create')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Add Mapping
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <AccountingPurposeAccountFilters
          filter={filter}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <AccountingPurposeAccountTable
            accounts={accounts}
            loading={loading.list}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSort={handleSort}
            sortField={sort.field}
            sortOrder={sort.order}
            onBulkAction={handleBulkAction}
          />
        </div>

        {/* Global Pagination Component */}
        {pagination.total > 0 && (
          <Pagination
            pagination={{
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.total,
              totalPages: pagination.totalPages,
              hasNext: pagination.page < pagination.totalPages,
              hasPrev: pagination.page > 1
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            currentLength={accounts.length}
            loading={loading.list}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Delete Account Mapping"
        message={`Are you sure you want to delete the mapping for ${accountToDelete?.account_code}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={handleCloseBulkDeleteModal}
        onConfirm={handleConfirmBulkAction}
        title="Delete Multiple Account Mappings"
        message={`Are you sure you want to delete ${bulkActionIds.length} account mappings? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
