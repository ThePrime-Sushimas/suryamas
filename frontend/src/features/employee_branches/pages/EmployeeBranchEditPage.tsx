import { useEffect, useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EmployeeBranchForm } from '../components/EmployeeBranchForm'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import { useToast } from '@/contexts/ToastContext'
import { employeesApi } from '@/features/employees/api/employees.api'
import { branchesApi } from '@/features/branches/api/branches.api'
import type { UpdateEmployeeBranchDTO } from '../api/types'

export default function EmployeeBranchEditPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { success, error: showError } = useToast()
  const { selected, getById, update, loading, error } = useEmployeeBranchesStore()
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    if (id) getById(id)
  }, [id, getById])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, branchRes] = await Promise.all([
          employeesApi.list(1, 1000),
          branchesApi.list(1, 1000)
        ])
        setEmployees(empRes.data.map(e => ({ id: e.id, name: e.full_name })))
        setBranches(branchRes.data.map(b => ({ id: b.id, name: b.branch_name })))
      } catch (err) {
        showError('Gagal memuat data')
      } finally {
        setIsLoadingData(false)
      }
    }
    fetchData()
  }, [showError])

  const onSubmit = useCallback(async (payload: UpdateEmployeeBranchDTO | any) => {
    if (!id) return
    const res = await update(id, payload as UpdateEmployeeBranchDTO)
    if (res) {
      success('Relasi berhasil diupdate')
      navigate('/employee-branches')
    } else {
      showError(error.update?.message || 'Gagal mengupdate relasi')
    }
  }, [id, update, navigate, error, success, showError])

  if (isLoadingData || !selected) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Edit Employee Branch</h1>
      <div className="bg-white rounded-xl border p-6">
        <EmployeeBranchForm
          mode="edit"
          initial={selected}
          employees={employees}
          branches={branches}
          loading={loading.update}
          onSubmit={onSubmit}
          onCancel={() => navigate('/employee-branches')}
        />
      </div>
    </div>
  )
}
