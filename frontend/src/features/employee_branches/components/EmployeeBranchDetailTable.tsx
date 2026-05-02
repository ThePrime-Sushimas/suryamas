import { TableSkeleton } from '@/components/ui/Skeleton'
import { useMemo, useState } from 'react'
import { Edit, Trash2, Pause, Star, Building2, AlertCircle } from 'lucide-react'
import type { EmployeeBranch } from '../api/types'

interface Props {
  branches: EmployeeBranch[]
  onEdit: (branch: EmployeeBranch) => void
  onDelete: (branch: EmployeeBranch) => void
  onSuspend: (branch: EmployeeBranch) => void
  onActivate: (branch: EmployeeBranch) => void
  loading?: boolean
}

export const EmployeeBranchDetailTable = ({ branches, onEdit, onDelete, onSuspend, onActivate, loading }: Props) => {
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'suspend' | 'activate', branch: EmployeeBranch } | null>(null)

  const sortedBranches = useMemo(() => {
    return [...branches].sort((a, b) => {
      if (a.is_primary) return -1
      if (b.is_primary) return 1
      return a.branch_name.localeCompare(b.branch_name)
    })
  }, [branches])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      suspended: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
      inactive: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      closed: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
    }
    return styles[status] || styles.inactive
  }

  const handleConfirmAction = () => {
    if (!confirmAction) return
    if (confirmAction.type === 'delete') onDelete(confirmAction.branch)
    else if (confirmAction.type === 'suspend') onSuspend(confirmAction.branch)
    else if (confirmAction.type === 'activate') onActivate(confirmAction.branch)
    setConfirmAction(null)
  }

  if (loading) return <TableSkeleton rows={5} columns={6} />

  if (branches.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
          <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">No branch assignments found</p>
        <p className="text-gray-500 dark:text-gray-500 text-sm">Click "Assign Branch" to get started</p>
      </div>
    )
  }

  return (
    <>
    {/* Mobile: card layout, Desktop: table */}
    {/* Desktop table */}
    <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Branch</th>
            <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Role</th>
            <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Approval Limit</th>
            <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Primary</th>
            <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
            <th className="px-4 lg:px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          {sortedBranches.map((branch, index) => (
            <tr key={branch.id} className={`hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${
              branch.is_primary ? 'bg-blue-50/30 dark:bg-blue-900/10' : index % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/30'
            }`}>
              <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    branch.is_primary ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Building2 className={`h-5 w-5 ${branch.is_primary ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{branch.branch_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{branch.branch_code}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400">
                  {branch.role_name}
                </span>
              </td>
              <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(branch.approval_limit)}</div>
              </td>
              <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                {branch.is_primary && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-linear-to-r from-blue-500 to-blue-600 text-white shadow-md">
                    <Star className="h-3.5 w-3.5 fill-current" /> Primary
                  </span>
                )}
              </td>
              <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(branch.status)}`}>
                  {branch.status.charAt(0).toUpperCase() + branch.status.slice(1)}
                </span>
              </td>
              <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onEdit(branch)} className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Edit"><Edit className="h-4 w-4" /></button>
                  {branch.status === 'active' && !branch.is_primary && (
                    <button onClick={() => setConfirmAction({ type: 'suspend', branch })} className="p-2 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg transition-all" title="Suspend"><Pause className="h-4 w-4" /></button>
                  )}
                  {branch.status === 'suspended' && (
                    <button onClick={() => setConfirmAction({ type: 'activate', branch })} className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-all" title="Activate"><Star className="h-4 w-4" /></button>
                  )}
                  {!branch.is_primary && (
                    <button onClick={() => setConfirmAction({ type: 'delete', branch })} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Mobile: card layout */}
    <div className="md:hidden space-y-3">
      {sortedBranches.map((branch) => (
        <div key={branch.id} className={`rounded-xl border p-4 ${
          branch.is_primary
            ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                branch.is_primary ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <Building2 className={`h-4 w-4 ${branch.is_primary ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{branch.branch_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{branch.branch_code}</p>
              </div>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${getStatusBadge(branch.status)}`}>
              {branch.status.charAt(0).toUpperCase() + branch.status.slice(1)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400">{branch.role_name}</span>
            {branch.is_primary && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white">
                <Star className="h-3 w-3 fill-current" /> Primary
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{formatCurrency(branch.approval_limit)}</p>
          <div className="flex items-center gap-1 border-t border-gray-100 dark:border-gray-700 pt-3">
            <button onClick={() => onEdit(branch)} className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-xs font-medium flex items-center gap-1"><Edit className="h-3.5 w-3.5" /> Edit</button>
            {branch.status === 'active' && !branch.is_primary && (
              <button onClick={() => setConfirmAction({ type: 'suspend', branch })} className="p-2 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg text-xs font-medium flex items-center gap-1"><Pause className="h-3.5 w-3.5" /> Suspend</button>
            )}
            {branch.status === 'suspended' && (
              <button onClick={() => setConfirmAction({ type: 'activate', branch })} className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg text-xs font-medium flex items-center gap-1"><Star className="h-3.5 w-3.5" /> Activate</button>
            )}
            {!branch.is_primary && (
              <button onClick={() => setConfirmAction({ type: 'delete', branch })} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-xs font-medium flex items-center gap-1 ml-auto"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            )}
          </div>
        </div>
      ))}
    </div>

    {/* Confirm Modal */}
    {confirmAction && (
      <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={() => setConfirmAction(null)}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                confirmAction.type === 'delete' ? 'bg-red-100 dark:bg-red-900/30' : confirmAction.type === 'suspend' ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-green-100 dark:bg-green-900/30'
              }`}>
                <AlertCircle className={`h-6 w-6 ${
                  confirmAction.type === 'delete' ? 'text-red-600' : confirmAction.type === 'suspend' ? 'text-yellow-600' : 'text-green-600'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  {confirmAction.type === 'delete' ? 'Remove Branch Access?' : 
                   confirmAction.type === 'suspend' ? 'Suspend Branch Access?' : 'Activate Branch Access?'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">This action will affect employee permissions</p>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Employee will {confirmAction.type === 'activate' ? 'regain' : 'lose'}:
              </p>
              <ul className="space-y-2">
                {['Transaction access', 'Approval rights', 'Branch visibility'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className={`w-1.5 h-1.5 rounded-full ${confirmAction.type === 'activate' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    {item}
                  </li>
                ))}
              </ul>
              {confirmAction.type === 'suspend' && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 font-medium">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    History will be kept
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmAction} className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all shadow-lg ${
                confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700'
                : confirmAction.type === 'suspend' ? 'bg-yellow-600 hover:bg-yellow-700'
                : 'bg-green-600 hover:bg-green-700'
              }`}>
                {confirmAction.type === 'delete' ? 'Remove' : confirmAction.type === 'suspend' ? 'Suspend' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
