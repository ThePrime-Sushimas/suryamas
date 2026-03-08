import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountingPurposeAccountsStore } from '../store/accountingPurposeAccounts.store'
import { AccountingPurposeAccountFilters } from '../components/AccountingPurposeAccountFilters'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContext } from '@/features/branch_context/hooks/useBranchContext'
import type { AccountingPurposeAccountFilter, AccountingPurposeAccountWithDetails } from '../types/accounting-purpose-account.types'
import { DEFAULT_PAGE_SIZE } from '../constants/accounting-purpose-account.constants'

export const AccountingPurposeAccountsDeletedPage = () => {
  const navigate = useNavigate()
  const { success, error } = useToast()
  const branchContext = useBranchContext()
  
  const {
    deletedAccounts,
    loading,
    error: storeError,
    deletedPagination,
    fetchDeletedAccounts,
    restoreAccount,
    clearError
  } = useAccountingPurposeAccountsStore()

  const [filter, setFilter] = useState<AccountingPurposeAccountFilter>({})
  const [sort] = useState<{ field: string; order: 'asc' | 'desc' }>({ field: 'deleted_at', order: 'desc' })
  
  // Restore modal state
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false)
  const [accountToRestore, setAccountToRestore] = useState<AccountingPurposeAccountWithDetails | null>(null)

  useEffect(() => {
    if (branchContext?.company_id) {
      fetchDeletedAccounts(1, DEFAULT_PAGE_SIZE, sort, filter)
    }
  }, [branchContext?.company_id, fetchDeletedAccounts, sort, filter])

  useEffect(() => {
    if (storeError) {
      error(storeError.message)
      clearError()
    }
  }, [storeError, error, clearError])

  const handlePageChange = useCallback((page: number) => {
    fetchDeletedAccounts(page, deletedPagination.limit, sort, filter)
  }, [fetchDeletedAccounts, deletedPagination.limit, sort, filter])

  const handleLimitChange = useCallback((newLimit: number) => {
    fetchDeletedAccounts(1, newLimit, sort, filter)
  }, [fetchDeletedAccounts, sort, filter])

  const handleFilterChange = useCallback((newFilter: AccountingPurposeAccountFilter) => {
    setFilter(newFilter)
    fetchDeletedAccounts(1, deletedPagination.limit, sort, newFilter)
  }, [fetchDeletedAccounts, deletedPagination.limit, sort])

  const handleRestore = useCallback((account: AccountingPurposeAccountWithDetails) => {
    setAccountToRestore(account)
    setIsRestoreModalOpen(true)
  }, [])

  const handleConfirmRestore = async () => {
    if (!accountToRestore) return
    
    try {
      await restoreAccount(accountToRestore.id)
      success('Account mapping restored successfully')
    } catch (err) {
      console.error('Restore error:', err)
      error('Failed to restore account mapping')
    } finally {
      setIsRestoreModalOpen(false)
      setAccountToRestore(null)
    }
  }

  const handleCloseRestoreModal = () => {
    setIsRestoreModalOpen(false)
    setAccountToRestore(null)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Deleted Purpose Account Mappings
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and restore deleted account mappings
            </p>
          </div>

          <button
            onClick={() => navigate('/accounting-purpose-accounts')}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Back to Active
          </button>
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
          {loading.list ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          ) : deletedAccounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">No deleted records found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Purpose</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Account</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Side</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deleted At</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {deletedAccounts.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{account.purpose_code}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{account.purpose_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{account.account_code}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{account.account_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          account.side === 'DEBIT' 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {account.side}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{account.priority}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {account.deleted_at ? new Date(account.deleted_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleRestore(account)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Global Pagination Component */}
        {deletedPagination.total > 0 && (
          <Pagination
            pagination={{
              page: deletedPagination.page,
              limit: deletedPagination.limit,
              total: deletedPagination.total,
              totalPages: deletedPagination.totalPages,
              hasNext: deletedPagination.page < deletedPagination.totalPages,
              hasPrev: deletedPagination.page > 1
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            currentLength={deletedAccounts.length}
            loading={loading.list}
          />
        )}
      </div>

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={isRestoreModalOpen}
        onClose={handleCloseRestoreModal}
        onConfirm={handleConfirmRestore}
        title="Restore Account Mapping"
        message={`Are you sure you want to restore the mapping for ${accountToRestore?.account_code}?`}
        confirmText="Restore"
        cancelText="Cancel"
        variant="success"
      />
    </div>
  )
}
