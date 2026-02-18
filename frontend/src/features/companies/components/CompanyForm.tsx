import { useState, useEffect, useMemo } from 'react'
import type { Company, CompanyType, CompanyStatus } from '../types'

interface CompanyFormProps {
  initialData?: Company
  isEdit?: boolean
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  isLoading?: boolean
}

const COMPANY_TYPES: CompanyType[] = ['PT', 'CV', 'Firma', 'Koperasi', 'Yayasan']
const COMPANY_STATUSES: CompanyStatus[] = ['active', 'inactive', 'suspended', 'closed']

export const CompanyForm = ({ initialData, isEdit, onSubmit, isLoading }: CompanyFormProps) => {
  const initialFormData = useMemo(() => ({
    company_code: initialData?.company_code || '',
    company_name: initialData?.company_name || '',
    company_type: (initialData?.company_type || 'PT') as CompanyType,
    email: initialData?.email || '',
    website: initialData?.website || '',
    phone: initialData?.phone || '',
    npwp: initialData?.npwp || '',
    status: (initialData?.status || 'active') as CompanyStatus
  }), [initialData])

  const [formData, setFormData] = useState(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setFormData(initialFormData)
  }, [initialFormData])

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
    } catch (error: unknown) {
      const errorMsg = error instanceof Error && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data ? String(error.response.data.error) : error instanceof Error ? error.message : 'Failed to save company'
      setErrors({ submit: errorMsg })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.submit && <p className="text-red-500 text-sm dark:text-red-400">{errors.submit}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Code *</label>
        <input
          type="text"
          name="company_code"
          value={formData.company_code}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isEdit}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          maxLength={20}
        />
        {errors.company_code && <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.company_code}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name *</label>
        <input
          type="text"
          name="company_name"
          value={formData.company_name}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          maxLength={255}
        />
        {errors.company_name && <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.company_name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Type</label>
        <select name="company_type" value={formData.company_type} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          {COMPANY_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
        <input 
          type="email" 
          name="email" 
          value={formData.email} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
        />
        {errors.email && <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Website</label>
        <input 
          type="url" 
          name="website" 
          value={formData.website} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="https://example.com"
        />
        {errors.website && <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.website}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
        <input 
          type="tel" 
          name="phone" 
          value={formData.phone} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="+62xxx"
        />
        {errors.phone && <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">NPWP</label>
        <input 
          type="text" 
          name="npwp" 
          value={formData.npwp} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          maxLength={15}
          placeholder="15 characters"
        />
        {errors.npwp && <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.npwp}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
        <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          {COMPANY_STATUSES.map(status => (
            <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
      >
        {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
      </button>
    </form>
  )
}
