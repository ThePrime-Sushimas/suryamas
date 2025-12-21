import { useState, useEffect } from 'react'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../../types/product'
import { metricUnitService } from '../../services/metricUnitService'
import type { MetricUnit } from '../../types/metricUnit'

interface UomFormProps {
  uom?: ProductUom
  onSubmit: (data: CreateProductUomDto | UpdateProductUomDto) => void
  isLoading?: boolean
  hasBaseUnit?: boolean
}

export const UomForm = ({
  uom,
  onSubmit,
  isLoading = false,
  hasBaseUnit = false,
}: UomFormProps) => {
  const [formData, setFormData] = useState<any>({
    unit_name: '',
    conversion_factor: 1,
    is_base_unit: false,
  })
  const [metricUnits, setMetricUnits] = useState<MetricUnit[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)

  useEffect(() => {
    loadMetricUnits()
  }, [])

  const loadMetricUnits = async () => {
    try {
      setLoadingUnits(true)
      const response = await metricUnitService.list(1, 100, undefined, { is_active: true })
      setMetricUnits(response.data)
    } catch (error) {
      console.error('Failed to load metric units:', error)
    } finally {
      setLoadingUnits(false)
    }
  }

  useEffect(() => {
    if (uom) {
      setFormData({
        unit_name: uom.unit_name,
        conversion_factor: uom.conversion_factor,
        is_base_unit: uom.is_base_unit,
        base_price: uom.base_price || undefined,
        status_uom: uom.status_uom,
      })
    } else {
      setFormData({
        unit_name: '',
        conversion_factor: 1,
        is_base_unit: true,
      })
    }
  }, [uom])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
                     type === 'number' ? parseFloat(value) : value

    setFormData((prev: any) => {
      const updated = {
        ...prev,
        [name]: newValue,
      }

      if (name === 'conversion_factor') {
        updated.is_base_unit = newValue === 1
      }

      return updated
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Unit Name *</label>
          <select
            name="unit_name"
            value={formData.unit_name}
            onChange={handleChange}
            required
            disabled={loadingUnits}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">- Select Unit -</option>
            {metricUnits.map((unit) => (
              <option key={unit.id} value={unit.unit_name}>{unit.unit_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Conversion Factor *</label>
          <input
            type="number"
            name="conversion_factor"
            value={formData.conversion_factor}
            onChange={handleChange}
            step="0.001"
            min="0.001"
            required
            className="w-full px-3 py-2 border rounded"
            placeholder="1.0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Base Price</label>
          <input
            type="number"
            name="base_price"
            value={formData.base_price || ''}
            onChange={handleChange}
            min="0"
            className="w-full px-3 py-2 border rounded"
            placeholder="10000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            name="status_uom"
            value={formData.status_uom || 'ACTIVE'}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          name="is_base_unit"
          checked={formData.is_base_unit}
          onChange={handleChange}
          disabled={hasBaseUnit && !uom?.is_base_unit}
          className="rounded"
        />
        <span className="text-sm">Base Unit {hasBaseUnit && !uom?.is_base_unit ? '(Already exists)' : ''}</span>
      </label>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Saving...' : uom ? 'Update UOM' : 'Create UOM'}
      </button>
    </form>
  )
}
