import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useEmployeeStore } from '@/features/employees'
import { useToast } from '@/contexts/ToastContext'
import { EmployeeForm, EmployeePositionsTab } from '@/features/employees'
import type { EmployeeFormData, EmployeeResponse } from '@/features/employees'

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const { mutationLoading } = useEmployeeStore()
  
  const [employee, setEmployee] = useState<EmployeeResponse | null>(null)
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true)
  const [initialData, setInitialData] = useState<Partial<EmployeeFormData> | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'positions'>('info')
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
      } catch (err: unknown ) {
        if (!isMountedRef.current) return
        const message = err instanceof Error ? err.message : 'Failed to load employee'
        toastError(message)
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update employee'
      toastError(message)
      throw err
    }
  }, [id, navigate, success, toastError])

  const handleCancel = useCallback(() => {
    navigate('/employees')
  }, [navigate])

  if (isLoadingEmployee) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 md:p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!employee || !initialData) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 md:p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">Karyawan tidak ditemukan</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 md:p-6">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Ubah Karyawan</h1>
        
        {employee.branch_name && (
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Penempatan Cabang & Posisi</h3>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Cabang saat ini:</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {employee.branch_name} {employee.branch_code && `(${employee.branch_code})`}
                </p>
              </div>
              <Link
                to={`/employees/${id}/branches`}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Kelola Cabang & Posisi
              </Link>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('info')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Informasi Dasar
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'positions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Posisi
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'info' ? (
          <EmployeeForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={mutationLoading}
            submitLabel="Simpan"
            mode="edit"
          />
        ) : (
          <EmployeePositionsTab employeeId={id!} />
        )}
      </div>
    </div>
  )
}
