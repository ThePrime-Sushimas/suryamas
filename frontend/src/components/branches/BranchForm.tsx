import { useState, useEffect } from 'react'
import type { Branch, CreateBranchDto, UpdateBranchDto } from '@/types/branch'
import type { Company } from '@/types/company'
import { companyService } from '@/services/companyService'
import { useEmployeeStore } from '@/stores/employeeStore'

interface BranchFormProps {
  initialData?: Branch
  isEdit?: boolean
  onSubmit: (data: CreateBranchDto | UpdateBranchDto) => Promise<void>
  isLoading?: boolean
}

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export const BranchForm = ({ initialData, isEdit, onSubmit, isLoading }: BranchFormProps) => {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const { searchEmployees, employees, isLoading: employeesLoading } = useEmployeeStore()
  
  const [formData, setFormData] = useState({
    company_id: initialData?.company_id ?? '',
    branch_code: initialData?.branch_code || '',
    branch_name: initialData?.branch_name || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    province: initialData?.province || 'DKI Jakarta',
    postal_code: initialData?.postal_code || '',
    country: initialData?.country || 'Indonesia',
    phone: initialData?.phone || '',
    whatsapp: initialData?.whatsapp || '',
    email: initialData?.email || '',
    jam_buka: initialData?.jam_buka || '10:00:00',
    jam_tutup: initialData?.jam_tutup || '22:00:00',
    hari_operasional: Array.isArray(initialData?.hari_operasional) ? initialData.hari_operasional : [],
    status: initialData?.status || 'active',
    manager_id: initialData?.manager_id ?? '',
    notes: initialData?.notes || '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await companyService.list(1, 1000)
        setCompanies(res.data.data)
      } catch (error) {
        console.error('Failed to fetch companies')
      } finally {
        setCompaniesLoading(false)
      }
    }
    fetchCompanies()
  }, [])

  useEffect(() => {
    searchEmployees('', 'full_name', 'asc', {}, 1, 1000)
  }, [searchEmployees])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleHariChange = (hari: string) => {
    setFormData(prev => {
      const updated = prev.hari_operasional.includes(hari)
        ? prev.hari_operasional.filter(h => h !== hari)
        : [...prev.hari_operasional, hari]
      console.log('Updated hari_operasional:', updated)
      return { ...prev, hari_operasional: updated }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (isEdit) {
        const submitData: UpdateBranchDto = {
          branch_name: formData.branch_name,
          address: formData.address,
          city: formData.city,
          province: formData.province,
          postal_code: formData.postal_code || undefined,
          country: formData.country,
          phone: formData.phone || undefined,
          whatsapp: formData.whatsapp || undefined,
          email: formData.email || undefined,
          jam_buka: formData.jam_buka,
          jam_tutup: formData.jam_tutup,
          hari_operasional: formData.hari_operasional,
          status: formData.status,
          manager_id: formData.manager_id || undefined,
          notes: formData.notes || undefined,
        }
        await onSubmit(submitData)
      } else {
        const submitData: CreateBranchDto = {
          company_id: formData.company_id,
          branch_code: formData.branch_code,
          branch_name: formData.branch_name,
          address: formData.address,
          city: formData.city,
          province: formData.province,
          postal_code: formData.postal_code || undefined,
          country: formData.country,
          phone: formData.phone || undefined,
          whatsapp: formData.whatsapp || undefined,
          email: formData.email || undefined,
          jam_buka: formData.jam_buka,
          jam_tutup: formData.jam_tutup,
          hari_operasional: formData.hari_operasional,
          status: formData.status,
          manager_id: formData.manager_id || undefined,
          notes: formData.notes || undefined,
        }
        await onSubmit(submitData)
      }
    } catch (error: any) {
      const fieldErrors = error.response?.data?.errors
      if (fieldErrors && typeof fieldErrors === 'object') {
        setErrors(fieldErrors)
      } else {
        setErrors({ submit: error.response?.data?.error || 'Error' })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}

      <div>
        <label className="block text-sm font-medium">Company</label>
        <select
          name="company_id"
          value={formData.company_id}
          onChange={handleChange}
          disabled={isEdit || companiesLoading}
          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
          required
        >
          <option value="">Select Company</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        {errors.company_id && <p className="text-red-500 text-xs mt-1">{errors.company_id}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Branch Code</label>
        <input
          type="text"
          name="branch_code"
          value={formData.branch_code}
          onChange={handleChange}
          disabled={isEdit}
          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
          required
        />
        {errors.branch_code && <p className="text-red-500 text-xs mt-1">{errors.branch_code}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Branch Name</label>
        <input
          type="text"
          name="branch_name"
          value={formData.branch_name}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-md"
          required
        />
        {errors.branch_name && <p className="text-red-500 text-xs mt-1">{errors.branch_name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Address</label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-md"
          rows={3}
          required
        />
        {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">City</label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Province</label>
          <input
            type="text"
            name="province"
            value={formData.province}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md"
          />
          {errors.province && <p className="text-red-500 text-xs mt-1">{errors.province}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Postal Code</label>
          <input
            type="text"
            name="postal_code"
            value={formData.postal_code}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md"
          />
          {errors.postal_code && <p className="text-red-500 text-xs mt-1">{errors.postal_code}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Country</label>
          <input
            type="text"
            name="country"
            value={formData.country}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md"
          />
          {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Phone</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md"
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">WhatsApp</label>
          <input
            type="tel"
            name="whatsapp"
            value={formData.whatsapp}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md"
          />
          {errors.whatsapp && <p className="text-red-500 text-xs mt-1">{errors.whatsapp}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-md"
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Jam Buka</label>
          <input
            type="time"
            name="jam_buka"
            value={formData.jam_buka.slice(0, 5)}
            onChange={(e) => setFormData(prev => ({ ...prev, jam_buka: e.target.value + ':00' }))}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
          {errors.jam_buka && <p className="text-red-500 text-xs mt-1">{errors.jam_buka}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Jam Tutup</label>
          <input
            type="time"
            name="jam_tutup"
            value={formData.jam_tutup.slice(0, 5)}
            onChange={(e) => setFormData(prev => ({ ...prev, jam_tutup: e.target.value + ':00' }))}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
          {errors.jam_tutup && <p className="text-red-500 text-xs mt-1">{errors.jam_tutup}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Hari Operasional</label>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {HARI_LIST.map(hari => (
            <label key={hari} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hari_operasional.includes(hari)}
                onChange={() => handleHariChange(hari)}
                className="mr-2 cursor-pointer"
              />
              <span className="text-sm">{hari}</span>
            </label>
          ))}
        </div>
        {errors.hari_operasional && <p className="text-red-500 text-xs mt-1">{errors.hari_operasional}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Status</label>
        <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border rounded-md">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {errors.status && <p className="text-red-500 text-xs mt-1">{errors.status}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Manager</label>
        <select
          name="manager_id"
          value={formData.manager_id}
          onChange={handleChange}
          disabled={employeesLoading}
          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
        >
          <option value="">Select Manager (Optional)</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.job_position})
            </option>
          ))}
        </select>
        {errors.manager_id && <p className="text-red-500 text-xs mt-1">{errors.manager_id}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-md"
          rows={3}
        />
        {errors.notes && <p className="text-red-500 text-xs mt-1">{errors.notes}</p>}
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
