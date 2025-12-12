import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEmployeeStore } from '../../stores/employeeStore'
import api from '../../lib/axios'
import type { Employee, ApiResponse } from '../../types'

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isLoading } = useEmployeeStore()
  const [error, setError] = useState('')
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true)
  const [formData, setFormData] = useState({
    full_name: '',
    job_position: '',
    branch_name: '',
    parent_branch_name: '',
    ptkp_status: 'TK/0' as const,
    status_employee: 'Permanent' as 'Permanent' | 'Contract',
    join_date: '',
    sign_date: '',
    end_date: '',
    email: '',
    mobile_phone: '',
    nik: '',
    birth_date: '',
    birth_place: '',
    citizen_id_address: '',
    religion: '',
    gender: '',
    marital_status: '',
    bank_name: '',
    bank_account: '',
    bank_account_holder: '',
  })
  const [profilePicture, setProfilePicture] = useState<File | null>(null)

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const { data } = await api.get<ApiResponse<Employee>>(`/employees/${id}`)
        const emp = data.data
        setFormData({
          full_name: emp.full_name,
          job_position: emp.job_position,
          branch_name: emp.branch_name,
          parent_branch_name: emp.parent_branch_name || '',
          ptkp_status: emp.ptkp_status as any,
          status_employee: emp.status_employee as any,
          join_date: emp.join_date ? emp.join_date.split('T')[0] : '',
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
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load employee')
      } finally {
        setIsLoadingEmployee(false)
      }
    }
    fetchEmployee()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const formDataObj = new FormData()
      Object.entries(formData).forEach(([key, value]) => {
        formDataObj.append(key, value as string)
      })
      if (profilePicture) {
        formDataObj.append('profile_picture', profilePicture)
      }
      
      await api.put(`/employees/${id}`, formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      alert('Employee updated successfully!')
      navigate('/employees')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update employee')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  if (isLoadingEmployee) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow rounded-lg p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Edit Employee</h1>
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm md:text-base">{error}</div>
          )}
          
          {/* Basic Info Section */}
          <div className="border-b border-gray-200 pb-4 md:pb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700">Full Name *</label>
              <input
                type="text"
                name="full_name"
                required
                value={formData.full_name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700">Job Position *</label>
              <input
                type="text"
                name="job_position"
                required
                value={formData.job_position}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700">Branch *</label>
              <input
                type="text"
                name="branch_name"
                required
                value={formData.branch_name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700">PTKP Status *</label>
              <select
                name="ptkp_status"
                required
                value={formData.ptkp_status}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px]"
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
              <label className="block text-xs md:text-sm font-medium text-gray-700">Status *</label>
              <select
                name="status_employee"
                required
                value={formData.status_employee}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px]"
              >
                <option value="Permanent">Permanent</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700">Parent Branch</label>
                <input
                  type="text"
                  name="parent_branch_name"
                  value={formData.parent_branch_name}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {/* Dates Section */}
          <div className="border-b border-gray-200 pb-4 md:pb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Dates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
                <label className="block text-sm font-medium text-gray-700">Contract Sign Date</label>
                <input
                  type="date"
                  name="sign_date"
                  value={formData.sign_date}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contract End Date</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Personal Info Section */}
          <div className="border-b border-gray-200 pb-4 md:pb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">NIK</label>
                <input
                  type="text"
                  name="nik"
                  value={formData.nik}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Birth Date</label>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Birth Place</label>
                <input
                  type="text"
                  name="birth_place"
                  value={formData.birth_place}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
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
          </div>

          {/* Contact Section */}
          <div className="border-b border-gray-200 pb-4 md:pb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mobile Phone</label>
                <input
                  type="text"
                  name="mobile_phone"
                  value={formData.mobile_phone}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Address (KTP)</label>
                <textarea
                  name="citizen_id_address"
                  value={formData.citizen_id_address}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Banking Section */}
          <div className="border-b border-gray-200 pb-4 md:pb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Banking Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Bank Name</label>
              <input
                type="text"
                name="bank_name"
                value={formData.bank_name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bank Account</label>
                <input
                  type="text"
                  name="bank_account"
                  value={formData.bank_account}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Bank Account Holder</label>
                <input
                  type="text"
                  name="bank_account_holder"
                  value={formData.bank_account_holder}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Profile Picture Section */}
          <div className="pb-4 md:pb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Profile Picture</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700">Upload Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProfilePicture(e.target.files?.[0] || null)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              {profilePicture && (
                <p className="text-sm text-gray-500 mt-1">Selected: {profilePicture.name}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2 md:gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm md:text-base min-h-[44px]"
            >
              {isLoading ? 'Updating...' : 'Update Employee'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/employees')}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 text-sm md:text-base min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
