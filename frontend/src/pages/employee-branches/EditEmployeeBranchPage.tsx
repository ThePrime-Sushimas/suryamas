import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { employeeBranchService } from '@/services/employeeBranchService'
import { employeeService } from '@/services/employeeService'
import { branchService } from '@/services/branchService'
import type { EmployeeBranch } from '@/types/employeeBranch'

export function EditEmployeeBranchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [, setData] = useState<EmployeeBranch | null>(null)
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string }>>([])
  const [branches, setBranches] = useState<Array<{ id: string; branch_name: string; branch_code: string }>>([])
  const [formData, setFormData] = useState({
    employee_id: '',
    branch_id: '',
    is_primary: false
  })
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [branchSearch, setBranchSearch] = useState('')
  const [showEmployeeList, setShowEmployeeList] = useState(false)
  const [showBranchList, setShowBranchList] = useState(false)

  useEffect(() => {
    loadData()
    loadEmployees()
    loadBranches()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await employeeBranchService.getById(id!)
      setData(response.data.data)
      setFormData({
        employee_id: response.data.data.employee_id,
        branch_id: response.data.data.branch_id,
        is_primary: response.data.data.is_primary
      })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load assignment')
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async () => {
    try {
      const response = await employeeService.autocomplete('')
      setEmployees(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Failed to load employees:', error)
    }
  }

  const loadBranches = async () => {
    try {
      const response = await branchService.list(1, 10000)
      setBranches(response.data.data.map(b => ({ id: b.id, branch_name: b.branch_name, branch_code: b.branch_code })))
    } catch (error) {
      console.error('Failed to load branches:', error)
    }
  }


  const selectedEmployee = employees.find(e => e.id === formData.employee_id)
  const selectedBranch = branches.find(b => b.id === formData.branch_id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!formData.employee_id || !formData.branch_id) {
      setError('Please select both employee and branch')
      return
    }

    try {
      setSubmitting(true)
      await employeeBranchService.update(id!, {
        is_primary: formData.is_primary
      })
      alert('Assignment updated successfully!')
      navigate('/employee-branches')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update assignment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/employee-branches')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Edit Assignment</h1>
            <p className="text-gray-600 mt-1">Update employee branch assignment</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Employee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
              <div className="relative">
                <div className="border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={showEmployeeList ? employeeSearch : selectedEmployee?.full_name || ''}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value)
                      setShowEmployeeList(true)
                    }}
                    onFocus={() => setShowEmployeeList(true)}
                    disabled
                    className="w-full outline-none bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Cannot change employee</p>
              </div>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
              <div className="relative">
                <div className="border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                  <input
                    type="text"
                    placeholder="Search branch..."
                    value={showBranchList ? branchSearch : selectedBranch ? `${selectedBranch.branch_name} (${selectedBranch.branch_code})` : ''}
                    onChange={(e) => {
                      setBranchSearch(e.target.value)
                      setShowBranchList(true)
                    }}
                    onFocus={() => setShowBranchList(true)}
                    disabled
                    className="w-full outline-none bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Cannot change branch</p>
              </div>
            </div>

            {/* Primary Branch */}
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                id="is_primary"
                checked={formData.is_primary}
                onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <label htmlFor="is_primary" className="text-sm font-medium text-gray-700 cursor-pointer">
                Set as primary branch for this employee
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate('/employee-branches')}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[44px] font-medium"
              >
                {submitting ? 'Updating...' : 'Update Assignment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
