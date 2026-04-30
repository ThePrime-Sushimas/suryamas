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

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
const errorCls = "text-red-500 dark:text-red-400 text-xs mt-1"

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

  useEffect(() => { setFormData(initialFormData) }, [initialFormData])

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'company_code':
        if (!value.trim()) return 'Kode perusahaan wajib diisi'
        if (value.length > 20) return 'Maksimal 20 karakter'
        return ''
      case 'company_name':
        if (!value.trim()) return 'Nama perusahaan wajib diisi'
        if (value.length > 255) return 'Maksimal 255 karakter'
        return ''
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Format email tidak valid'
        return ''
      case 'website':
        if (value && !/^https?:\/\/.+/.test(value)) return 'URL harus diawali http:// atau https://'
        return ''
      case 'phone':
        if (value && value.replace(/\D/g, '').length < 10) return 'Minimal 10 digit'
        return ''
      case 'npwp':
        if (value && value.length !== 15) return 'NPWP harus 15 karakter'
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
    setErrors(prev => ({ ...prev, [name]: validateField(name, value) }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (touched[name]) setErrors(prev => ({ ...prev, [name]: validateField(name, value) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const submitData = isEdit
      ? { company_name: formData.company_name, company_type: formData.company_type, email: formData.email || null, website: formData.website || null, phone: formData.phone || null, npwp: formData.npwp || null, status: formData.status }
      : { ...formData, email: formData.email || null, website: formData.website || null, phone: formData.phone || null, npwp: formData.npwp || null }

    await onSubmit(submitData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Kode Perusahaan *</label>
          <input type="text" name="company_code" value={formData.company_code} onChange={handleChange} onBlur={handleBlur}
            disabled={isEdit} maxLength={20}
            className={`${inputCls} ${isEdit ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''}`} />
          {errors.company_code && <p className={errorCls}>{errors.company_code}</p>}
        </div>
        <div>
          <label className={labelCls}>Nama Perusahaan *</label>
          <input type="text" name="company_name" value={formData.company_name} onChange={handleChange} onBlur={handleBlur}
            maxLength={255} className={inputCls} />
          {errors.company_name && <p className={errorCls}>{errors.company_name}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Tipe Perusahaan</label>
          <select name="company_type" value={formData.company_type} onChange={handleChange} className={inputCls}>
            {COMPANY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select name="status" value={formData.status} onChange={handleChange} className={inputCls}>
            {COMPANY_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} className={inputCls} />
          {errors.email && <p className={errorCls}>{errors.email}</p>}
        </div>
        <div>
          <label className={labelCls}>Telepon</label>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} onBlur={handleBlur} className={inputCls} placeholder="+62xxx" />
          {errors.phone && <p className={errorCls}>{errors.phone}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Website</label>
          <input type="url" name="website" value={formData.website} onChange={handleChange} onBlur={handleBlur} className={inputCls} placeholder="https://example.com" />
          {errors.website && <p className={errorCls}>{errors.website}</p>}
        </div>
        <div>
          <label className={labelCls}>NPWP</label>
          <input type="text" name="npwp" value={formData.npwp} onChange={handleChange} onBlur={handleBlur} className={inputCls} maxLength={15} placeholder="15 karakter" />
          {errors.npwp && <p className={errorCls}>{errors.npwp}</p>}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isLoading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm">
          {isLoading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Perusahaan'}
        </button>
      </div>
    </form>
  )
}
