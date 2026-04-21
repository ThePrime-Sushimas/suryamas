import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Plus } from 'lucide-react'
import { usePermission } from '@/features/branch_context/hooks/usePermission'
import { useEmployeeBranchDetail } from '../hooks/useEmployeeBranchDetail'
import { employeeBranchesApi } from '../api/employeeBranches.api'
import { useToast } from '@/contexts/ToastContext'
import { EmployeeBranchDetailTable } from '../components/EmployeeBranchDetailTable'
import { BranchAssignmentModal } from '../components/BranchAssignmentModal'
import type { EmployeeBranch, CreateEmployeeBranchDTO, UpdateEmployeeBranchDTO, Role, BranchOption } from '../api/types'

export const EmployeeBranchDetailPage = () => {
  const { employeeId } = useParams<{ employeeId: string }>()
  const navigate = useNavigate()
  const { hasPermission, isLoading } = usePermission('employee_branches', 'update')
  const { branches, loading, error, fetchBranches, refetch } = useEmployeeBranchDetail(employeeId!)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<EmployeeBranch | undefined>()
  const [roles, setRoles] = useState<Role[]>([])
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([])
  const { success, error: showError } = useToast()

  useEffect(() => {
    if (employeeId) fetchBranches()
  }, [employeeId, fetchBranches])

  useEffect(() => {
    if (!isLoading && !hasPermission) navigate('/')
  }, [hasPermission, isLoading, navigate])

  const handleOpenModal = async (assignment?: EmployeeBranch) => {
    setEditingAssignment(assignment)
    setIsModalOpen(true)
    try {
      const [rolesData, branchesData] = await Promise.all([
        employeeBranchesApi.getRoles(),
        employeeBranchesApi.getBranches(),
      ])
      setRoles(rolesData)
      setBranchOptions(branchesData)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to load options')
      setIsModalOpen(false)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingAssignment(undefined)
    setRoles([])
    setBranchOptions([])
  }

  const handleSubmit = async (data: CreateEmployeeBranchDTO | UpdateEmployeeBranchDTO) => {
    try {
      if (editingAssignment) {
        await employeeBranchesApi.update(editingAssignment.id, data as UpdateEmployeeBranchDTO)
        success('Assignment updated successfully')
      } else {
        await employeeBranchesApi.create(data as CreateEmployeeBranchDTO)
        success('Assignment created successfully')
      }
      handleCloseModal()
      await refetch()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Operation failed')
      throw err
    }
  }

  const handleDelete = async (assignment: EmployeeBranch) => {
    try { await employeeBranchesApi.remove(assignment.id); success('Assignment deleted successfully'); refetch() }
    catch (err: unknown) { showError(err instanceof Error ? err.message : 'Failed to delete') }
  }

  const handleSuspend = async (assignment: EmployeeBranch) => {
    try { await employeeBranchesApi.suspend(assignment.id); success('Assignment suspended successfully'); refetch() }
    catch (err: unknown) { showError(err instanceof Error ? err.message : 'Failed to suspend') }
  }

  const handleActivate = async (assignment: EmployeeBranch) => {
    try { await employeeBranchesApi.activate(assignment.id); success('Assignment activated successfully'); refetch() }
    catch (err: unknown) { showError(err instanceof Error ? err.message : 'Failed to activate') }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to manage employee branches.</p>
        </div>
      </div>
    )
  }

  const employeeName = branches[0]?.employee_name || ''
  const hasPrimaryBranch = branches.some((b) => b.is_primary)
  const assignedBranchIds = branches.map((b) => b.branch_id)
  const isLoadingOptions = isModalOpen && (roles.length === 0 || branchOptions.length === 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 md:mb-8">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 md:mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">Back to Employee</span>
          </button>
          
          <div className="bg-linear-to-r from-blue-600 to-blue-700 rounded-xl md:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-white min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg shrink-0">
                    <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Branch Access</h1>
                </div>
                {employeeName && <p className="text-blue-100 text-base sm:text-lg font-medium ml-11 truncate">Employee: {employeeName}</p>}
                <p className="text-blue-200 text-xs sm:text-sm mt-1 ml-11">Manage branch assignments, roles, and approval limits</p>
              </div>
              <button onClick={() => handleOpenModal()} className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl hover:bg-blue-50 font-semibold shadow-lg shrink-0 text-sm sm:text-base">
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                Assign Branch
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-400">
            {error}
            <button onClick={() => refetch()} className="ml-4 underline">Retry</button>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
              Branch Assignments
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 ml-3">
              {loading ? 'Loading...' : `${branches.length} branch${branches.length !== 1 ? 'es' : ''} assigned`}
            </p>
          </div>

          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Loading branch assignments...</p>
              </div>
            ) : (
              <EmployeeBranchDetailTable branches={branches} onEdit={handleOpenModal} onDelete={handleDelete} onSuspend={handleSuspend} onActivate={handleActivate} />
            )}
          </div>
        </div>

        <BranchAssignmentModal
          isOpen={isModalOpen}
          employeeId={employeeId!}
          assignment={editingAssignment}
          assignedBranchIds={assignedBranchIds}
          roles={roles}
          branches={branchOptions}
          onSubmit={handleSubmit}
          onClose={handleCloseModal}
          hasPrimaryBranch={hasPrimaryBranch}
          isLoadingOptions={isLoadingOptions}
        />
      </div>
    </div>
  )
}
