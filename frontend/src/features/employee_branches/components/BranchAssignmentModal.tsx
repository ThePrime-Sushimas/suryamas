import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { EmployeeBranch, CreateEmployeeBranchDTO, UpdateEmployeeBranchDTO, Role, BranchOption } from '../api/types'
import { EmployeeBranchDetailForm } from './EmployeeBranchDetailForm'

interface Props {
  isOpen: boolean
  employeeId: string
  assignment?: EmployeeBranch
  assignedBranchIds: string[]
  roles: Role[]
  branches: BranchOption[]
  onSubmit: (data: CreateEmployeeBranchDTO | UpdateEmployeeBranchDTO) => Promise<void>
  onClose: () => void
  hasPrimaryBranch: boolean
  isLoadingOptions?: boolean
}

export const BranchAssignmentModal = ({ isOpen, employeeId, assignment, assignedBranchIds, roles, branches, onSubmit, onClose, hasPrimaryBranch, isLoadingOptions = false }: Props) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={onClose}></div>
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full z-10">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {assignment ? 'Edit Branch Assignment' : 'Assign Branch to Employee'}
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="Close">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {!isLoadingOptions && hasPrimaryBranch && !assignment?.is_primary && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-400">
                  <p className="font-semibold">Only one primary branch allowed</p>
                  <p className="text-yellow-700 dark:text-yellow-500 mt-1">Changing primary affects approvals and ownership</p>
                </div>
              </div>
            )}
            
            {isLoadingOptions ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Loading options...</p>
              </div>
            ) : (
              <EmployeeBranchDetailForm 
                employeeId={employeeId} 
                assignment={assignment} 
                assignedBranchIds={assignedBranchIds} 
                roles={roles} 
                branches={branches} 
                onSubmit={onSubmit} 
                onCancel={onClose} 
                hasPrimaryBranch={hasPrimaryBranch} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
