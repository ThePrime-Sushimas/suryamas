import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountingPurposeAccountsStore } from '../store/accountingPurposeAccounts.store'
import { AccountingPurposeAccountTable } from '../components/AccountingPurposeAccountTable'
import { AccountingPurposeAccountFilters } from '../components/AccountingPurposeAccountFilters'
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

  const handleDelete = useCallback(async (account: AccountingPurposeAccountWithDetails) => {
    if (confirm(`Delete mapping for ${account.account_code}?`)) {
      try {
        await deleteAccount(account.id)
        success('Account mapping deleted successfully')
      } catch (err) {
        console.error('Delete error:', err)
        error('Failed to delete account mapping')
      }
    }
  }, [deleteAccount, success, error])

  const handleBulkAction = useCallback(async (action: 'activate' | 'deactivate' | 'delete', ids: string[]) => {
    try {
      if (action === 'delete') {
        if (confirm(`Delete ${ids.length} account mappings?`)) {
          await Promise.all(ids.map(id => deleteAccount(id)))
          success(`${ids.length} account mappings deleted`)
        }
      } else {
        await bulkUpdateStatus(ids, action === 'activate')
        success(`${ids.length} account mappings ${action}d`)
      }
    } catch (err) {
      console.error('Bulk action error:', err)
      error(`Failed to ${action} account mappings`)
    }
  }, [deleteAccount, bulkUpdateStatus, success, error])



  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Purpose Account Mappings
            </h1>
            <p className="text-sm text-gray-500">
              Manage accounting purpose to account mappings
            </p>
          </div>

          <div className="flex gap-2 mt-4 sm:mt-0">
            <button
              onClick={() => navigate('/accounting-purpose-accounts/deleted')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <AccountingPurposeAccountFilters
          filter={filter}
          onFilterChange={handleFilterChange}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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

      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1}
            {' '}to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)}
            {' '}of{' '}
            {pagination.total} results
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>

            <span className="px-3 py-1.5 text-sm text-gray-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}