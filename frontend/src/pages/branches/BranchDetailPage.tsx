import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { branchService } from '@/services/branchService'
import { companyService } from '@/services/companyService'
import api from '@/lib/axios'
import AssignEmployeeToBranchModal from '@/components/AssignEmployeeToBranchModal'
import type { Branch } from '@/types/branch'
import {
  ArrowLeft,
  Building,
  MapPin,
  Phone,
  Mail,
  Clock,
  Users,
  User,
  Edit2,
  Trash2,
  Briefcase,
  Loader2,
  AlertCircle,
  ChevronRight,
  PhoneCall,
  Smartphone,
  FileText,
  Building2
} from 'lucide-react'

interface Employee {
  id: string
  employee_id: string
  full_name: string
  job_position: string
  email: string | null
  department?: string
  avatar_url?: string
}

function BranchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [managerName, setManagerName] = useState<string>('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeTab, setActiveTab] = useState<'details' | 'employees' | 'map'>('details')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)

  useEffect(() => {
    const fetchBranch = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await branchService.getById(id!)
        setBranch(res.data.data)
        
        const promises = []
        if (res.data.data.company_id) {
          promises.push(
            companyService.getById(res.data.data.company_id)
              .then(r => setCompanyName(r.data.data.company_name))
              .catch(() => setCompanyName('Not available'))
          )
        }
        if (res.data.data.manager_id) {
          promises.push(
            api.get<{ success: boolean; data: { full_name: string } }>(`/employees/${res.data.data.manager_id}`)
              .then(r => setManagerName(r.data.data.full_name))
              .catch(() => setManagerName('Not assigned'))
          )
        }
        promises.push(
          api.get<{ success: boolean; data: Employee[] }>(`/employees?limit=1000`)
            .then(r => {
              const allEmps = r.data.data || []
              const filtered = allEmps.filter((emp: any) => emp.branch_id === id)
              setEmployees(filtered)
            })
            .catch(() => {
              setEmployees([])
            })
        )
        await Promise.all(promises)
      } catch (error) {
        console.error('Failed to fetch branch:', error)
        setError('Failed to load branch details. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchBranch()
  }, [id])

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this branch? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      await branchService.delete(id!)
      navigate('/branches', { 
        state: { message: 'Branch deleted successfully' } 
      })
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Failed to delete branch. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'maintenance': return 'bg-yellow-100 text-yellow-800'
      case 'closed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading branch details...</p>
        </div>
      </div>
    )
  }

  if (!branch) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h2>
          <p className="text-gray-600 mb-6">The branch you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate('/branches')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Branches
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/branches')}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                <ArrowLeft className="h-5 w-5" />
                Back
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{branch.branch_name}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <Building className="h-4 w-4" />
                  <span>{branch.branch_code}</span>
                  <span>•</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(branch.status)}`}>
                    {branch.status}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/branches/${id}/edit`)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Edit2 className="h-5 w-5" />
                Edit Branch
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-2.5 rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700 flex-1">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 p-1"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Tabs & Details */}
          <div className="lg:col-span-2">
            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex-1 px-6 py-4 text-lg font-medium transition-all duration-200 ${
                    activeTab === 'details'
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Branch Details
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('employees')}
                  className={`flex-1 px-6 py-4 text-lg font-medium transition-all duration-200 ${
                    activeTab === 'employees'
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Users className="h-5 w-5" />
                    Employees
                    <span className="bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full">
                      {employees.length}
                      
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('map')}
                  
                  className={`flex-1 px-6 py-4 text-lg font-medium transition-all duration-200 ${
                    activeTab === 'map'
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'details' && (
                  <div className="space-y-8">
                    {/* Basic Information Card */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Building className="h-5 w-5 text-blue-600" />
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                              <Briefcase className="h-4 w-4" />
                              Company
                            </p>
                            <p className="text-lg font-semibold text-gray-900">{companyName || 'Not assigned'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                              <User className="h-4 w-4" />
                              Branch Manager
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {managerName || 'Not assigned'}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Branch Code</p>
                            <p className="text-lg font-semibold text-gray-900 bg-white px-3 py-2 rounded-lg inline-block">
                              {branch.branch_code}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Status</p>
                            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(branch.status)}`}>
                              {branch.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <PhoneCall className="h-5 w-5 text-blue-600" />
                        Contact Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Phone className="h-4 w-4" />
                            <span className="text-sm">Phone</span>
                          </div>
                          <p className="text-lg font-semibold text-gray-900">{branch.phone || 'Not available'}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Smartphone className="h-4 w-4" />
                            <span className="text-sm">WhatsApp</span>
                          </div>
                          <p className="text-lg font-semibold text-gray-900">{branch.whatsapp || 'Not available'}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail className="h-4 w-4" />
                            <span className="text-sm">Email</span>
                          </div>
                          <p className="text-lg font-semibold text-gray-900">{branch.email || 'Not available'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Address Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        Address
                      </h3>
                      <div className="space-y-6">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Full Address</p>
                          <p className="text-lg font-semibold text-gray-900">{branch.address}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">City</p>
                            <p className="text-lg font-semibold text-gray-900">{branch.city}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">Province</p>
                            <p className="text-lg font-semibold text-gray-900">{branch.province}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">Country</p>
                            <p className="text-lg font-semibold text-gray-900">{branch.country}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">Postal Code</p>
                            <p className="text-lg font-semibold text-gray-900">{branch.postal_code || 'N/A'}</p>
                          </div>
                        </div>
                        {(branch.latitude && branch.longitude) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <p className="text-sm text-gray-600">Latitude</p>
                              <p className="font-mono text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{branch.latitude}</p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm text-gray-600">Longitude</p>
                              <p className="font-mono text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{branch.longitude}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Additional Notes */}
                    {branch.notes && (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <FileText className="h-5 w-5 text-blue-600" />
                          Additional Notes
                        </h3>
                        <p className="text-gray-700 bg-white p-4 rounded-lg border border-gray-200">
                          {branch.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'employees' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Branch Employees</h3>
                      <span className="text-sm text-gray-600">
                        Total: {employees.length} employee{employees.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    {employees.length > 0 ? (
                      <div className="space-y-6">
                        {(() => {
                          const groupedEmployees = employees.reduce((acc, emp) => {
                            const position = emp.job_position || 'Unassigned'
                            if (!acc[position]) acc[position] = []
                            acc[position].push(emp)
                            return acc
                          }, {} as Record<string, Employee[]>)
                          
                          const sortedPositions = Object.keys(groupedEmployees).sort()
                          
                          return sortedPositions.map((position) => (
                            <div key={position}>
                              <h4 className="text-sm font-semibold text-blue-900 bg-blue-50 px-4 py-2 rounded-lg mb-3">
                                {position} ({groupedEmployees[position].length})
                              </h4>
                              <div className="space-y-3">
                                {groupedEmployees[position].map((emp) => (
                                  <div
                                    key={emp.id}
                                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all duration-200"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-semibold">
                                          {emp.full_name.charAt(0)}
                                        </div>
                                        <div>
                                          <h4 className="font-semibold text-gray-900 hover:text-blue-600 cursor-pointer"
                                              onClick={() => navigate(`/employees/${emp.id}`)}>
                                            {emp.full_name}
                                          </h4>
                                          <p className="text-sm text-gray-500">{emp.employee_id}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        {emp.email && (
                                          <a
                                            href={`mailto:${emp.email}`}
                                            className="text-gray-600 hover:text-blue-600 transition-colors duration-200"
                                            title="Send Email"
                                          >
                                            <Mail className="h-5 w-5" />
                                          </a>
                                        )}
                                        <button
                                          onClick={() => navigate(`/employees/${emp.id}`)}
                                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                                        >
                                          View Details
                                          <ChevronRight className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Employees Found</h3>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                          This branch doesn't have any assigned employees yet.
                        </p>
                        <button
                          onClick={() => setShowAssignModal(true)}
                          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors duration-200"
                        >
                          <User className="h-5 w-5" />
                          Add Employee to Branch
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Quick Actions & Summary */}
          <div className="space-y-8">
            {/* Quick Actions Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors duration-200 border border-gray-200 hover:border-blue-300"
                >
                  <User className="h-5 w-5" />
                  <span className="font-medium">Add Existing Employee</span>
                </button>
              </div>
            </div>

            {/* Branch Summary Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Branch Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(branch.status)}`}>
                    {branch.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Employees</span>
                  <span className="text-2xl font-bold text-gray-900">{employees.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Branch Code</span>
                  <span className="font-mono font-semibold text-gray-900">{branch.branch_code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">City</span>
                  <span className="font-semibold text-gray-900">{branch.city}</span>
                </div>
              </div>
            </div>

            {/* Contact Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact</h3>
              <div className="space-y-4">
                {branch.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <a href={`tel:${branch.phone}`} className="font-semibold text-gray-900 hover:text-blue-600">
                        {branch.phone}
                      </a>
                    </div>
                  </div>
                )}
                {branch.whatsapp && (
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">WhatsApp</p>
                      <a 
                        href={`https://wa.me/${branch.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {branch.whatsapp}
                      </a>
                    </div>
                  </div>
                )}
                {branch.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <a href={`mailto:${branch.email}`} className="font-semibold text-gray-900 hover:text-blue-600">
                        {branch.email}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Operating Hours Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Operating Hours
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Open</span>
                  <span className="font-semibold text-gray-900">{branch.jam_buka}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Close</span>
                  <span className="font-semibold text-gray-900">{branch.jam_tutup}</span>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-600">Days</p>
                  <p className="font-semibold text-gray-900">{branch.hari_operasional}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AssignEmployeeToBranchModal
        isOpen={showAssignModal}
        branchId={id!}
        branchName={branch?.branch_name || ''}
        onClose={() => setShowAssignModal(false)}
        onSuccess={() => {
          setShowAssignModal(false)
          if (id) {
            api.get<{ success: boolean; data: Employee[] }>(`/employees?limit=1000`)
              .then(r => {
                const allEmps = r.data.data || []
                const filtered = allEmps.filter((emp: any) => emp.branch_id === id)
                setEmployees(filtered)
              })
              .catch(() => setEmployees([]))
          }
        }}
      />
    </div>
  )
}

export default BranchDetailPage