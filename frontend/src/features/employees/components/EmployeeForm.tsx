import { useState } from 'react'
import { employeeFormSchema } from '../schemas/employee.schema'
import type { EmployeeFormData } from '../types'
import { ZodError } from 'zod'

interface EmployeeFormProps {
  initialData?: Partial<EmployeeFormData>
  onSubmit: (data: EmployeeFormData, file?: File) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  submitLabel?: string
}

const defaultFormData: EmployeeFormData = {
  employee_id: '',
  full_name: '',
  job_position: '',
  brand_name: '',
  ptkp_status: 'TK/0',
  status_employee: 'Permanent',
  join_date: '',
  sign_date: '',
  end_date: '',
  email: '',
  mobile_phone: '',
  nik: '',
  birth_date: '',
  birth_place: '',
  citizen_id_address: '',
  religion: undefined,
  gender: undefined,
  marital_status: undefined,
  bank_name: '',
  bank_account: '',
  bank_account_holder: '',
}

export default function EmployeeForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  submitLabel = 'Submit'
}: EmployeeFormProps) {
  const [formData, setFormData] = useState<EmployeeFormData>({ ...defaultFormData, ...initialData })
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setErrors({})
    setIsSubmitting(true)

    try {
      const validated = employeeFormSchema.parse(formData)
      await onSubmit(validated, profilePicture || undefined)
      setFormData(defaultFormData)
      setProfilePicture(null)
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {}
        err.errors.forEach(error => {
          if (error.path[0]) {
            fieldErrors[error.path[0] as string] = error.message
          }
        })
        setErrors(fieldErrors)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const ErrorMessage = ({ field }: { field: string }) => 
    errors[field] ? <p className="text-red-600 text-sm mt-1">{errors[field]}</p> : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      {/* Basic Info */}
      <div className="border-b border-gray-200 pb-4 md:pb-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700">
              Employee ID <span className="text-gray-400">(Auto-generated)</span>
            </label>
            <input
              type="text"
              name="employee_id"
              value={formData.employee_id}
              onChange={handleChange}
              placeholder="Leave empty for auto-generation"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px] bg-gray-50"
              disabled={!!initialData?.employee_id}
            />
            <ErrorMessage field="employee_id" />
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700">Full Name *</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px]"
            />
            <ErrorMessage field="full_name" />
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700">Job Position *</label>
            <input
              type="text"
              name="job_position"
              value={formData.job_position}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px]"
            />
            <ErrorMessage field="job_position" />
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700">Brand Name *</label>
            <input
              type="text"
              name="brand_name"
              value={formData.brand_name}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px]"
            />
            <ErrorMessage field="brand_name" />
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700">PTKP Status *</label>
            <select
              name="ptkp_status"
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
            <ErrorMessage field="ptkp_status" />
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700">Status *</label>
            <select
              name="status_employee"
              value={formData.status_employee}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm md:text-base min-h-[44px]"
            >
              <option value="Permanent">Permanent</option>
              <option value="Contract">Contract</option>
            </select>
            <ErrorMessage field="status_employee" />
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="border-b border-gray-200 pb-4 md:pb-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Dates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Join Date *</label>
            <input
              type="date"
              name="join_date"
              value={formData.join_date}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <ErrorMessage field="join_date" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Sign Date</label>
            <input
              type="date"
              name="sign_date"
              value={formData.sign_date}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <ErrorMessage field="sign_date" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              End Date {formData.status_employee === 'Contract' && '*'}
            </label>
            <input
              type="date"
              name="end_date"
              value={formData.end_date}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <ErrorMessage field="end_date" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Resign Date</label>
            <input
              type="date"
              name="resign_date"
              value={formData.resign_date}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <ErrorMessage field="resign_date" />
          </div>
        </div>
      </div>

      {/* Personal Info */}
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
            <ErrorMessage field="nik" />
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
            <ErrorMessage field="birth_date" />
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
            <ErrorMessage field="birth_place" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Gender</label>
            <select
              name="gender"
              value={formData.gender || ''}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <ErrorMessage field="gender" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Religion</label>
            <select
              name="religion"
              value={formData.religion || ''}
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
            <ErrorMessage field="religion" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Marital Status</label>
            <select
              name="marital_status"
              value={formData.marital_status || ''}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Select...</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Divorced">Divorced</option>
              <option value="Widow">Widow</option>
            </select>
            <ErrorMessage field="marital_status" />
          </div>
        </div>
      </div>

      {/* Contact */}
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
            <ErrorMessage field="email" />
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
            <ErrorMessage field="mobile_phone" />
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
            <ErrorMessage field="citizen_id_address" />
          </div>
        </div>
      </div>

      {/* Banking */}
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
            <ErrorMessage field="bank_name" />
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
            <ErrorMessage field="bank_account" />
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
            <ErrorMessage field="bank_account_holder" />
          </div>
        </div>
      </div>

      {/* Profile Picture */}
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

      {/* Actions */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base min-h-[44px]"
        >
          {isSubmitting || isLoading ? 'Processing...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting || isLoading}
          className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 disabled:opacity-50 text-sm md:text-base min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
