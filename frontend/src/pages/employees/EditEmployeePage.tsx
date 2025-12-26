import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../lib/axios'
import type { Employee, ApiResponse } from '../../types'
import EmployeeForm from '../../components/employees/EmployeeForm'

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true)
  const [branchInfo, setBranchInfo] = useState<{ branch_name?: string; branch_code?: string } | null>(null)
  const [initialData, setInitialData] = useState<any>(null)

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const { data } = await api.get<ApiResponse<Employee>>(`/employees/${id}`)
        const emp = data.data
        setInitialData({
          full_name: emp.full_name,
          job_position: emp.job_position,
          brand_name: emp.brand_name || '',
          ptkp_status: emp.ptkp_status,
          status_employee: emp.status_employee,
          join_date: emp.join_date ? emp.join_date.split('T')[0] : '',
          resign_date: emp.resign_date ? emp.resign_date.split('T')[0] : '',
          sign_date: emp.sign_date ? emp.sign_date.split('T')[0] : '',
          end_date: emp.end_date ? emp.end_date.split('T')[0] : '',
          email: emp.email || '',
          mobile_phone: emp.mobile_phone || '',
          nik: emp.nik || '',
          birth_date: emp.birth_date ? emp.birth_date.split('T')[0] : '',
          birth_place: emp.birth_place || '',
          citizen_id_address: emp.citizen_id_address || '',
          religion: emp.religion || '',
          gender: emp.gender || '',
          marital_status: emp.marital_status || '',
          bank_name: emp.bank_name || '',
          bank_account: emp.bank_account || '',
          bank_account_holder: emp.bank_account_holder || '',
        })
        setBranchInfo({
          branch_name: emp.branch_name ?? undefined,
          branch_code: emp.branch_code ?? undefined,
        })
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to load employee')
        navigate('/employees')
      } finally {
        setIsLoadingEmployee(false)
      }
    }
    fetchEmployee()
  }, [id, navigate])

  const handleSubmit = async (formData: any, file?: File) => {
    setIsLoading(true)
    try {
      const formDataObj = new FormData()
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          formDataObj.append(key, value as string)
        }
      })
      if (file) {
        formDataObj.append('profile_picture', file)
      }
      
      await api.put(`/employees/${id}`, formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      alert('Employee updated successfully!')
      navigate('/employees')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingEmployee) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow rounded-lg p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Edit Employee</h1>
        
        {/* Branch Info */}
        <div className="border-b border-gray-200 pb-4 md:pb-6 mb-4 md:mb-6 bg-blue-50 p-4 rounded">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Branch Assignment</h3>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              {branchInfo?.branch_name ? (
                <div>
                  <p className="text-sm text-gray-600">Current Branch:</p>
                  <p className="text-base font-medium text-gray-900">{branchInfo.branch_name} ({branchInfo.branch_code})</p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">No branch assigned</p>
              )}
            </div>
            <Link
              to="/employee-branches"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm md:text-base min-h-[44px] flex items-center justify-center"
            >
              Manage Branches
            </Link>
          </div>
        </div>

        <EmployeeForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/employees')}
          isLoading={isLoading}
          submitLabel="Update Employee"
        />
      </div>
    </div>
  )
}
