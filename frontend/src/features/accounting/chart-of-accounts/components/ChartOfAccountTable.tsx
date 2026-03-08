import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Eye, Edit, Trash2, MoreVertical, Plus, RotateCcw } from 'lucide-react'
import type { ChartOfAccount } from '../types/chart-of-account.types'
import { AccountTypeBadge } from './AccountTypeBadge'
import { buildAccountDisplayName } from '../utils/format'

interface ChartOfAccountTableProps {
  accounts: ChartOfAccount[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRestore?: (id: string) => void
  onAddChild?: (parentId: string) => void
  canEdit?: boolean
  canDelete?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
}

export const ChartOfAccountTable = ({
  accounts,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onAddChild,
  canEdit = true,
  canDelete = true,
  selectedIds = [],
  onSelectionChange
}: ChartOfAccountTableProps) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const loading = false

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return
    onSelectionChange(checked ? accounts.map(a => a.id) : [])
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (!onSelectionChange) return
    if (checked) {
      onSelectionChange([...selectedIds, id])
    } else {
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id))
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-t-lg"></div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-600"></div>
          ))}
        </div>
      </div>
    )
  }

  const ActionDropdown = ({ account }: { account: ChartOfAccount }) => {
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

    useEffect(() => {
      if (openDropdown === account.id && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.right - 192 + window.scrollX // 192px = w-48
        })
      }
    }, [account.id])

    const dropdown = openDropdown === account.id ? (
      <div 
        className="fixed w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50"
        style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
      >
        <div className="py-1">
          <button
            onClick={() => {
              onView(account.id)
              setOpenDropdown(null)
            }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Eye className="w-4 h-4" />
            View Details
          </button>
          {canEdit && (
            <button
              onClick={() => {
                onEdit(account.id)
                setOpenDropdown(null)
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          {onAddChild && account.is_header && (
            <button
              onClick={() => {
                onAddChild(account.id)
                setOpenDropdown(null)
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Plus className="w-4 h-4" />
              Add Child Account
            </button>
          )}
          {account.deleted_at && onRestore ? (
            <button
              onClick={() => {
                onRestore(account.id)
                setOpenDropdown(null)
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
            >
              <RotateCcw className="w-4 h-4" />
              Restore
            </button>
          ) : (
            canDelete && (
              <button
                onClick={() => {
                  onDelete(account.id)
                  setOpenDropdown(null)
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )
          )}
        </div>
      </div>
    ) : null

    return (
      <>
        <button
          ref={buttonRef}
          onClick={() => setOpenDropdown(openDropdown === account.id ? null : account.id)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        {dropdown && createPortal(dropdown, document.body)}
        {openDropdown === account.id && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setOpenDropdown(null)}
          />
        )}
      </>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              {onSelectionChange && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === accounts.length && accounts.length > 0}
                    onChange={e => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
              )}
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Account</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Subtype</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Header</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Postable</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Currency</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">Status</th>
              <th className="w-12 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {accounts.map(account => (
              <tr key={account.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${account.deleted_at ? 'bg-gray-50 dark:bg-gray-800/50 opacity-75' : ''}`}>
                {onSelectionChange && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(account.id)}
                      onChange={e => handleSelectOne(account.id, e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div style={{ paddingLeft: `${account.level * 20}px` }}>
                    <div className={`text-sm ${account.is_header ? 'font-bold' : ''} ${!account.is_postable ? 'italic' : ''} text-gray-900 dark:text-white`}>
                      {buildAccountDisplayName(account.account_code, account.account_name)}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <AccountTypeBadge type={account.account_type} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {account.account_subtype || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {account.is_header ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      Yes
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {account.is_postable ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                      Yes
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {account.currency_code}
                </td>
                <td className="px-4 py-3 text-center">
                  {account.deleted_at ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                      Deleted
                    </span>
                  ) : (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      account.is_active 
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ActionDropdown account={account} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      
      {accounts.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No accounts found
        </div>
      )}
    </div>
  )
}
