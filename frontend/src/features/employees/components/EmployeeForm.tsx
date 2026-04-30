import { useEffect, useState } from 'react'
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

const inputCls = "mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm md:text-base min-h-11 focus:ring-2 focus:ring-blue-500 outline-none"
const labelCls = "block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300"
const sectionCls = "border-b border-gray-200 dark:border-gray-700 pb-4 md:pb-6"
const sectionTitleCls = "text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3 md:mb-4"

export default function EmployeeForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  submitLabel = 'Submit'
}: EmployeeFormProps) {
  const [formData, setFormData] = useState<EmployeeFormData>(() => {
    const initial = { ...defaultFormData }
    if (initialData) Object.assign(initial, initialData)
    return initial
  })
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {  
    if (initialData) setFormData(prev => ({ ...prev, ...initialData }))
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setErrors({})
    setIsSubmitting(true)
    try {
      const validated = employeeFormSchema.parse(formData) as EmployeeFormData
      await onSubmit(validated, profilePicture || undefined)
      setFormData(defaultFormData)
      setProfilePicture(null)
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {}
        err.errors.forEach(error => { if (error.path[0]) fieldErrors[error.path[0] as string] = error.message })
        setErrors(fieldErrors)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const ErrorMessage = ({ field }: { field: string }) => 
    errors[field] ? <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors[field]}</p> : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      {/* Basic Info */}
      <div className={sectionCls}>
        <h3 className={sectionTitleCls}>Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div>
            <label className={labelCls}>Employee ID <span className="text-gray-400">(Auto-generated)</span></label>
            <input type="text" name="employee_id" value={formData.employee_id} onChange={handleChange} placeholder="Leave empty for auto-generation" className={`${inputCls} bg-gray-50 dark:bg-gray-600`} disabled={!!initialData?.employee_id} />
            <ErrorMessage field="employee_id" />
          </div>
          <div>
            <label className={labelCls}>Full Name *</label>
            <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} className={inputCls} />
            <ErrorMessage field="full_name" />
          </div>
          <div>
            <label className={labelCls}>Job Position *</label>
            <input type="text" name="job_position" value={formData.job_position} onChange={handleChange} className={inputCls} />
            <ErrorMessage field="job_position" />
          </div>
          <div>
            <label className={labelCls}>Brand Name *</label>
            <input type="text" name="brand_name" value={formData.brand_name} onChange={handleChange} className={inputCls} />
            <ErrorMessage field="brand_name" />
          </div>
          <div>
            <label className={labelCls}>PTKP Status *</label>
            <select name="ptkp_status" value={formData.ptkp_status} onChange={handleChange} className={inputCls}>
              {['TK/0','TK/1','TK/2','TK/3','K/0','K/1','K/2','K/3'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <ErrorMessage field="ptkp_status" />
          </div>
          <div>
            <label className={labelCls}>Status *</label>
            <select name="status_employee" value={formData.status_employee} onChange={handleChange} className={inputCls}>
              <option value="Permanent">Permanent</option>
              <option value="Contract">Contract</option>
            </select>
            <ErrorMessage field="status_employee" />
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className={sectionCls}>
        <h3 className={sectionTitleCls}>Dates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div><label className={labelCls}>Join Date *</label><input type="date" name="join_date" value={formData.join_date} onChange={handleChange} className={inputCls} /><ErrorMessage field="join_date" /></div>
          <div><label className={labelCls}>Sign Date</label><input type="date" name="sign_date" value={formData.sign_date} onChange={handleChange} className={inputCls} /><ErrorMessage field="sign_date" /></div>
          <div><label className={labelCls}>End Date {formData.status_employee === 'Contract' && '*'}</label><input type="date" name="end_date" value={formData.end_date} onChange={handleChange} className={inputCls} /><ErrorMessage field="end_date" /></div>
          <div><label className={labelCls}>Resign Date</label><input type="date" name="resign_date" value={formData.resign_date} onChange={handleChange} className={inputCls} /><ErrorMessage field="resign_date" /></div>
        </div>
      </div>

      {/* Personal Info */}
      <div className={sectionCls}>
        <h3 className={sectionTitleCls}>Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div><label className={labelCls}>NIK</label><input type="text" name="nik" value={formData.nik} onChange={handleChange} className={inputCls} /><ErrorMessage field="nik" /></div>
          <div><label className={labelCls}>Birth Date</label><input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className={inputCls} /><ErrorMessage field="birth_date" /></div>
          <div><label className={labelCls}>Birth Place</label><input type="text" name="birth_place" value={formData.birth_place} onChange={handleChange} className={inputCls} /><ErrorMessage field="birth_place" /></div>
          <div>
            <label className={labelCls}>Gender</label>
            <select name="gender" value={formData.gender || ''} onChange={handleChange} className={inputCls}>
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <ErrorMessage field="gender" />
          </div>
          <div>
            <label className={labelCls}>Religion</label>
            <select name="religion" value={formData.religion || ''} onChange={handleChange} className={inputCls}>
              <option value="">Select...</option>
              {['Islam','Christian','Catholic','Hindu','Buddha','Other'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <ErrorMessage field="religion" />
          </div>
          <div>
            <label className={labelCls}>Marital Status</label>
            <select name="marital_status" value={formData.marital_status || ''} onChange={handleChange} className={inputCls}>
              <option value="">Select...</option>
              {['Single','Married','Divorced','Widow'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <ErrorMessage field="marital_status" />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className={sectionCls}>
        <h3 className={sectionTitleCls}>Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div><label className={labelCls}>Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} className={inputCls} /><ErrorMessage field="email" /></div>
          <div><label className={labelCls}>Mobile Phone</label><input type="text" name="mobile_phone" value={formData.mobile_phone} onChange={handleChange} className={inputCls} /><ErrorMessage field="mobile_phone" /></div>
          <div className="md:col-span-2"><label className={labelCls}>Address (KTP)</label><textarea name="citizen_id_address" value={formData.citizen_id_address} onChange={handleChange} rows={3} className={inputCls} /><ErrorMessage field="citizen_id_address" /></div>
        </div>
      </div>

      {/* Banking */}
      <div className={sectionCls}>
        <h3 className={sectionTitleCls}>Banking Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div><label className={labelCls}>Bank Name</label><input type="text" name="bank_name" value={formData.bank_name} onChange={handleChange} className={inputCls} /><ErrorMessage field="bank_name" /></div>
          <div><label className={labelCls}>Bank Account</label><input type="text" name="bank_account" value={formData.bank_account} onChange={handleChange} className={inputCls} /><ErrorMessage field="bank_account" /></div>
          <div className="md:col-span-2"><label className={labelCls}>Bank Account Holder</label><input type="text" name="bank_account_holder" value={formData.bank_account_holder} onChange={handleChange} className={inputCls} /><ErrorMessage field="bank_account_holder" /></div>
        </div>
      </div>

      {/* Profile Picture */}
      <div className="pb-4 md:pb-6">
        <h3 className={sectionTitleCls}>Profile Picture</h3>
        <div>
          <label className={labelCls}>Upload Photo</label>
          <input type="file" accept="image/*" onChange={(e) => setProfilePicture(e.target.files?.[0] || null)} className={inputCls} />
          {profilePicture && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Selected: {profilePicture.name}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4">
        <button type="submit" disabled={isSubmitting || isLoading} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base min-h-11">
          {isSubmitting || isLoading ? 'Processing...' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={isSubmitting || isLoading} className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-2 rounded hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50 text-sm md:text-base min-h-11">
          Cancel
        </button>
      </div>
    </form>
  )
}
