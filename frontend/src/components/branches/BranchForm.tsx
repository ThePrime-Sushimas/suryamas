import { useState, useEffect } from 'react'
import type { Branch, BranchStatus, HariOperasional } from '@/types/branch'
import type { Company } from '@/types/company'
import type { Employee } from '@/types'
import { companyService } from '@/services/companyService'
import { useEmployeeStore } from '@/stores/employeeStore'
import { MapPicker } from './MapPicker'

interface BranchFormProps {
  initialData?: Branch
  isEdit?: boolean
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export const BranchForm = ({ initialData, isEdit, onSubmit, isLoading }: BranchFormProps) => {
  const [companies, setCompanies] = useState<Company[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const { searchEmployees } = useEmployeeStore()
  
  const [formData, setFormData] = useState({
    company_id: initialData?.company_id || '',
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
    hari_operasional: (initialData?.hari_operasional || 'Senin-Minggu') as HariOperasional,
    latitude: initialData?.latitude || '',
    longitude: initialData?.longitude || '',
    status: (initialData?.status || 'active') as BranchStatus,
    manager_id: initialData?.manager_id || '',
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
    const fetchEmployees = async () => {
      try {
        await searchEmployees('', 'full_name', 'asc', {}, 1, 1000)
        const state = useEmployeeStore.getState()
        setEmployees(state.employees)
      } catch (error) {
        console.error('Failed to fetch employees')
      } finally {
        setEmployeesLoading(false)
      }
    }
    fetchEmployees()
  }, [searchEmployees])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
            branch_name: formData.branch_name,
            address: formData.address,
            city: formData.city,
            province: formData.province,
            postal_code: formData.postal_code || null,
            country: formData.country,
            phone: formData.phone || null,
            whatsapp: formData.whatsapp || null,
            email: formData.email || null,
            jam_buka: formData.jam_buka,
            jam_tutup: formData.jam_tutup,
            hari_operasional: formData.hari_operasional,
            latitude: formData.latitude ? parseFloat(formData.latitude as any) : null,
            longitude: formData.longitude ? parseFloat(formData.longitude as any) : null,
            status: formData.status,
            manager_id: formData.manager_id || null,
            notes: formData.notes || null,
          }
        : {
            company_id: formData.company_id,
            branch_code: formData.branch_code,
            branch_name: formData.branch_name,
            address: formData.address,
            city: formData.city,
            province: formData.province,
            postal_code: formData.postal_code || null,
            country: formData.country,
            phone: formData.phone || null,
            whatsapp: formData.whatsapp || null,
            email: formData.email || null,
            jam_buka: formData.jam_buka,
            jam_tutup: formData.jam_tutup,
            hari_operasional: formData.hari_operasional,
            latitude: formData.latitude ? parseFloat(formData.latitude as any) : null,
            longitude: formData.longitude ? parseFloat(formData.longitude as any) : null,
            status: formData.status,
            manager_id: formData.manager_id || null,
            notes: formData.notes || null,
          }

      await onSubmit(submitData)
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error || 'Error' })
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
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Location</label>
        <MapPicker
          latitude={formData.latitude ? parseFloat(formData.latitude as any) : null}
          longitude={formData.longitude ? parseFloat(formData.longitude as any) : null}
          onLocationSelect={(lat, lng) => {
            setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }))
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Latitude</label>
          <input
            type="number"
            name="latitude"
            value={formData.latitude}
            onChange={handleChange}
            step="0.0001"
            className="w-full px-3 py-2 border rounded-md"
            placeholder="-6.2088"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Longitude</label>
          <input
            type="number"
            name="longitude"
            value={formData.longitude}
            onChange={handleChange}
            step="0.0001"
            className="w-full px-3 py-2 border rounded-md"
            placeholder="106.8456"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Jam Buka</label>
          <input
            type="time"
            name="jam_buka"
            value={formData.jam_buka}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Jam Tutup</label>
          <input
            type="time"
            name="jam_tutup"
            value={formData.jam_tutup}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Hari Operasional</label>
          <select
            name="hari_operasional"
            value={formData.hari_operasional}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          >
            <option value="Senin-Jumat">Senin-Jumat</option>
            <option value="Senin-Sabtu">Senin-Sabtu</option>
            <option value="Setiap Hari">Setiap Hari</option>
            <option value="Senin-Minggu">Senin-Minggu</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Status</label>
          <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border rounded-md">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
            <option value="closed">Closed</option>
          </select>
        </div>
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
