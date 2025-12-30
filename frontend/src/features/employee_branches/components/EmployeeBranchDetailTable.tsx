import { useMemo, useState } from 'react'
import { Edit, Trash2, Pause, Star, Building2, AlertCircle } from 'lucide-react'
import type { EmployeeBranch } from '../api/types'

interface Props {
  branches: EmployeeBranch[]
  onEdit: (branch: EmployeeBranch) => void
  onDelete: (branch: EmployeeBranch) => void
  onSuspend: (branch: EmployeeBranch) => void
}

export const EmployeeBranchDetailTable = ({ branches, onEdit, onDelete, onSuspend }: Props) => {
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'suspend', branch: EmployeeBranch } | null>(null)

  const sortedBranches = useMemo(() => {
    return [...branches].sort((a, b) => {
      if (a.is_primary) return -1
      if (b.is_primary) return 1
      return a.branch_name.localeCompare(b.branch_name)
    })
  }, [branches])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800',
    }
    return styles[status as keyof typeof styles] || styles.inactive
  }

  const handleConfirmAction = () => {
    if (!confirmAction) return
    if (confirmAction.type === 'delete') {
      onDelete(confirmAction.branch)
    } else {
      onSuspend(confirmAction.branch)
    }
    setConfirmAction(null)
  }

  if (branches.length === 0) {
    return (
      <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-dashed border-gray-300">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Building2 className="h-8 w-8 text-blue-600" />
        </div>
        <p className="text-gray-600 font-medium mb-2">No branch assignments found</p>
        <p className="text-gray-500 text-sm">Click "Assign Branch" to get started</p>
      </div>
    )
  }

  return (
    <>
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Branch</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Role</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Approval Limit</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Primary</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {sortedBranches.map((branch, index) => (
            <tr key={branch.id} className={`hover:bg-blue-50/50 transition-colors ${
              branch.is_primary ? 'bg-blue-50/30' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
            }`}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    branch.is_primary ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Building2 className={`h-5 w-5 ${
                      branch.is_primary ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{branch.branch_name}</div>
                    <div className="text-xs text-gray-500">{branch.branch_code}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {branch.role_name}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-semibold text-gray-900">{formatCurrency(branch.approval_limit)}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {branch.is_primary && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    Primary
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(branch.status)}`}>
                  {branch.status.charAt(0).toUpperCase() + branch.status.slice(1)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-1">
                  <button 
                    onClick={() => onEdit(branch)} 
                    className="inline-flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all font-medium" 
                    aria-label={`Edit ${branch.branch_name}`}
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  {branch.status === 'active' && !branch.is_primary && (
                    <button 
                      onClick={() => setConfirmAction({ type: 'suspend', branch })} 
                      className="inline-flex items-center gap-1 px-3 py-2 text-yellow-600 hover:bg-yellow-100 rounded-lg transition-all font-medium" 
                      aria-label={`Suspend ${branch.branch_name}`}
                      title="Suspend"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  )}
                  {!branch.is_primary && (
                    <button 
                      onClick={() => setConfirmAction({ type: 'delete', branch })} 
                      className="inline-flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-100 rounded-lg transition-all font-medium" 
                      aria-label={`Delete ${branch.branch_name}`}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Confirm Modal */}
    {confirmAction && (
      <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setConfirmAction(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
            <div className="flex items-start gap-4 mb-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                confirmAction.type === 'delete' ? 'bg-red-100' : 'bg-yellow-100'
              }`}>
                <AlertCircle className={`h-6 w-6 ${
                  confirmAction.type === 'delete' ? 'text-red-600' : 'text-yellow-600'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {confirmAction.type === 'delete' ? 'Remove Branch Access?' : 'Suspend Branch Access?'}
                </h3>
                <p className="text-sm text-gray-600">This action will affect employee permissions</p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Employee will lose:</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  Transaction access
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  Approval rights
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  Branch visibility
                </li>
              </ul>
              {confirmAction.type === 'suspend' && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    History will be kept
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all shadow-lg hover:shadow-xl ${
                  confirmAction.type === 'delete' 
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' 
                    : 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800'
                }`}
              >
                {confirmAction.type === 'delete' ? 'Remove' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
