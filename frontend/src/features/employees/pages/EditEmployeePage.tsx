import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useEmployeeStore } from '@/features/employees'
import { useToast } from '@/contexts/ToastContext'
import { EmployeeForm } from '@/features/employees'
import type { EmployeeFormData, EmployeeResponse } from '@/features/employees'

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const { isLoading } = useEmployeeStore()
  
  const [employee, setEmployee] = useState<EmployeeResponse | null>(null)
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true)
  const [initialData, setInitialData] = useState<Partial<EmployeeFormData> | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!id) {
      navigate('/employees')
      return
    }

    const fetchEmployee = async () => {
      setIsLoadingEmployee(true)
      try {
        const { employeesApi } = await import('@/features/employees')
        const data = await employeesApi.getById(id)
        
        if (!isMountedRef.current) return

        setEmployee(data)
        setInitialData({
          full_name: data.full_name,
          job_position: data.job_position,
          brand_name: data.brand_name || '',
          ptkp_status: data.ptkp_status,
          status_employee: data.status_employee,
          join_date: data.join_date?.split('T')[0] || '',
          resign_date: data.resign_date?.split('T')[0] || '',
          sign_date: data.sign_date?.split('T')[0] || '',
          end_date: data.end_date?.split('T')[0] || '',
          email: data.email || '',
          mobile_phone: data.mobile_phone || '',
          nik: data.nik || '',
          birth_date: data.birth_date?.split('T')[0] || '',
          birth_place: data.birth_place || '',
          citizen_id_address: data.citizen_id_address || '',
          religion: data.religion ?? undefined,
          gender: data.gender ?? undefined,
          marital_status: data.marital_status ?? undefined,
          bank_name: data.bank_name || '',
          bank_account: data.bank_account || '',
          bank_account_holder: data.bank_account_holder || '',
        })
      } catch (err: any) {
        if (!isMountedRef.current) return
        toastError(err.message || 'Failed to load employee')
        navigate('/employees')
      } finally {
        if (isMountedRef.current) {
          setIsLoadingEmployee(false)
        }
      }
    }

    fetchEmployee()
  }, [id, navigate, toastError])

  const handleSubmit = useCallback(async (formData: EmployeeFormData, file?: File) => {
    if (!id) return
    
    try {
      const { employeesApi } = await import('@/features/employees')
      await employeesApi.update(id, formData, file)
      success('Employee updated successfully!')
      navigate('/employees', { replace: true })
    } catch (err: any) {
      toastError(err.message || 'Failed to update employee')
      throw err
    }
  }, [id, navigate, success, toastError])

  const handleCancel = useCallback(() => {
    navigate('/employees')
  }, [navigate])

  if (isLoadingEmployee) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="bg-white shadow rounded-lg p-4 md:p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!employee || !initialData) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="bg-white shadow rounded-lg p-4 md:p-6 text-center">
          <p className="text-gray-600">Employee not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="bg-white shadow rounded-lg p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Edit Employee</h1>
        
        {employee.branch_name && (
          <div className="border-b border-gray-200 pb-4 md:pb-6 mb-4 md:mb-6 bg-blue-50 p-4 rounded">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Branch Assignment</h3>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm text-gray-600">Current Branch:</p>
                <p className="text-base font-medium text-gray-900">
                  {employee.branch_name} {employee.branch_code && `(${employee.branch_code})`}
                </p>
              </div>
              <Link
                to="/employee-branches"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm md:text-base min-h-[44px] flex items-center justify-center"
              >
                Manage Branches
              </Link>
            </div>
          </div>
        )}

        <EmployeeForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
          submitLabel="Update Employee"
        />
      </div>
    </div>
  )
}
