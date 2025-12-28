import { useState, useEffect } from 'react'
import { z } from 'zod'
import type { MetricUnit, CreateMetricUnitDto, MetricType } from '../types'

const metricUnitSchema = z.object({
  metric_type: z.enum(['Unit', 'Volume', 'Weight']),
  unit_name: z.string().min(1, 'Unit name is required').max(100, 'Max 100 characters').trim(),
  notes: z.string().max(500, 'Max 500 characters').optional().nullable(),
  is_active: z.boolean()
})

interface MetricUnitFormProps {
  initialData?: MetricUnit
  isEdit?: boolean
  onSubmit: (data: CreateMetricUnitDto) => Promise<void>
  isLoading?: boolean
  metricTypes?: MetricType[]
}

export const MetricUnitForm = ({ initialData, isEdit, onSubmit, isLoading, metricTypes = ['Unit', 'Volume', 'Weight'] }: MetricUnitFormProps) => {
  const [formData, setFormData] = useState({
    metric_type: (initialData?.metric_type || 'Unit') as MetricType,
    unit_name: initialData?.unit_name || '',
    notes: initialData?.notes || null,
    is_active: initialData?.is_active ?? true
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type } = e.target
    const value = type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }))
    setTouched(prev => ({ ...prev, [name]: true }))
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setTouched(prev => ({ ...prev, [e.target.name]: true }))
  }

  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      const result = metricUnitSchema.safeParse(formData)
      if (!result.success) {
        const fieldErrors: Record<string, string> = {}
        result.error.errors.forEach(err => {
          const field = err.path[0] as string
          if (touched[field]) {
            fieldErrors[field] = err.message
          }
        })
        setErrors(fieldErrors)
      } else {
        setErrors({})
      }
    }
  }, [formData, touched])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const result = metricUnitSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        fieldErrors[err.path[0] as string] = err.message
      })
      setErrors(fieldErrors)
      setTouched({ metric_type: true, unit_name: true, notes: true, is_active: true })
      return
    }
    
    setErrors({})
    await onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="metric_type" className="block text-sm font-medium mb-1">Metric Type *</label>
        <select 
          id="metric_type"
          name="metric_type" 
          value={formData.metric_type} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
          aria-invalid={!!errors.metric_type}
          aria-describedby={errors.metric_type ? 'metric_type-error' : undefined}
        >
          {metricTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        {errors.metric_type && (
          <p id="metric_type-error" className="text-red-600 text-sm mt-1">{errors.metric_type}</p>
        )}
      </div>
      
      <div>
        <label htmlFor="unit_name" className="block text-sm font-medium mb-1">Unit Name *</label>
        <input 
          id="unit_name"
          name="unit_name" 
          value={formData.unit_name} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
          maxLength={100}
          aria-invalid={!!errors.unit_name}
          aria-describedby={errors.unit_name ? 'unit_name-error' : undefined}
        />
        {errors.unit_name && (
          <p id="unit_name-error" className="text-red-600 text-sm mt-1">{errors.unit_name}</p>
        )}
      </div>
      
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1">Notes</label>
        <textarea 
          id="notes"
          name="notes" 
          value={formData.notes || ''} 
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          rows={3}
          disabled={isLoading}
          maxLength={500}
          aria-invalid={!!errors.notes}
          aria-describedby={errors.notes ? 'notes-error' : undefined}
        />
        {errors.notes && (
          <p id="notes-error" className="text-red-600 text-sm mt-1">{errors.notes}</p>
        )}
      </div>
      
      <div>
        <label htmlFor="is_active" className="flex items-center cursor-pointer">
          <input 
            id="is_active"
            type="checkbox" 
            name="is_active" 
            checked={formData.is_active} 
            onChange={handleChange}
            className="mr-2 w-4 h-4"
            disabled={isLoading}
          />
          <span className="text-sm font-medium">Active</span>
        </label>
      </div>
      
      <button 
        type="submit" 
        disabled={isLoading || Object.keys(errors).length > 0}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
      </button>
    </form>
  )
}
