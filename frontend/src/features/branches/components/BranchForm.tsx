import { useState } from 'react'
import type { Branch, CreateBranchDto, UpdateBranchDto } from '../types'

interface BranchFormProps {
  initialData?: Branch
  isEdit?: boolean
  onSubmit: (data: CreateBranchDto | UpdateBranchDto) => Promise<void>
  isLoading?: boolean
}

export const BranchForm = ({ initialData, isEdit, onSubmit, isLoading }: BranchFormProps) => {
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
    jam_buka: initialData?.jam_buka?.slice(0, 5) || '10:00',
    jam_tutup: initialData?.jam_tutup?.slice(0, 5) || '22:00',
    hari_operasional: initialData?.hari_operasional || [],
    status: initialData?.status || 'active',
    manager_id: initialData?.manager_id || '',
    notes: initialData?.notes || ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      hari_operasional: prev.hari_operasional.includes(day)
        ? prev.hari_operasional.filter(d => d !== day)
        : [...prev.hari_operasional, day]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const submitData = isEdit
      ? {
          branch_name: formData.branch_name,
          address: formData.address,
          city: formData.city,
          province: formData.province,
          postal_code: formData.postal_code || undefined,
          country: formData.country,
          phone: formData.phone || undefined,
          whatsapp: formData.whatsapp || undefined,
          email: formData.email || undefined,
          jam_buka: formData.jam_buka + ':00',
          jam_tutup: formData.jam_tutup + ':00',
          hari_operasional: formData.hari_operasional,
          status: formData.status as 'active' | 'inactive',
          manager_id: formData.manager_id || undefined,
          notes: formData.notes || undefined
        }
      : {
          ...formData,
          jam_buka: formData.jam_buka + ':00',
          jam_tutup: formData.jam_tutup + ':00',
          postal_code: formData.postal_code || undefined,
          phone: formData.phone || undefined,
          whatsapp: formData.whatsapp || undefined,
          email: formData.email || undefined,
          manager_id: formData.manager_id || undefined,
          notes: formData.notes || undefined
        }
    await onSubmit(submitData as any)
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <>
          <div>
            <label className="block text-sm font-medium">Company ID *</label>
            <input name="company_id" value={formData.company_id} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
          </div>
          <div>
            <label className="block text-sm font-medium">Branch Code *</label>
            <input name="branch_code" value={formData.branch_code} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
          </div>
        </>
      )}
      <div>
        <label className="block text-sm font-medium">Branch Name *</label>
        <input name="branch_name" value={formData.branch_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Address *</label>
        <textarea name="address" value={formData.address} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" rows={3} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">City *</label>
          <input name="city" value={formData.city} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Province</label>
          <input name="province" value={formData.province} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Phone</label>
          <input name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Opening Time *</label>
          <input type="time" name="jam_buka" value={formData.jam_buka} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Closing Time *</label>
          <input type="time" name="jam_tutup" value={formData.jam_tutup} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Operating Days *</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {days.map(day => (
            <label key={day} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.hari_operasional.includes(day)}
                onChange={() => handleDayToggle(day)}
                className="mr-2"
              />
              {day}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium">Status</label>
        <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border rounded-md">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
        {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
      </button>
    </form>
  )
}
