import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmployeeBranchBulkForm } from '../components/EmployeeBranchBulkForm'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import { useToast } from '@/contexts/ToastContext'
import { employeesApi } from '@/features/employees/api/employees.api'
import { branchesApi } from '@/features/branches/api/branches.api'

export default function EmployeeBranchCreatePage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { create } = useEmployeeBranchesStore()
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const onSubmit = useCallback(async (data: { employee_id: string; branches: { branch_id: string; is_primary: boolean }[] }) => {
    setIsSubmitting(true)
    try {
      let successCount = 0
      let failCount = 0

      // Submit primary first, then others
      const primaryBranch = data.branches.find(b => b.is_primary)
      const otherBranches = data.branches.filter(b => !b.is_primary)
      const orderedBranches = primaryBranch ? [primaryBranch, ...otherBranches] : data.branches

      for (const branch of orderedBranches) {
        try {
          const res = await create({
            employee_id: data.employee_id,
            branch_id: branch.branch_id,
            is_primary: branch.is_primary
          })
          if (res) successCount++
          else failCount++
        } catch {
          failCount++
        }
      }

      if (successCount > 0) {
        success(`Berhasil menambahkan ${successCount} cabang`)
      }
      if (failCount > 0) {
        showError(`${failCount} cabang gagal ditambahkan (mungkin sudah ada atau duplikat primary)`)
      }
      if (failCount === 0) {
        navigate('/employee-branches')
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [create, navigate, success, showError])

  if (isLoadingData) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Tambah Employee Branch</h1>
      <div className="bg-white rounded-xl border p-6">
        <EmployeeBranchBulkForm
          employees={employees}
          branches={branches}
          loading={isSubmitting}
          onSubmit={onSubmit}
          onCancel={() => navigate('/employee-branches')}
        />
      </div>
    </div>
  )
}
