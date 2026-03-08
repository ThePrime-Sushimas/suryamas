import type { AccountingPurpose } from '../types/accounting-purpose.types'
import { AppliedToBadge } from './AppliedToBadge'
import { SystemLockBadge } from './SystemLockBadge'

interface AccountingPurposeTableProps {
  purposes: AccountingPurpose[]
  selectedIds: string[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  loading?: boolean
}

export const AccountingPurposeTable = ({ 
  purposes, 
  selectedIds,
  onView, 
  onEdit, 
  onDelete,
  onRestore,
  onToggleSelect,
  onToggleSelectAll,
  loading 
}: AccountingPurposeTableProps) => {

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-t-lg"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700"></div>
          ))}
        </div>
      </div>
    )
  }

  if (purposes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="text-gray-400 dark:text-gray-500 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Accounting Purposes</h3>
        <p className="text-gray-600 dark:text-gray-400">Get started by creating your first accounting purpose.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.length === purposes.length && purposes.length > 0}
                  onChange={onToggleSelectAll}
                  className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-500"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Purpose
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Applied To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {purposes.map((purpose) => (
              <tr 
                key={purpose.id} 
                className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                  selectedIds.includes(purpose.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                } ${
                  purpose.is_deleted ? 'bg-red-50 dark:bg-red-900/20' : ''
                }`}
                onClick={() => onView(purpose.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(purpose.id)}
                    onChange={() => onToggleSelect(purpose.id)}
                    className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {purpose.purpose_name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {purpose.purpose_code}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <AppliedToBadge appliedTo={purpose.applied_to} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      purpose.is_active 
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}>
                      {purpose.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {purpose.is_deleted && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                        Deleted
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SystemLockBadge isSystem={purpose.is_system} />
                  {!purpose.is_system && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">Custom</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {new Date(purpose.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                  {purpose.is_deleted ? (
                    <button
                      onClick={() => onRestore(purpose.id)}
                      className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                    >
                      Restore
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(purpose.id)}
                        disabled={purpose.is_system}
                        className={`${
                          purpose.is_system
                            ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                        }`}
                        title={purpose.is_system ? 'System purposes cannot be edited' : ''}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(purpose.id)}
                        disabled={purpose.is_system}
                        className={`${
                          purpose.is_system
                            ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
                        }`}
                        title={purpose.is_system ? 'System purposes cannot be deleted' : ''}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

