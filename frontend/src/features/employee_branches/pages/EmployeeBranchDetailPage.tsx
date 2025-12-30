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
  const hasUpdatePermission = usePermission('employee_branches', 'update')
  const { branches, loading, error, fetchBranches, refetch } = useEmployeeBranchDetail(employeeId!)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<EmployeeBranch | undefined>()
  const [roles, setRoles] = useState<Role[]>([])
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([])
  const { success, error: showError } = useToast()

  useEffect(() => {
    if (!hasUpdatePermission) {
      navigate('/')
      return
    }
    if (employeeId) {
      fetchBranches()
    }
  }, [employeeId, hasUpdatePermission, navigate, fetchBranches])

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
    } catch (err: any) {
      showError(err.message || 'Failed to load options')
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
    } catch (err: any) {
      showError(err.message || 'Operation failed')
      throw err
    }
  }

  const handleDelete = async (assignment: EmployeeBranch) => {
    try {
      await employeeBranchesApi.remove(assignment.id)
      success('Assignment deleted successfully')
      refetch()
    } catch (err: any) {
      showError(err.message || 'Failed to delete')
    }
  }

  const handleSuspend = async (assignment: EmployeeBranch) => {
    try {
      await employeeBranchesApi.update(assignment.id, { status: 'suspended' })
      success('Assignment suspended successfully')
      refetch()
    } catch (err: any) {
      showError(err.message || 'Failed to suspend')
    }
  }

  if (!hasUpdatePermission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to manage employee branches.</p>
        </div>
      </div>
    )
  }

  const employeeName = branches[0]?.employee_name || ''
  const hasPrimaryBranch = branches.some((b) => b.is_primary)
  const assignedBranchIds = branches.map((b) => b.branch_id)
  const isLoadingOptions = isModalOpen && (roles.length === 0 || branchOptions.length === 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">Back to Employee</span>
          </button>
          
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold">Branch Access Management</h1>
                </div>
                {employeeName && <p className="text-blue-100 text-lg font-medium ml-11">Employee: {employeeName}</p>}
                <p className="text-blue-200 text-sm mt-1 ml-11">Manage branch assignments, roles, and approval limits</p>
              </div>
              <button onClick={() => handleOpenModal()} className="inline-flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-xl hover:bg-blue-50 font-semibold shadow-lg">
                <Plus className="h-5 w-5" />
                Assign Branch
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
            <button onClick={() => refetch()} className="ml-4 underline">Retry</button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
              Branch Assignments
            </h2>
            <p className="text-gray-600 text-sm mt-1 ml-3">
              {loading ? 'Loading...' : `${branches.length} branch${branches.length !== 1 ? 'es' : ''} assigned`}
            </p>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                <p className="text-gray-500 font-medium">Loading branch assignments...</p>
              </div>
            ) : (
              <EmployeeBranchDetailTable branches={branches} onEdit={handleOpenModal} onDelete={handleDelete} onSuspend={handleSuspend} />
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
