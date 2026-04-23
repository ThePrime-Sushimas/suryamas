import { useMemo } from 'react'
import type { AccountingPurposeAccountWithDetails } from '../types/accounting-purpose-account.types'
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

type GroupedAccounts = {
  purposeCode: string
  purposeName: string
  accounts: AccountingPurposeAccountWithDetails[]
}

export const AccountingPurposeAccountTable = ({
  accounts,
  loading,
  onEdit,
  onDelete,
  onBulkAction
}: AccountingPurposeAccountTableProps) => {
  const {
    selectedIds,
    selectOne,
    isSelected,
    selectedCount,
    clearSelection
  } = useBulkSelection(accounts)

  const groupedAccounts = useMemo(() => {
    const groups: GroupedAccounts[] = []
    const purposeMap = new Map<string, AccountingPurposeAccountWithDetails[]>()

    accounts.forEach((account) => {
      const purposeKey = account.purpose_code || 'UNKNOWN'
      if (!purposeMap.has(purposeKey)) {
        purposeMap.set(purposeKey, [])
      }
      purposeMap.get(purposeKey)!.push(account)
    })

    purposeMap.forEach((accs, purposeCode) => {
      const firstAccount = accs[0]
      groups.push({
        purposeCode,
        purposeName: firstAccount.purpose_name || 'Unknown Purpose',
        accounts: accs
      })
    })

    return groups.sort((a, b) => a.purposeCode.localeCompare(b.purposeCode))
  }, [accounts])



  const handleBulkAction = (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedCount > 0 && onBulkAction) {
      onBulkAction(action, selectedIds)
      clearSelection()
    }
  }

  const handleSelectAllInGroup = (groupAccounts: AccountingPurposeAccountWithDetails[], checked: boolean) => {
    groupAccounts.forEach(account => {
      selectOne(account.id, checked)
    })
  }

  const isAllSelectedInGroup = (groupAccounts: AccountingPurposeAccountWithDetails[]) => {
    return groupAccounts.every(account => isSelected(account.id))
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="h-8 bg-gray-300 dark:bg-gray-600"></div>
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-16 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"></div>
            ))}
          </div>
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

      {/* buku besar pembantu style - grouped by purpose */}
      <div className="space-y-6">
        {groupedAccounts.map((group) => (
          <div 
            key={group.purposeCode} 
            className="border-2 border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm"
          >
            {/* Purpose Header - Like a ledger page header */}
            <div className="bg-linear-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b-2 border-gray-300 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                    {group.purposeCode}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {group.purposeName}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Buku Besar Pembantu
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {group.accounts.length} akun
                  </div>
                </div>
              </div>
            </div>

            {/* Table Header - like journal header */}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelectedInGroup(group.accounts)}
                        onChange={(e) => handleSelectAllInGroup(group.accounts, e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                      />
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                      Kode Akun
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nama Akun
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                      Tipe
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                      Field Mapping
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                      Priority
                    </th>
                    {/* Debit/Kredit columns side by side - like journal */}
                    <th className="px-4 py-2 text-center text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider w-24 bg-blue-50 dark:bg-blue-900/20">
                      Debit
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider w-24 bg-green-50 dark:bg-green-900/20">
                      Kredit
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                      Status
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {group.accounts.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected(account.id)}
                          onChange={(e) => selectOne(account.id, e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                          {account.account_code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {account.account_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {account.account_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {account.field_mapping ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            {account.field_mapping}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          {account.priority}
                        </span>
                      </td>
                      {/* Side by side Debit/Kredit - like journal */}
                      <td className="px-4 py-3 whitespace-nowrap text-center bg-blue-50 dark:bg-blue-900/10">
                        {account.side === 'DEBIT' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold text-blue-600 dark:text-blue-400">
                            ✓
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center bg-green-50 dark:bg-green-900/10">
                        {account.side === 'CREDIT' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold text-green-600 dark:text-green-400">
                            ✓
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          account.is_active 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
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
                {/* Total row for each purpose group */}
                <tfoot className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-right text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">
                      Total Akun:
                    </td>
                    <td className="px-4 py-2 text-center text-xs font-bold text-blue-600 dark:text-blue-400">
                      {group.accounts.filter(a => a.side === 'DEBIT').length}
                    </td>
                    <td className="px-4 py-2 text-center text-xs font-bold text-green-600 dark:text-green-400">
                      {group.accounts.filter(a => a.side === 'CREDIT').length}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">No purpose account mappings found</div>
        </div>
      )}
    </div>
  )
}
