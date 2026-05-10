import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Plus, Briefcase } from 'lucide-react'
import { usePermission } from '@/features/branch_context/hooks/usePermission'
import { useEmployeeBranchDetail } from '../hooks/useEmployeeBranchDetail'
import { employeeBranchesApi } from '../api/employeeBranches.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { BranchAssignmentCard } from '../components/BranchAssignmentCard'
import { BranchAssignmentModal } from '../components/BranchAssignmentModal'
import { EmployeePositionsTab } from '@/features/employees/components/EmployeePositionsTab'
import type { EmployeeBranch, CreateEmployeeBranchDTO, UpdateEmployeeBranchDTO, Role, BranchOption } from '../api/types'

export const EmployeeBranchPositionPage = () => {
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
      showError(parseApiError(err, 'Gagal memuat opsi'))
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
        success('Penempatan berhasil diperbarui')
      } else {
        await employeeBranchesApi.create(data as CreateEmployeeBranchDTO)
        success('Penempatan berhasil dibuat')
      }
      handleCloseModal()
      await refetch()
    } catch (err: unknown) {
      showError(parseApiError(err, 'Operasi gagal'))
      throw err
    }
  }

  const handleDelete = async (assignment: EmployeeBranch) => {
    try { 
      await employeeBranchesApi.remove(assignment.id)
      success('Penempatan berhasil dihapus')
      refetch() 
    } catch (err: unknown) { 
      showError(parseApiError(err, 'Gagal menghapus')) 
    }
  }

  const handleSuspend = async (assignment: EmployeeBranch) => {
    try { 
      await employeeBranchesApi.suspend(assignment.id)
      success('Akses cabang ditangguhkan')
      refetch() 
    } catch (err: unknown) { 
      showError(parseApiError(err, 'Gagal menangguhkan')) 
    }
  }

  const handleActivate = async (assignment: EmployeeBranch) => {
    try { 
      await employeeBranchesApi.activate(assignment.id)
      success('Akses cabang diaktifkan')
      refetch() 
    } catch (err: unknown) { 
      showError(parseApiError(err, 'Gagal mengaktifkan')) 
    }
  }

  const handleSetPrimary = async (assignment: EmployeeBranch) => {
    try {
      await employeeBranchesApi.setPrimary(employeeId!, assignment.branch_id)
      success('Primary branch berhasil diubah')
      refetch()
    } catch (err: unknown) {
      showError(parseApiError(err, 'Gagal set primary'))
    }
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Akses Ditolak</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Anda tidak memiliki izin untuk mengelola penempatan cabang.</p>
        </div>
      </div>
    )
  }

  const employeeName = branches[0]?.employee_name || ''
  const hasPrimaryBranch = branches.some((b) => b.is_primary)
  const assignedBranchIds = branches.map((b) => b.branch_id)
  const isLoadingOptions = isModalOpen && (roles.length === 0 || branchOptions.length === 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button 
            onClick={() => navigate('/employees')} 
            className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="font-medium">Kembali ke Daftar Karyawan</span>
          </button>
          
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Penempatan Cabang & Posisi</h1>
                {employeeName && <p className="text-sm text-blue-100 mt-0.5">{employeeName}</p>}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-400 text-sm">
            {error}
            <button onClick={() => refetch()} className="ml-4 underline font-medium">Retry</button>
          </div>
        )}

        {/* Branch Assignments Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Penempatan Cabang</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                {loading ? '...' : branches.length}
              </span>
            </div>
            <button 
              onClick={() => handleOpenModal()} 
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium text-xs transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Cabang
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : branches.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
              <Building2 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Belum ada penempatan cabang</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Karyawan ini belum ditugaskan ke cabang manapun</p>
              <button 
                onClick={() => handleOpenModal()} 
                className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Cabang Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {branches.map((branch) => (
                <BranchAssignmentCard
                  key={branch.id}
                  branch={branch}
                  onEdit={() => handleOpenModal(branch)}
                  onDelete={() => handleDelete(branch)}
                  onSuspend={() => handleSuspend(branch)}
                  onActivate={() => handleActivate(branch)}
                  onSetPrimary={() => handleSetPrimary(branch)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Cover Positions Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Posisi Tambahan (Cover)</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Posisi yang dapat di-cover di semua cabang, tidak terikat pada penempatan cabang tertentu
          </p>
          <EmployeePositionsTab employeeId={employeeId!} />
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
