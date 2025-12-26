import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmployeeBranchForm } from '../components/EmployeeBranchForm'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import { useToast } from '@/contexts/ToastContext'
import type { CreateEmployeeBranchDTO } from '../api/types'

export default function EmployeeBranchCreatePage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { create, loading, error } = useEmployeeBranchesStore()

  const onSubmit = useCallback(async (payload: CreateEmployeeBranchDTO | any) => {
    const res = await create(payload as CreateEmployeeBranchDTO)
    if (res) {
      success('Relasi berhasil dibuat')
      navigate('..')
    } else {
      showError(error.create?.message || 'Gagal membuat relasi')
    }
  }, [create, navigate, error, success, showError])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Tambah Employee Branch</h1>
      <div className="bg-white rounded-xl border p-6">
        <EmployeeBranchForm
          mode="create"
          employees={[]}
          branches={[]}
          loading={loading.create}
          onSubmit={onSubmit}
          onCancel={() => navigate('..')}
        />
      </div>
    </div>
  )
}
