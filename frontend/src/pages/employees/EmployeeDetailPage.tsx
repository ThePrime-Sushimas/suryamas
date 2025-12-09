import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import type { Employee, ApiResponse } from '../../types'

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('personal')

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'contact', label: 'Contact' },
    { id: 'employment', label: 'Employment' },
    { id: 'banking', label: 'Banking' },
    { id: 'system', label: 'System' },
  ]

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        console.log('Fetching employee with ID:', id)
        const { data } = await api.get<ApiResponse<Employee>>(`/employees/${id}`)
        console.log('Employee data:', data)
        setEmployee(data.data)
      } catch (error: any) {
        console.error('Failed to fetch employee:', error)
        console.error('Error response:', error.response?.data)
      } finally {
        setIsLoading(false)
      }
    }
    fetchEmployee()
  }, [id])

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!employee) {
    return <div className="text-center py-8">Employee not found</div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            {employee.profile_picture ? (
              <img src={employee.profile_picture} alt={employee.full_name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xl font-bold">
                {employee.full_name.charAt(0)}
              </div>
            )}
            <h1 className="text-2xl font-bold">{employee.full_name}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/employees')}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Back
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === 'personal' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Employee ID</p>
                <p className="font-medium">{employee.employee_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium">{employee.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">NIK</p>
                <p className="font-medium">{employee.nik || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Birth Date</p>
                <p className="font-medium">{employee.birth_date ? new Date(employee.birth_date).toLocaleDateString('id-ID') : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Birth Place</p>
                <p className="font-medium">{employee.birth_place || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Age</p>
                <p className="font-medium">{employee.age || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Gender</p>
                <p className="font-medium">{employee.gender || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Religion</p>
                <p className="font-medium">{employee.religion || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Marital Status</p>
                <p className="font-medium">{employee.marital_status || '-'}</p>
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{employee.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Mobile Phone</p>
                <p className="font-medium">{employee.mobile_phone || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Address (KTP)</p>
                <p className="font-medium">{employee.citizen_id_address || '-'}</p>
              </div>
            </div>
          )}

          {activeTab === 'employment' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Job Position</p>
                <p className="font-medium">{employee.job_position}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Branch</p>
                <p className="font-medium">{employee.branch_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Parent Branch</p>
                <p className="font-medium">{employee.parent_branch_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium">{employee.status_employee}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">PTKP Status</p>
                <p className="font-medium">{employee.ptkp_status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Join Date</p>
                <p className="font-medium">{new Date(employee.join_date).toLocaleDateString('id-ID')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Years of Service</p>
                <p className="font-medium">
                  {employee.years_of_service ? `${employee.years_of_service.years} years ${employee.years_of_service.months} months ${employee.years_of_service.days} days` : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Resign Date</p>
                <p className="font-medium">{employee.resign_date ? new Date(employee.resign_date).toLocaleDateString('id-ID') : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contract Sign Date</p>
                <p className="font-medium">{employee.sign_date ? new Date(employee.sign_date).toLocaleDateString('id-ID') : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contract End Date</p>
                <p className="font-medium">{employee.end_date ? new Date(employee.end_date).toLocaleDateString('id-ID') : '-'}</p>
              </div>
            </div>
          )}

          {activeTab === 'banking' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Bank Name</p>
                <p className="font-medium">{employee.bank_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Bank Account</p>
                <p className="font-medium">{employee.bank_account || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Bank Account Holder</p>
                <p className="font-medium">{employee.bank_account_holder || '-'}</p>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Created At</p>
                <p className="font-medium">{new Date(employee.created_at).toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Updated At</p>
                <p className="font-medium">{new Date(employee.updated_at).toLocaleString('id-ID')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
