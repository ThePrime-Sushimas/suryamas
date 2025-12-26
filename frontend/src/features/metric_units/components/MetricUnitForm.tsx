import { useState } from 'react'
import type { MetricUnit, MetricType } from '../types'

interface MetricUnitFormProps {
  initialData?: MetricUnit
  isEdit?: boolean
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export const MetricUnitForm = ({ initialData, isEdit, onSubmit, isLoading }: MetricUnitFormProps) => {
  const [formData, setFormData] = useState({
    metric_type: (initialData?.metric_type || 'Unit') as MetricType,
    unit_name: initialData?.unit_name || '',
    notes: initialData?.notes || '',
    is_active: initialData?.is_active ?? true
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setFormData(prev => ({ ...prev, [e.target.name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Metric Type *</label>
        <select name="metric_type" value={formData.metric_type} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required>
          <option value="Unit">Unit</option>
          <option value="Volume">Volume</option>
          <option value="Weight">Weight</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Unit Name *</label>
        <input name="unit_name" value={formData.unit_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" rows={3} />
      </div>
      <div>
        <label className="flex items-center">
          <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="mr-2" />
          Active
        </label>
      </div>
      <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
        {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
      </button>
    </form>
  )
}
