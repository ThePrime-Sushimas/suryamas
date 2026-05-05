import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Plus } from 'lucide-react'
import { usePermission } from '@/features/branch_context/hooks/usePermission'
import { useEmployeeBranchDetail } from '../hooks/useEmployeeBranchDetail'
import { employeeBranchesApi } from '../api/employeeBranches.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
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
    try { await employeeBranchesApi.remove(assignment.id); success('Penempatan berhasil dihapus'); refetch() }
    catch (err: unknown) { showError(parseApiError(err, 'Gagal menghapus')) }
  }

  const handleSuspend = async (assignment: EmployeeBranch) => {
    try { await employeeBranchesApi.suspend(assignment.id); success('Akses cabang ditangguhkan'); refetch() }
    catch (err: unknown) { showError(parseApiError(err, 'Gagal menangguhkan')) }
  }

  const handleActivate = async (assignment: EmployeeBranch) => {
    try { await employeeBranchesApi.activate(assignment.id); success('Akses cabang diaktifkan'); refetch() }
    catch (err: unknown) { showError(parseApiError(err, 'Gagal mengaktifkan')) }
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
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-3 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="font-medium">Kembali</span>
          </button>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">Akses Cabang</h1>
                </div>
                {employeeName && <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 truncate">{employeeName}</p>}
              </div>
              <button onClick={() => handleOpenModal()} className="inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium text-xs shrink-0">
                <Plus className="h-3.5 w-3.5" />
                Tambah Cabang
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

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Penempatan Cabang</h2>
            <p className="text-[11px] text-gray-400">
              {loading ? 'Memuat...' : `${branches.length} cabang ditugaskan`}
            </p>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-200 border-t-blue-600 mb-3"></div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Memuat penempatan...</p>
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
