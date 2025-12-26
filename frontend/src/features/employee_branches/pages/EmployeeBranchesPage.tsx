import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import { EmployeeBranchTable } from '../components/EmployeeBranchTable'
import { useToast } from '@/contexts/ToastContext'

export default function EmployeeBranchesPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { items, total, page, limit, loading, list, remove, setPrimary } = useEmployeeBranchesStore()

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

  const onSetPrimary = useCallback(async (row: { employee_id: string; branch_id: string }) => {
    const ok = await setPrimary(row.employee_id, row.branch_id)
    if (ok) success('Primary branch berhasil diset')
    else showError('Gagal set primary branch')
  }, [setPrimary, success, showError])

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
    </div>
  )
}
