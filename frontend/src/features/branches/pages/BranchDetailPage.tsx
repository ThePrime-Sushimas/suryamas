import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { branchesApi } from '../api/branches.api'
import { employeeBranchesApi } from '@/features/employee_branches/api/employeeBranches.api'
import type { Branch } from '../types'
import api from '@/lib/axios'
import AssignEmployeeToBranchModal from '@/components/AssignEmployeeToBranchModal'
import { useToast } from '@/contexts/ToastContext'
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
  Building2,
  ChevronDown,
  ChevronUp,
  X,
  Menu
} from 'lucide-react'

interface EmployeeBranchAssignment {
  employee_id: string
  employee_name: string
  job_position: string
  email: string
  mobile_phone: string
}

interface Employee {
  id: string
  employee_id: string
  full_name: string
  job_position: string
  email: string | null
  department?: string
  mobile_phone?: string
  avatar_url?: string
}

function BranchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [managerName, setManagerName] = useState<string>('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeTab, setActiveTab] = useState<'details' | 'employees'>('details')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [positionPages, setPositionPages] = useState<Record<string, number>>({})
  const [expandedPositions, setExpandedPositions] = useState<Record<string, boolean>>({})
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    contact: true,
    address: true,
    hours: false,
    notes: false
  })
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [deletingEmployee, setDeletingEmployee] = useState<string | null>(null)
  const { success, error: showError } = useToast()

  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    const fetchBranch = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await branchesApi.getById(id!)
        setBranch(data)
        
        const promises = []
        if (data.company_id) {
          promises.push(
            api.get<{ success: boolean; data: { company_name: string } }>(`/companies/${data.company_id}`)
              .then((r) => setCompanyName(r.data.data.company_name))
              .catch(() => setCompanyName('Not available'))
          )
        }
        if (data.manager_id) {
          promises.push(
            api.get<{ success: boolean; data: { full_name: string } }>(`/employees/${data.manager_id}`)
              .then((r) => setManagerName(r.data.data.full_name))
              .catch(() => setManagerName('Not assigned'))
          )
        }
        promises.push(
          api.get<{ success: boolean; data: EmployeeBranchAssignment[] }>(`/employee-branches/branch/${id}?page=1&limit=100`)
            .then((r) => {
              const assignments = r.data.data || []
              const emps = assignments
                .map((assignment) => ({
                  id: assignment.employee_id,
                  employee_id: assignment.employee_id,
                  full_name: assignment.employee_name,
                  job_position: assignment.job_position,
                  email: assignment.email,
                  mobile_phone: assignment.mobile_phone
                }))
                .filter((emp) => emp.full_name)
              setEmployees(emps)
            })
            .catch(() => setEmployees([]))
        )
        await Promise.all(promises)
      } catch (err) {
        console.error('Failed to fetch branch:', err)
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
      await branchesApi.delete(id!)
      success('Branch deleted successfully')
      navigate('/branches')
    } catch (err) {
      console.error('Delete failed:', err)
      showError('Failed to delete branch. Please try again.')
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleRemoveEmployee = async (employeeId: string, employeeName: string) => {
    if (!confirm(`Hapus ${employeeName} dari cabang ini?`)) return

    setDeletingEmployee(employeeId)
    try {
      await employeeBranchesApi.removeByEmployeeAndBranch(employeeId, id!)
      setEmployees(prev => prev.filter(emp => emp.employee_id !== employeeId))
      success('Employee berhasil dihapus dari cabang')
    } catch (err) {
      console.error('Failed to remove employee:', err)
      showError('Gagal menghapus employee dari cabang')
    } finally {
      setDeletingEmployee(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading branch details...</p>
        </div>
      </div>
    )
  }

  if (!branch) {
    return (
      <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Branch Not Found</h2>
          <p className="text-gray-600 mb-6">The branch you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate('/branches')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors duration-200 w-full justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Branches
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/branches')}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold text-gray-900 truncate">{branch.branch_name}</h1>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Building className="h-3 w-3" />
                  <span className="truncate">{branch.branch_code}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/branches/${id}/edit`)}
                className="p-2 text-blue-600 hover:text-blue-700"
              >
                <Edit2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Action Menu */}
        {showMobileMenu && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
            <div className="px-4 py-3 space-y-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
              >
                {deleting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
                Delete Branch
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block bg-white border-b border-gray-200">
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
                className="inline-flex items-center gap-2 bg-linear-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Edit2 className="h-5 w-5" />
                Edit Branch
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 bg-linear-to-r from-red-600 to-red-700 text-white px-6 py-2.5 rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-4 lg:mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="text-red-700 flex-1 text-sm lg:text-base">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 p-1 shrink-0"
            >
              ×
            </button>
          </div>
        )}

        {/* Mobile Tab Navigation */}
        <div className="lg:hidden bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 ${
                activeTab === 'details'
                  ? 'bg-linear-to-r from-blue-50 to-blue-100 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Building2 className="h-4 w-4" />
                Details
              </div>
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 ${
                activeTab === 'employees'
                  ? 'bg-linear-to-r from-blue-50 to-blue-100 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="h-4 w-4" />
                Employees
                <span className="bg-gray-200 text-gray-800 text-xs px-1.5 py-0.5 rounded-full">
                  {employees.length}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Left Column - Tabs & Details */}
          <div className="lg:col-span-2">
            {/* Desktop Tab Navigation */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex-1 px-6 py-4 text-lg font-medium transition-all duration-200 ${
                    activeTab === 'details'
                      ? 'bg-linear-to-r from-blue-50 to-blue-100 text-blue-700 border-b-2 border-blue-600'
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
                      ? 'bg-linear-to-r from-blue-50 to-blue-100 text-blue-700 border-b-2 border-blue-600'
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
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'details' ? (
                  <div className="space-y-8">
                    {/* Basic Information Card */}
                    <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
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
                        {/* {(branch.latitude && branch.longitude) && (
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
                        )} */}
                      </div>
                    </div>

                    {/* Additional Notes */}
                    {branch.notes && (
                      <div className="bg-linear-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200 p-6">
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
                ) : (
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
                          
                          return sortedPositions.map((position) => {
                            const positionEmployees = groupedEmployees[position]
                            const currentPage = positionPages[position] || 1
                            const totalPages = Math.ceil(positionEmployees.length / ITEMS_PER_PAGE)
                            const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
                            const paginatedEmployees = positionEmployees.slice(startIdx, startIdx + ITEMS_PER_PAGE)
                            const isExpanded = expandedPositions[position] ?? false
                            
                            return (
                              <div key={position} className="border border-gray-200 rounded-xl overflow-hidden">
                                <button
                                  onClick={() => setExpandedPositions(prev => ({ ...prev, [position]: !isExpanded }))}
                                  className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
                                >
                                  <h4 className="text-sm font-semibold text-blue-900">
                                    {position} ({positionEmployees.length})
                                  </h4>
                                  <div className="flex items-center gap-3">
                                    {isExpanded && totalPages > 1 && (
                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <div
                                          onClick={() => setPositionPages(prev => ({ ...prev, [position]: Math.max(1, currentPage - 1) }))}
                                          className={`px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-white cursor-pointer select-none ${
                                            currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                                          }`}
                                        >
                                          Previous
                                        </div>
                                        <span className="text-sm text-gray-600">
                                          {currentPage} / {totalPages}
                                        </span>
                                        <div
                                          onClick={() => setPositionPages(prev => ({ ...prev, [position]: Math.min(totalPages, currentPage + 1) }))}
                                          className={`px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-white cursor-pointer select-none ${
                                            currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''
                                          }`}
                                        >
                                          Next
                                        </div>
                                      </div>
                                    )}
                                    {isExpanded ? (
                                      <ChevronUp className="h-5 w-5 text-blue-900" />
                                    ) : (
                                      <ChevronDown className="h-5 w-5 text-blue-900" />
                                    )}
                                  </div>
                                </button>
                                {isExpanded && (
                                  <div className="p-4 space-y-3 bg-white">
                                    {paginatedEmployees.map((emp) => (
                                      <div
                                        key={emp.id}
                                        className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all duration-200"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-semibold">
                                              {emp.full_name?.[0] || '?'}
                                            </div>
                                            <div>
                                              <h4 className="font-semibold text-gray-900 hover:text-blue-600 cursor-pointer"
                                                  onClick={() => navigate(`/employees/${emp.id}`)}>
                                                {emp.full_name}
                                              </h4>
                                              <p className="text-sm text-gray-500">{emp.job_position || 'Unassigned' }</p>  
                                              <p className="text-sm text-gray-500">{emp.mobile_phone}</p>
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
                                              onClick={() => handleRemoveEmployee(emp.employee_id, emp.full_name)}
                                              disabled={deletingEmployee === emp.employee_id}
                                              className="text-red-600 hover:text-red-700 transition-colors duration-200 disabled:opacity-50"
                                              title="Remove from branch"
                                            >
                                              {deletingEmployee === emp.employee_id ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                              ) : (
                                                <Trash2 className="h-5 w-5" />
                                              )}
                                            </button>
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
                                )}
                              </div>
                            )
                          })
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

            {/* Mobile Content (without tabs wrapper) */}
            <div className="lg:hidden">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  {/* Basic Information Card - Mobile Accordion */}
                  <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <button
                      onClick={() => toggleSection('basic')}
                      className="w-full flex items-center justify-between"
                    >
                      <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Building className="h-4 w-4 text-blue-600" />
                        Basic Information
                      </h3>
                      {expandedSections.basic ? (
                        <ChevronUp className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                    
                    {expandedSections.basic && (
                      <div className="mt-4 grid grid-cols-1 gap-4">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              Company
                            </p>
                            <p className="text-sm font-semibold text-gray-900">{companyName || 'Not assigned'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Branch Manager
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                              {managerName || 'Not assigned'}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Branch Code</p>
                            <p className="text-sm font-semibold text-gray-900 bg-white px-3 py-2 rounded-lg inline-block">
                              {branch.branch_code}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Status</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(branch.status)}`}>
                              {branch.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contact Information Card - Mobile Accordion */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <button
                      onClick={() => toggleSection('contact')}
                      className="w-full flex items-center justify-between"
                    >
                      <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <PhoneCall className="h-4 w-4 text-blue-600" />
                        Contact Information
                      </h3>
                      {expandedSections.contact ? (
                        <ChevronUp className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                    
                    {expandedSections.contact && (
                      <div className="mt-4 grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Phone className="h-3 w-3" />
                            <span className="text-xs">Phone</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{branch.phone || 'Not available'}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Smartphone className="h-3 w-3" />
                            <span className="text-xs">WhatsApp</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{branch.whatsapp || 'Not available'}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail className="h-3 w-3" />
                            <span className="text-xs">Email</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{branch.email || 'Not available'}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Address Card - Mobile Accordion */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <button
                      onClick={() => toggleSection('address')}
                      className="w-full flex items-center justify-between"
                    >
                      <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        Address
                      </h3>
                      {expandedSections.address ? (
                        <ChevronUp className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                    
                    {expandedSections.address && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Full Address</p>
                          <p className="text-sm font-semibold text-gray-900">{branch.address}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600">City</p>
                            <p className="text-sm font-semibold text-gray-900">{branch.city}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600">Province</p>
                            <p className="text-sm font-semibold text-gray-900">{branch.province}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600">Country</p>
                            <p className="text-sm font-semibold text-gray-900">{branch.country}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600">Postal Code</p>
                            <p className="text-sm font-semibold text-gray-900">{branch.postal_code || 'N/A'}</p>
                          </div>
                        </div>                       
                      </div>
                    )}
                  </div>

                  {/* Additional Notes - Mobile Accordion */}
                  {branch.notes && (
                    <div className="bg-linear-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-4">
                      <button
                        onClick={() => toggleSection('notes')}
                        className="w-full flex items-center justify-between"
                      >
                        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          Additional Notes
                        </h3>
                        {expandedSections.notes ? (
                          <ChevronUp className="h-4 w-4 text-gray-600" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-600" />
                        )}
                      </button>
                      
                      {expandedSections.notes && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-700 bg-white p-4 rounded-lg border border-gray-200">
                            {branch.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'employees' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-900">Branch Employees</h3>
                    <span className="text-xs text-gray-600">
                      Total: {employees.length}
                    </span>
                  </div>
                  
                  {employees.length > 0 ? (
                    <div className="space-y-4">
                      {(() => {
                        const groupedEmployees = employees.reduce((acc, emp) => {
                          const position = emp.job_position || 'Unassigned'
                          if (!acc[position]) acc[position] = []
                          acc[position].push(emp)
                          return acc
                        }, {} as Record<string, Employee[]>)
                        
                        const sortedPositions = Object.keys(groupedEmployees).sort()
                        
                        return sortedPositions.map((position) => {
                          const positionEmployees = groupedEmployees[position]
                          const currentPage = positionPages[position] || 1
                          const totalPages = Math.ceil(positionEmployees.length / ITEMS_PER_PAGE)
                          const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
                          const paginatedEmployees = positionEmployees.slice(startIdx, startIdx + ITEMS_PER_PAGE)
                          const isExpanded = expandedPositions[position] ?? true
                          
                          return (
                            <div key={position} className="border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => setExpandedPositions(prev => ({ ...prev, [position]: !isExpanded }))}
                                className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 transition-colors"
                              >
                                <h4 className="text-xs font-semibold text-blue-900">
                                  {position} ({positionEmployees.length})
                                </h4>
                                <div className="flex items-center gap-2">
                                  {isExpanded && totalPages > 1 && (
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <div
                                        onClick={() => setPositionPages(prev => ({ ...prev, [position]: Math.max(1, currentPage - 1) }))}
                                        className={`px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white cursor-pointer select-none ${
                                          currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                      >
                                        Prev
                                      </div>
                                      <span className="text-xs text-gray-600">
                                        {currentPage}/{totalPages}
                                      </span>
                                      <div
                                        onClick={() => setPositionPages(prev => ({ ...prev, [position]: Math.min(totalPages, currentPage + 1) }))}
                                        className={`px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white cursor-pointer select-none ${
                                          currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                      >
                                        Next
                                      </div>
                                    </div>
                                  )}
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-blue-900" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-blue-900" />
                                  )}
                                </div>
                              </button>
                              {isExpanded && (
                                <div className="p-3 space-y-2 bg-white">
                                  {paginatedEmployees.map((emp) => (
                                    <div
                                      key={emp.id}
                                      className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all duration-200"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="h-10 w-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                                            {emp.full_name?.[0] || '?'}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <h4 
                                              className="text-sm font-semibold text-gray-900 hover:text-blue-600 cursor-pointer truncate"
                                              onClick={() => navigate(`/employees/${emp.id}`)}
                                            >
                                              {emp.full_name}
                                            </h4>
                                            <p className="text-xs text-gray-500 truncate">{emp.job_position || 'Unassigned'}</p>
                                            <p className="text-xs text-gray-500 truncate">{emp.employee_id}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {emp.email && (
                                            <a
                                              href={`mailto:${emp.email}`}
                                              className="text-gray-600 hover:text-blue-600 transition-colors duration-200 p-1"
                                              title="Send Email"
                                            >
                                              <Mail className="h-4 w-4" />
                                            </a>
                                          )}
                                          <button
                                            onClick={() => handleRemoveEmployee(emp.employee_id, emp.full_name)}
                                            disabled={deletingEmployee === emp.employee_id}
                                            className="text-red-600 hover:text-red-700 transition-colors duration-200 p-1 disabled:opacity-50"
                                            title="Remove from branch"
                                          >
                                            {deletingEmployee === emp.employee_id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-4 w-4" />
                                            )}
                                          </button>
                                          <button
                                            onClick={() => navigate(`/employees/${emp.id}`)}
                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium p-1"
                                          >
                                            View
                                            <ChevronRight className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-gray-900 mb-2">No Employees Found</h3>
                      <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                        This branch doesn't have any assigned employees yet.
                      </p>
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors duration-200 text-sm"
                      >
                        <User className="h-4 w-4" />
                        Add Employee to Branch
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Quick Actions & Summary */}
          <div className="space-y-4 lg:space-y-8">
            {/* Mobile Quick Actions Card */}
            <div className="lg:hidden bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors duration-200 border border-gray-200 hover:border-blue-300"
                >
                  <User className="h-4 w-4" />
                  <span className="font-medium text-sm">Add Existing Employee</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors duration-200 border border-gray-200 hover:border-blue-300"
                >
                  <FileText className="h-4 w-4" />
                  <span className="font-medium text-sm">Print Details</span>
                </button>
              </div>
            </div>

            {/* Desktop Quick Actions Card */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
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
            <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-xl lg:rounded-2xl border border-blue-200 p-4 lg:p-6">
              <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Branch Summary</h3>
              <div className="space-y-3 lg:space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-gray-600">Status</span>
                  <span className={`px-2 py-1 lg:px-3 lg:py-1 rounded-full text-xs lg:text-sm font-medium ${getStatusColor(branch.status)}`}>
                    {branch.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-gray-600">Total Employees</span>
                  <span className="text-xl lg:text-2xl font-bold text-gray-900">{employees.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-gray-600">Branch Code</span>
                  <span className="font-mono text-sm lg:text-base font-semibold text-gray-900">{branch.branch_code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-gray-600">City</span>
                  <span className="text-sm lg:text-base font-semibold text-gray-900">{branch.city}</span>
                </div>
              </div>
            </div>
            {/* Operating Hours Card */}
            <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
              <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 lg:h-5 lg:w-5" />
                Operating Hours
              </h3>
              <div className="space-y-1 lg:space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-gray-600">Open</span>
                  <span className="text-sm lg:text-base font-semibold text-gray-900">{branch.jam_buka}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-gray-600">Close</span>
                  <span className="text-sm lg:text-base font-semibold text-gray-900">{branch.jam_tutup}</span>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs lg:text-sm text-gray-600">Days</p>
                  <p className="text-sm lg:text-base font-semibold text-gray-900">{branch.hari_operasional}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Action Button */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowAssignModal(true)}
          className="bg-linear-to-r from-blue-600 to-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
        >
          <User className="h-6 w-6" />
        </button>
      </div>

      <AssignEmployeeToBranchModal
        isOpen={showAssignModal}
        branchId={id!}
        branchName={branch?.branch_name || ''}
        onClose={() => setShowAssignModal(false)}
        onSuccess={() => {
          setShowAssignModal(false)
          if (id) {
            api.get<{ success: boolean; data: EmployeeBranchAssignment[] }>(`/employee-branches/branch/${id}?page=1&limit=100`)
              .then((r) => {
                const assignments = r.data.data || []
                const emps = assignments
                  .map((assignment) => ({
                    id: assignment.employee_id,
                    employee_id: assignment.employee_id,
                    full_name: assignment.employee_name,
                    job_position: assignment.job_position,
                    email: assignment.email,
                    mobile_phone: assignment.mobile_phone
                  }))
                  .filter((emp) => emp.full_name)
                setEmployees(emps)
              })
              .catch(() => setEmployees([]))
          }
        }}
      />
    </div>
  )
}

export default BranchDetailPage
