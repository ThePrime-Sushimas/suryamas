import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { User, Mail, CreditCard, Briefcase, Settings, ArrowLeft, Edit, Building2 } from 'lucide-react'
import api from '@/lib/axios'
import { EmployeeBranchAccessTab } from '../components/EmployeeBranchAccessTab'

interface Employee {
  id: string
  employee_id: string
  full_name: string
  job_position: string
  join_date: string
  resign_date: string | null
  status_employee: string
  end_date: string | null
  sign_date: string | null
  email: string | null
  birth_date: string | null
  age: number | null
  years_of_service?: { years: number; months: number; days: number } | null
  birth_place: string | null
  citizen_id_address: string | null
  ptkp_status: string
  bank_name: string | null
  bank_account: string | null
  bank_account_holder: string | null
  nik: string | null
  mobile_phone: string | null
  branch_name?: string | null
  brand_name: string | null
  religion: string | null
  gender: string | null
  marital_status: string | null
  profile_picture: string | null
  created_at: string
  updated_at: string
  is_active: boolean
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

type Tab = 'personal' | 'contact' | 'employment' | 'banking' | 'branches' | 'system'

const TABS = [
  { id: 'personal' as const, label: 'Personal Info', icon: User },
  { id: 'contact' as const, label: 'Contact', icon: Mail },
  { id: 'employment' as const, label: 'Employment', icon: Briefcase },
  { id: 'banking' as const, label: 'Banking', icon: CreditCard },
  { id: 'branches' as const, label: 'Branch Access', icon: Building2 },
  { id: 'system' as const, label: 'System', icon: Settings },
]

const formatDate = (date: string | null | undefined) => 
  date ? new Date(date).toLocaleDateString('id-ID') : null

const formatDateTime = (date: string) => 
  new Date(date).toLocaleString('id-ID')

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="font-medium text-gray-900">{value || '-'}</p>
    </div>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('personal')

  useEffect(() => {
    if (!id || id === 'create') {
      setIsLoading(false)
      setError('Invalid employee ID')
      return
    }

    let isCancelled = false

    const fetchEmployee = async () => {
      try {
        const { data } = await api.get<ApiResponse<Employee>>(`/employees/${id}`)
        if (!isCancelled) {
          setEmployee(data.data)
          setError(null)
        }
      } catch (err: unknown ) {
        if (!isCancelled) {
          const message = err instanceof Error && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'error' in err.response.data ? String(err.response.data.error) : 'Failed to load employee'
          setError(message)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchEmployee()
    return () => { isCancelled = true }
  }, [id])

  const yearsOfService = useMemo(() => {
    if (!employee?.years_of_service) return null
    const { years, months, days } = employee.years_of_service
    return `${years}y ${months}m ${days}d`
  }, [employee?.years_of_service])

  const profileInitial = useMemo(() => 
    employee?.full_name?.charAt(0).toUpperCase() || '?'
  , [employee])

  const handleBack = useCallback(() => navigate('/employees'), [navigate])
  const handleEdit = useCallback(() => navigate(`/employees/edit/${id}`), [navigate, id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading employee...</p>
        </div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {error || 'Employee not found'}
          </div>
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-r from-blue-600 to-blue-700 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                {employee.profile_picture ? (
                  <img 
                    src={employee.profile_picture} 
                    alt={employee.full_name} 
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg" 
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-blue-600 text-2xl font-bold shadow-lg">
                    {profileInitial}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{employee.full_name}</h1>
                  <p className="text-blue-100 mt-1">{employee.job_position}</p>
                  <p className="text-blue-200 text-sm mt-1">{employee.employee_id}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center gap-2 bg-white text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white">
            <nav className="flex overflow-x-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8">
            <div className="space-y-4">
              {activeTab === 'personal' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem label="Employee ID" value={employee.employee_id} />
                  <InfoItem label="Full Name" value={employee.full_name} />
                  <InfoItem label="NIK" value={employee.nik} />
                  <InfoItem label="Birth Date" value={formatDate(employee.birth_date)} />
                  <InfoItem label="Birth Place" value={employee.birth_place} />
                  <InfoItem label="Age" value={employee.age} />
                  <InfoItem label="Gender" value={employee.gender} />
                  <InfoItem label="Religion" value={employee.religion} />
                  <InfoItem label="Marital Status" value={employee.marital_status} />
                </div>
              )}

              {activeTab === 'contact' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem label="Email" value={employee.email} />
                  <InfoItem label="Mobile Phone" value={employee.mobile_phone} />
                  <div className="md:col-span-2">
                    <InfoItem label="Address (KTP)" value={employee.citizen_id_address} />
                  </div>
                </div>
              )}

              {activeTab === 'employment' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem label="Job Position" value={employee.job_position} />
                  <InfoItem label="Branch" value={employee.branch_name} />
                  <InfoItem label="Brand Name" value={employee.brand_name} />
                  <InfoItem label="Status" value={employee.status_employee} />
                  <InfoItem label="PTKP Status" value={employee.ptkp_status} />
                  <InfoItem label="Join Date" value={formatDate(employee.join_date)} />
                  <InfoItem label="Years of Service" value={yearsOfService} />
                  <InfoItem label="Resign Date" value={formatDate(employee.resign_date)} />
                  <InfoItem label="Contract Sign Date" value={formatDate(employee.sign_date)} />
                  <InfoItem label="Contract End Date" value={formatDate(employee.end_date)} />
                </div>
              )}

              {activeTab === 'banking' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem label="Bank Name" value={employee.bank_name} />
                  <InfoItem label="Bank Account" value={employee.bank_account} />
                  <div className="md:col-span-2">
                    <InfoItem label="Bank Account Holder" value={employee.bank_account_holder} />
                  </div>
                </div>
              )}

              {activeTab === 'branches' && id && (
                <EmployeeBranchAccessTab employeeId={id} />
              )}

              {activeTab === 'system' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem 
                    label="Active Status" 
                    value={
                      <span className={`px-2 py-1 rounded text-xs ${
                        employee.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    } 
                  />
                  <InfoItem label="Created At" value={formatDateTime(employee.created_at)} />
                  <InfoItem label="Updated At" value={formatDateTime(employee.updated_at)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
