import { useState, useEffect } from 'react'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto, UomStatus } from '../types'
import { metricUnitsApi } from '@/features/metric_units/api/metricUnits.api'

interface MetricUnit {
  id: string
  unit_name: string
}

interface ProductUomFormProps {
  uom?: ProductUom
  onSubmit: (data: CreateProductUomDto | UpdateProductUomDto) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function ProductUomForm({ uom, onSubmit, onCancel, loading }: ProductUomFormProps) {
  const [formData, setFormData] = useState({
    unit_name: uom?.unit_name || '',
    conversion_factor: uom?.conversion_factor || 1,
    is_base_unit: uom?.is_base_unit || false,
    base_price: uom?.base_price || 0,
    is_default_stock_unit: uom?.is_default_stock_unit || false,
    is_default_purchase_unit: uom?.is_default_purchase_unit || false,
    is_default_base_unit: uom?.is_default_base_unit || false,
    is_default_transfer_unit: uom?.is_default_transfer_unit || false,
    status_uom: (uom?.status_uom || 'ACTIVE') as UomStatus,
    metric_unit_id: uom?.metric_unit_id || undefined,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [metricUnits, setMetricUnits] = useState<MetricUnit[]>([])

  useEffect(() => {
    const fetchMetricUnits = async () => {
      try {
        const response = await metricUnitsApi.listActive(1, 100)
        setMetricUnits(response.data)
      } catch {
        // Silent fail - metric unit is optional
      }
    }
    fetchMetricUnits()
  }, [])

  useEffect(() => {
    if (formData.is_base_unit && formData.conversion_factor !== 1) {
      setFormData(prev => ({ ...prev, conversion_factor: 1 }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.is_base_unit])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.unit_name.trim()) {
      newErrors.unit_name = 'Unit name is required'
    }

    if (formData.conversion_factor <= 0) {
      newErrors.conversion_factor = 'Conversion factor must be greater than 0'
    }

    if (formData.is_base_unit && formData.conversion_factor !== 1) {
      newErrors.conversion_factor = 'Base unit must have conversion factor of 1'
    }

    if (formData.base_price !== null && formData.base_price < 0) {
      newErrors.base_price = 'Base price cannot be negative'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Metric Unit (Optional)
        </label>
        <select
          value={formData.metric_unit_id || ''}
          onChange={e => setFormData({ ...formData, metric_unit_id: e.target.value || undefined })}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        >
          <option value="">Select metric unit (optional)</option>
          {metricUnits.map(unit => (
            <option key={unit.id} value={unit.id}>
              {unit.unit_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Unit Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.unit_name}
          onChange={e => setFormData({ ...formData, unit_name: e.target.value })}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          placeholder="e.g., Box, Carton, Piece"
        />
        {errors.unit_name && <p className="text-red-500 text-sm mt-1">{errors.unit_name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Conversion Factor <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.000001"
          value={formData.conversion_factor}
          onChange={e => setFormData({ ...formData, conversion_factor: parseFloat(e.target.value) || 0 })}
          disabled={loading || formData.is_base_unit}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        />
        {errors.conversion_factor && <p className="text-red-500 text-sm mt-1">{errors.conversion_factor}</p>}
        <p className="text-gray-500 text-xs mt-1">How many base units equal this unit</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Base Price</label>
        <input
          type="number"
          step="0.01"
          value={formData.base_price || ''}
          onChange={e => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        />
        {errors.base_price && <p className="text-red-500 text-sm mt-1">{errors.base_price}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={formData.status_uom}
          onChange={e => setFormData({ ...formData, status_uom: e.target.value as UomStatus })}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_base_unit}
            onChange={e => setFormData({ ...formData, is_base_unit: e.target.checked })}
            disabled={loading}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Is Base Unit</span>
        </label>
        <p className="text-xs text-gray-500 ml-6">Satuan dasar untuk konversi (hanya 1 per produk, conversion factor = 1)</p>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_default_stock_unit}
            onChange={e => setFormData({ ...formData, is_default_stock_unit: e.target.checked })}
            disabled={loading}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Default Stock Unit</span>
        </label>
        <p className="text-xs text-gray-500 ml-6">Satuan default untuk laporan stok gudang</p>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_default_purchase_unit}
            onChange={e => setFormData({ ...formData, is_default_purchase_unit: e.target.checked })}
            disabled={loading}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Default Purchase Unit</span>
        </label>
        <p className="text-xs text-gray-500 ml-6">Satuan default untuk pembelian dari supplier</p>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_default_base_unit}
            onChange={e => setFormData({ ...formData, is_default_base_unit: e.target.checked })}
            disabled={loading}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Default Base Unit</span>
        </label>
        <p className="text-xs text-gray-500 ml-6">Satuan default untuk transaksi umum (kasir, penjualan)</p>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_default_transfer_unit}
            onChange={e => setFormData({ ...formData, is_default_transfer_unit: e.target.checked })}
            disabled={loading}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Default Transfer Unit</span>
        </label>
        <p className="text-xs text-gray-500 ml-6">Satuan default untuk transfer antar gudang/cabang</p>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving...' : uom ? 'Update UOM' : 'Create UOM'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
