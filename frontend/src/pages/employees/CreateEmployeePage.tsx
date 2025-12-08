import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeStore } from '../../stores/employeeStore'

export default function CreateEmployeePage() {
  const { createEmployee, isLoading } = useEmployeeStore()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    job_position: '',
    branch_name: '',
    ptkp_status: 'TK/0' as const,
    status_employee: 'Permanent' as 'Permanent' | 'Contract',
    join_date: '',
    religion: '',
    gender: '',
    marital_status: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createEmployee(formData as any)
      alert('Employee created successfully!')
      navigate('/employees')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create employee')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-6">Create New Employee</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee ID *</label>
              <input
                type="text"
                name="employee_id"
                required
                value={formData.employee_id}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name *</label>
              <input
                type="text"
                name="full_name"
                required
                value={formData.full_name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Job Position *</label>
              <input
                type="text"
                name="job_position"
                required
                value={formData.job_position}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Branch *</label>
              <input
                type="text"
                name="branch_name"
                required
                value={formData.branch_name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PTKP Status *</label>
              <select
                name="ptkp_status"
                required
                value={formData.ptkp_status}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="TK/0">TK/0</option>
                <option value="TK/1">TK/1</option>
                <option value="TK/2">TK/2</option>
                <option value="TK/3">TK/3</option>
                <option value="K/0">K/0</option>
                <option value="K/1">K/1</option>
                <option value="K/2">K/2</option>
                <option value="K/3">K/3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status *</label>
              <select
                name="status_employee"
                required
                value={formData.status_employee}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Join Date *</label>
              <input
                type="date"
                name="join_date"
                required
                value={formData.join_date}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Religion</label>
              <select
                name="religion"
                value={formData.religion}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select...</option>
                <option value="Islam">Islam</option>
                <option value="Christian">Christian</option>
                <option value="Catholic">Catholic</option>
                <option value="Hindu">Hindu</option>
                <option value="Buddha">Buddha</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Marital Status</label>
              <select
                name="marital_status"
                value={formData.marital_status}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select...</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widow">Widow</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Employee'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/employees')}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
