import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeStore } from '@/features/employees'
import { useToast } from '@/contexts/ToastContext'
import { EmployeeForm } from '@/features/employees'
import type { EmployeeFormData } from '@/features/employees/types'

export default function CreateEmployeePage() {
  const { createEmployee, mutationLoading } = useEmployeeStore()
  const navigate = useNavigate()
  const { success, error } = useToast()

  const handleSubmit = useCallback(async (data: EmployeeFormData, file?: File) => {
    try {
      await createEmployee(data, file)
      success('Employee created successfully!')
      navigate('/employees', { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create employee'
      error(message)
    }
  }, [createEmployee, navigate, success, error])

  const handleCancel = useCallback(() => {
    navigate('/employees')
  }, [navigate])

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 md:p-6">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tambah Karyawan Baru</h1>
        <EmployeeForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={mutationLoading}
          submitLabel="Simpan"
          mode="create"
        />
      </div>
    </div>
  )
}
