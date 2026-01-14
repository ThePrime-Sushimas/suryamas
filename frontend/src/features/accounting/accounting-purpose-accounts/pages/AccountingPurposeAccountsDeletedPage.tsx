import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccountingPurposeAccountsStore } from '../store/accountingPurposeAccounts.store'
import { AccountingPurposeAccountFilters } from '../components/AccountingPurposeAccountFilters'
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

  const handleFilterChange = useCallback((newFilter: AccountingPurposeAccountFilter) => {
    setFilter(newFilter)
    fetchDeletedAccounts(1, deletedPagination.limit, sort, newFilter)
  }, [fetchDeletedAccounts, deletedPagination.limit, sort])

  const handleRestore = useCallback(async (account: AccountingPurposeAccountWithDetails) => {
    if (confirm(`Restore mapping for ${account.account_code}?`)) {
      try {
        await restoreAccount(account.id)
        success('Account mapping restored successfully')
        fetchDeletedAccounts(deletedPagination.page, deletedPagination.limit, sort, filter)
      } catch (err) {
        console.error('Restore error:', err)
        error('Failed to restore account mapping')
      }
    }
  }, [restoreAccount, success, error, fetchDeletedAccounts, deletedPagination, sort, filter])

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Deleted Purpose Account Mappings
            </h1>
            <p className="text-sm text-gray-500">
              View and restore deleted account mappings
            </p>
          </div>

          <button
            onClick={() => navigate('/accounting-purpose-accounts')}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back to Active
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <AccountingPurposeAccountFilters
          filter={filter}
          onFilterChange={handleFilterChange}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading.list ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : deletedAccounts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No deleted records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Side</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deleted At</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deletedAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{account.purpose_code}</div>
                      <div className="text-sm text-gray-500">{account.purpose_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{account.account_code}</div>
                      <div className="text-sm text-gray-500">{account.account_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        account.side === 'DEBIT' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {account.side}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{account.priority}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {account.deleted_at ? new Date(account.deleted_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleRestore(account)}
                        className="text-blue-600 hover:text-blue-900"
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

      {deletedPagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-sm text-gray-600">
            Showing {((deletedPagination.page - 1) * deletedPagination.limit) + 1}
            {' '}to{' '}
            {Math.min(deletedPagination.page * deletedPagination.limit, deletedPagination.total)}
            {' '}of{' '}
            {deletedPagination.total} results
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(deletedPagination.page - 1)}
              disabled={deletedPagination.page === 1}
              className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>

            <span className="px-3 py-1.5 text-sm text-gray-700">
              Page {deletedPagination.page} of {deletedPagination.totalPages}
            </span>

            <button
              onClick={() => handlePageChange(deletedPagination.page + 1)}
              disabled={deletedPagination.page === deletedPagination.totalPages}
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
