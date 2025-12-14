import { useState } from 'react'
import type { Company, CreateCompanyDto, UpdateCompanyDto, CompanyType, CompanyStatus } from '@/types/company'

interface CompanyFormProps {
  initialData?: Company
  isEdit?: boolean
  onSubmit: (data: CreateCompanyDto | UpdateCompanyDto) => Promise<void>
  isLoading?: boolean
}

export const CompanyForm = ({ initialData, isEdit, onSubmit, isLoading }: CompanyFormProps) => {
  const [formData, setFormData] = useState({
    company_code: initialData?.company_code || '',
    company_name: initialData?.company_name || '',
    company_type: (initialData?.company_type || 'PT') as CompanyType,
    email: initialData?.email || '',
    website: initialData?.website || '',
    phone: initialData?.phone || '',
    npwp: initialData?.npwp || '',
    status: (initialData?.status || 'active') as CompanyStatus
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const submitData = isEdit
        ? {
            company_name: formData.company_name,
            company_type: formData.company_type,
            email: formData.email || null,
            website: formData.website || null,
            phone: formData.phone || null,
            npwp: formData.npwp || null,
            status: formData.status
          }
        : formData

      await onSubmit(submitData)
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error || 'Error' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}

      <div>
        <label className="block text-sm font-medium">Company Code</label>
        <input
          type="text"
          name="company_code"
          value={formData.company_code}
          onChange={handleChange}
          disabled={isEdit}
          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Company Name</label>
        <input
          type="text"
          name="company_name"
          value={formData.company_name}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-md"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Company Type</label>
        <select name="company_type" value={formData.company_type} onChange={handleChange} className="w-full px-3 py-2 border rounded-md">
          <option value="PT">PT</option>
          <option value="CV">CV</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Email</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
      </div>

      <div>
        <label className="block text-sm font-medium">Website</label>
        <input type="url" name="website" value={formData.website} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
      </div>

      <div>
        <label className="block text-sm font-medium">Phone</label>
        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
      </div>

      <div>
        <label className="block text-sm font-medium">NPWP</label>
        <input type="text" name="npwp" value={formData.npwp} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
      </div>

      <div>
        <label className="block text-sm font-medium">Status</label>
        <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border rounded-md">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
      </button>
    </form>
  )
}
