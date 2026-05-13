import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto, UomStatus } from '../types'

interface MetricUnit { id: string; unit_name: string }

interface ProductUomFormProps {
  uom?: ProductUom
  existingUoms?: ProductUom[]
  onSubmit: (data: CreateProductUomDto | UpdateProductUomDto) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function ProductUomForm({ uom, existingUoms = [], onSubmit, onCancel, loading }: ProductUomFormProps) {
  const [formData, setFormData] = useState({
    metric_unit_id: uom?.metric_unit_id || '',
    conversion_factor: uom?.conversion_factor || 1,
    is_base_unit: uom?.is_base_unit || false,
    base_price: uom?.base_price || 0,
    is_default_stock_unit: uom?.is_default_stock_unit || false,
    is_default_purchase_unit: uom?.is_default_purchase_unit || false,
    is_default_transfer_unit: uom?.is_default_transfer_unit || false,
    status_uom: (uom?.status_uom || 'ACTIVE') as UomStatus,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: metricUnits = [], isLoading: loadingUnits } = useQuery({
    queryKey: ['metric-units'],
    queryFn: async () => {
      const { data } = await api.get('/metric-units', { params: { limit: 200 } })
      return (data.data || []) as MetricUnit[]
    },
    staleTime: 5 * 60_000,
  })

  const baseUnit = existingUoms.find(u => u.is_base_unit) || (uom?.is_base_unit ? { metric_units: uom.metric_units } : null)
  const selectedUnit = metricUnits.find(m => m.id === formData.metric_unit_id)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!formData.metric_unit_id) e.metric_unit_id = 'Pilih satuan'
    if (formData.conversion_factor <= 0) e.conversion_factor = 'Harus lebih dari 0'
    if (formData.is_base_unit && formData.conversion_factor !== 1) e.conversion_factor = 'Base unit harus 1'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    await onSubmit({
      metric_unit_id: formData.metric_unit_id,
      conversion_factor: formData.conversion_factor,
      is_base_unit: formData.is_base_unit,
      base_price: formData.base_price,
      is_default_stock_unit: formData.is_default_stock_unit,
      is_default_purchase_unit: formData.is_default_purchase_unit,
      is_default_transfer_unit: formData.is_default_transfer_unit,
      status_uom: formData.status_uom,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Satuan */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Satuan *</label>
        <select value={formData.metric_unit_id} onChange={e => setFormData({ ...formData, metric_unit_id: e.target.value })}
          disabled={loading || loadingUnits}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800">
          <option value="">{loadingUnits ? 'Memuat...' : 'Pilih satuan'}</option>
          {metricUnits.map(u => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
        </select>
        {errors.metric_unit_id && <p className="text-red-500 text-xs mt-1">{errors.metric_unit_id}</p>}
      </div>

      {/* Konversi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Faktor Konversi *</label>
          <input type="number" step="0.000001" min="0" value={formData.conversion_factor}
            onChange={e => setFormData({ ...formData, conversion_factor: parseFloat(e.target.value) || 0 })}
            disabled={loading || formData.is_base_unit}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800" />
          {errors.conversion_factor && <p className="text-red-500 text-xs mt-1">{errors.conversion_factor}</p>}
          <p className="text-xs text-gray-400 mt-1">{formData.is_base_unit ? 'Base unit selalu 1' : 'Berapa base unit dalam 1 satuan ini'}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex items-center">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Preview</p>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {formData.is_base_unit ? '1 (Satuan Dasar)' :
                selectedUnit && baseUnit ? `1 ${selectedUnit.unit_name} = ${formData.conversion_factor.toLocaleString('id-ID')} ${baseUnit.metric_units?.unit_name || '?'}` :
                '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Harga Dasar */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Harga Dasar (per base unit)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
          <input type="number" min="0" value={formData.base_price || ''}
            onChange={e => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
            disabled={loading}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
      </div>

      {/* Flags */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Penggunaan</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { key: 'is_base_unit', label: 'Base Unit', active: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' },
            { key: 'is_default_stock_unit', label: 'Default Stok', active: 'border-green-400 bg-green-50 dark:bg-green-900/20' },
            { key: 'is_default_purchase_unit', label: 'Default Beli', active: 'border-purple-400 bg-purple-50 dark:bg-purple-900/20' },
            { key: 'is_default_transfer_unit', label: 'Default Transfer', active: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' },
          ] as const).map(({ key, label, active }) => (
            <label key={key} className={`flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
              formData[key] ? active : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
            }`}>
              <input type="checkbox" checked={formData[key]}
                onChange={e => {
                  const updates: Record<string, unknown> = { [key]: e.target.checked }
                  if (key === 'is_base_unit' && e.target.checked) updates.conversion_factor = 1
                  setFormData(prev => ({ ...prev, ...updates }))
                }}
                disabled={loading}
                className="w-3.5 h-3.5 rounded" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
        <div className="flex gap-3">
          {(['ACTIVE', 'INACTIVE'] as const).map(s => (
            <label key={s} className={`flex-1 flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer ${
              formData.status_uom === s ? (s === 'ACTIVE' ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-gray-400 bg-gray-100 dark:bg-gray-700') : 'border-gray-200 dark:border-gray-600'
            }`}>
              <input type="radio" name="status_uom" value={s} checked={formData.status_uom === s}
                onChange={e => setFormData({ ...formData, status_uom: e.target.value as UomStatus })} disabled={loading} className="w-3.5 h-3.5" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button type="submit" disabled={loading || loadingUnits}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium">
          {loading ? 'Menyimpan...' : uom ? 'Update' : 'Buat Satuan'}
        </button>
        <button type="button" onClick={onCancel} disabled={loading}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">
          Batal
        </button>
      </div>
    </form>
  )
}
