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
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-9999 overflow-y-auto" role="dialog" aria-modal="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50" onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}></div>
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full z-10" style={{ position: 'relative', zIndex: 10 }}>
          <div className="bg-white px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {assignment ? 'Edit Branch Assignment' : 'Assign Branch to Employee'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Warning for primary branch */}
            {!isLoadingOptions && hasPrimaryBranch && !assignment?.is_primary && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold">Only one primary branch allowed</p>
                  <p className="text-yellow-700 mt-1">Changing primary affects approvals and ownership</p>
                </div>
              </div>
            )}
            
            {isLoadingOptions ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                <p className="text-gray-600 font-medium">Loading options...</p>
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
