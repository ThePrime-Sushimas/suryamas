import { useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EmployeeBranchForm } from '../components/EmployeeBranchForm'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import { useToast } from '@/contexts/ToastContext'
import type { UpdateEmployeeBranchDTO } from '../api/types'

export default function EmployeeBranchEditPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { success, error: showError } = useToast()
  const { selected, getById, update, loading, error } = useEmployeeBranchesStore()

  useEffect(() => {
    if (id) getById(id)
  }, [id, getById])

  const onSubmit = useCallback(async (payload: UpdateEmployeeBranchDTO | any) => {
    if (!id) return
    const res = await update(id, payload as UpdateEmployeeBranchDTO)
    if (res) {
      success('Relasi berhasil diupdate')
      navigate('..')
    } else {
      showError(error.update?.message || 'Gagal mengupdate relasi')
    }
  }, [id, update, navigate, error, success, showError])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Edit Employee Branch</h1>
      <div className="bg-white rounded-xl border p-6">
        {!selected ? (
          <div className="space-y-3">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
          </div>
        ) : (
          <EmployeeBranchForm
            mode="edit"
            initial={selected}
            employees={[]}
            branches={[]}
            loading={loading.update}
            onSubmit={onSubmit}
            onCancel={() => navigate('..')}
          />
        )}
      </div>
    </div>
  )
}
