import { useState, useEffect } from 'react'
import type { Company, CompanyType, CompanyStatus } from '../types'

interface CompanyFormProps {
  initialData?: Company
  isEdit?: boolean
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

const COMPANY_TYPES: CompanyType[] = ['PT', 'CV', 'Firma', 'Koperasi', 'Yayasan']
const COMPANY_STATUSES: CompanyStatus[] = ['active', 'inactive', 'suspended', 'closed']

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
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (initialData) {
      setFormData({
        company_code: initialData.company_code,
        company_name: initialData.company_name,
        company_type: initialData.company_type,
        email: initialData.email || '',
        website: initialData.website || '',
        phone: initialData.phone || '',
        npwp: initialData.npwp || '',
        status: initialData.status
      })
    }
  }, [initialData])

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'company_code':
        if (!value.trim()) return 'Company code is required'
        if (value.length > 20) return 'Company code must be max 20 characters'
        return ''
      case 'company_name':
        if (!value.trim()) return 'Company name is required'
        if (value.length > 255) return 'Company name must be max 255 characters'
        return ''
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format'
        return ''
      case 'website':
        if (value && !/^https?:\/\/.+/.test(value)) return 'Invalid URL format (must start with http:// or https://)'
        return ''
      case 'phone':
        if (value && value.replace(/\D/g, '').length < 10) return 'Phone must be at least 10 digits'
        return ''
      case 'npwp':
        if (value && value.length !== 15) return 'NPWP must be exactly 15 characters'
        return ''
      default:
        return ''
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key as keyof typeof formData])
      if (error) newErrors[key] = error
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
    const error = validateField(name, value)
    setErrors(prev => ({ ...prev, [name]: error }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (touched[name]) {
      const error = validateField(name, value)
      setErrors(prev => ({ ...prev, [name]: error }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      setErrors(prev => ({ ...prev, submit: 'Please fix validation errors' }))
      return
    }

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
        : {
            ...formData,
            email: formData.email || null,
            website: formData.website || null,
            phone: formData.phone || null,
            npwp: formData.npwp || null
          }

      await onSubmit(submitData)
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to save company'
      setErrors({ submit: errorMsg })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}

      <div>
        <label className="block text-sm font-medium">Company Code *</label>
        <input
          type="text"
          name="company_code"
          value={formData.company_code}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isEdit}
          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
          maxLength={20}
        />
        {errors.company_code && <p className="text-red-500 text-xs mt-1">{errors.company_code}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Company Name *</label>
        <input
          type="text"
          name="company_name"
          value={formData.company_name}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border rounded-md"
          maxLength={255}
        />
        {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Company Type</label>
        <select name="company_type" value={formData.company_type} onChange={handleChange} className="w-full px-3 py-2 border rounded-md">
          {COMPANY_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Email</label>
        <input 
          type="email" 
          name="email" 
          value={formData.email} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border rounded-md" 
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Website</label>
        <input 
          type="url" 
          name="website" 
          value={formData.website} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="https://example.com"
        />
        {errors.website && <p className="text-red-500 text-xs mt-1">{errors.website}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Phone</label>
        <input 
          type="tel" 
          name="phone" 
          value={formData.phone} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="+62xxx"
        />
        {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">NPWP</label>
        <input 
          type="text" 
          name="npwp" 
          value={formData.npwp} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border rounded-md"
          maxLength={15}
          placeholder="15 characters"
        />
        {errors.npwp && <p className="text-red-500 text-xs mt-1">{errors.npwp}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Status</label>
        <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border rounded-md">
          {COMPANY_STATUSES.map(status => (
            <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
          ))}
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
