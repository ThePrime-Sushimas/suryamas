import { useMemo } from 'react'
import type { AccountingPurposeAccountWithDetails } from '../types/accounting-purpose-account.types'
import { SideBadge } from './SideBadge'
import { PriorityBadge } from './PriorityBadge'
import { useBulkSelection } from '@/hooks/_shared/useBulkSelection'

interface AccountingPurposeAccountTableProps {
  accounts: AccountingPurposeAccountWithDetails[]
  loading: boolean
  onEdit: (account: AccountingPurposeAccountWithDetails) => void
  onDelete: (account: AccountingPurposeAccountWithDetails) => void
  onSort: (field: string) => void
  sortField?: string
  sortOrder?: 'asc' | 'desc'
  onBulkAction?: (action: 'activate' | 'deactivate' | 'delete', ids: string[]) => void
}

export const AccountingPurposeAccountTable = ({
  accounts,
  loading,
  onEdit,
  onDelete,
  onSort,
  sortField,
  sortOrder,
  onBulkAction
}: AccountingPurposeAccountTableProps) => {
  const {
    selectedIds,
    selectAll,
    selectOne,
    isSelected,
    isAllSelected,
    selectedCount,
    clearSelection
  } = useBulkSelection(accounts)

  const sortableColumns = useMemo(() => ({
    priority: 'Priority',
    side: 'Side',
    created_at: 'Created',
    updated_at: 'Updated'
  }), [])

  const getSortIcon = (field: string) => {
    if (sortField !== field) return '↕️'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  const handleBulkAction = (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedCount > 0 && onBulkAction) {
      onBulkAction(action, selectedIds)
      clearSelection()
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded mb-2"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {selectedCount > 0 && onBulkAction && (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <span className="text-sm text-blue-700 dark:text-blue-400">
            {selectedCount} item(s) selected
          </span>
          <div className="space-x-2">
            <button
              onClick={() => handleBulkAction('activate')}
              className="px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded hover:bg-green-200 dark:hover:bg-green-900/50"
            >
              Activate
            </button>
            <button
              onClick={() => handleBulkAction('deactivate')}
              className="px-3 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
            >
              Deactivate
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="px-3 py-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => selectAll(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Purpose
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Account
              </th>
              {Object.entries(sortableColumns).map(([field, label]) => (
                <th
                  key={field}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => onSort(field)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{label}</span>
                    <span className="text-gray-400">{getSortIcon(field)}</span>
                  </div>
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={isSelected(account.id)}
                    onChange={(e) => selectOne(account.id, e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {account.purpose_code}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {account.purpose_name}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {account.account_code}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {account.account_name}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {account.account_type} • {account.normal_balance}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <PriorityBadge priority={account.priority} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SideBadge side={account.side} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {account.created_at ? new Date(account.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {account.updated_at ? new Date(account.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    account.is_active 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => onEdit(account)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(account)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">No purpose account mappings found</div>
        </div>
      )}
    </div>
  )
}
