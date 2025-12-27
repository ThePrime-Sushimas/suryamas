import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import { EmployeeBranchTable } from '../components/EmployeeBranchTable'
import { PrimaryBranchModal } from '../components/PrimaryBranchModal'
import { useToast } from '@/contexts/ToastContext'
import type { EmployeeBranch } from '../api/types'

export default function EmployeeBranchesPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { items, total, page, limit, loading, list, remove, setPrimary } = useEmployeeBranchesStore()
  
  const [modalState, setModalState] = useState<{
    show: boolean
    employeeId: string
    employeeName: string
    branchId: string
    branchName: string
  }>({ show: false, employeeId: '', employeeName: '', branchId: '', branchName: '' })

  useEffect(() => {
    list({ page, limit })
  }, [list, page, limit])

  const onPageChange = useCallback((newPage: number) => {
    list({ page: newPage, limit })
  }, [list, limit])

  const onEdit = useCallback((row: { id: string }) => navigate(`./${row.id}/edit`), [navigate])

  const onDelete = useCallback(async (row: { id: string }) => {
    if (!confirm('Hapus relasi ini?')) return
    const ok = await remove(row.id)
    if (ok) success('Data berhasil dihapus')
    else showError('Gagal menghapus data')
  }, [remove, success, showError])

  const onSetPrimary = useCallback(async (row: EmployeeBranch) => {
    if (row.is_primary) return
    
    // Check if employee has other primary branch
    const hasPrimary = items.some(i => i.employee_id === row.employee_id && i.is_primary)
    
    if (hasPrimary) {
      setModalState({
        show: true,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        branchId: row.branch_id,
        branchName: row.branch_name
      })
    } else {
      const ok = await setPrimary(row.employee_id, row.branch_id)
      if (ok) success(`Set ${row.branch_name} sebagai primary`)
      else showError('Gagal set primary branch')
    }
  }, [items, setPrimary, success, showError])
  
  const handleModalConfirm = useCallback(async () => {
    const ok = await setPrimary(modalState.employeeId, modalState.branchId)
    if (ok) {
      success(`Primary branch berhasil diganti ke ${modalState.branchName}`)
      setModalState(prev => ({ ...prev, show: false }))
    } else {
      showError('Gagal mengganti primary branch')
    }
  }, [modalState, setPrimary, success, showError])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employee Branches</h1>
        <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => navigate('./create')}>
          Tambah
        </button>
      </div>

      <EmployeeBranchTable
        data={items}
        total={total}
        page={page}
        limit={limit}
        loading={loading.list}
        onPageChange={onPageChange}
        onEdit={onEdit}
        onDelete={onDelete}
        onSetPrimary={onSetPrimary}
      />
      
      <PrimaryBranchModal
        isOpen={modalState.show}
        onClose={() => setModalState(prev => ({ ...prev, show: false }))}
        onConfirm={handleModalConfirm}
        employeeName={modalState.employeeName}
        targetBranchName={modalState.branchName}
        isLoading={loading.setPrimary}
      />
    </div>
  )
}
