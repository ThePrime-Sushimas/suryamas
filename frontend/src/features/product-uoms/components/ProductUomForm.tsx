import { useState, useEffect } from 'react'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto, UomStatus } from '../types'
import { metricUnitsApi } from '@/features/metric_units/api/metricUnits.api'

interface MetricUnit {
  id: string
  unit_name: string
}

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
  const [metricUnits, setMetricUnits] = useState<MetricUnit[]>([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(true)
  
  // Get base unit from existing UOMs for conversion display
  const baseUnit = existingUoms.find(existing => existing.is_base_unit) || 
                   (uom?.is_base_unit ? { metric_units: uom.metric_units } : null)

  // Get selected unit name for display
  const selectedUnit = metricUnits.find(m => m.id === formData.metric_unit_id)

  useEffect(() => {
    const fetchMetricUnits = async () => {
      setIsLoadingUnits(true)
      try {
        const response = await metricUnitsApi.listActive(1, 100)
        setMetricUnits(response.data)
      } catch (error) {
        console.error('Failed to fetch metric units:', error)
      } finally {
        setIsLoadingUnits(false)
      }
    }
    fetchMetricUnits()
  }, [])

  // Auto-set conversion factor to 1 when base unit is selected
  useEffect(() => {
    if (formData.is_base_unit && formData.conversion_factor !== 1) {
      setFormData(prev => ({ ...prev, conversion_factor: 1 }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.is_base_unit])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.metric_unit_id) {
      newErrors.metric_unit_id = 'Please select a unit'
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

  // Helper to show conversion preview
  const getConversionPreview = () => {
    if (formData.is_base_unit) {
      return <span className="text-gray-400">1 (Base Unit)</span>
    }
    if (baseUnit && selectedUnit) {
      return (
        <span className="text-blue-600">
          1 {selectedUnit.unit_name} = {formData.conversion_factor.toLocaleString('id-ID')} {baseUnit.metric_units?.unit_name || '-'}
        </span>
      )
    }
    if (!selectedUnit) {
      return <span className="text-gray-400">Select a unit first</span>
    }
    if (!baseUnit) {
      return <span className="text-gray-400">Enter conversion factor</span>
    }
    return <span className="text-gray-400">—</span>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
          Basic Information
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.metric_unit_id}
            onChange={e => setFormData({ ...formData, metric_unit_id: e.target.value, conversion_factor: 1 })}
            disabled={loading || isLoadingUnits}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="">{isLoadingUnits ? 'Loading...' : 'Select a unit'}</option>
            {metricUnits.map(unit => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_name}
              </option>
            ))}
          </select>
          {errors.metric_unit_id && <p className="text-red-500 text-sm mt-1">{errors.metric_unit_id}</p>}
        </div>
      </div>

      {/* Conversion Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
          Conversion to Base Unit
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conversion Factor <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={formData.conversion_factor}
              onChange={e => setFormData({ ...formData, conversion_factor: parseFloat(e.target.value) || 0 })}
              disabled={loading || formData.is_base_unit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              placeholder="e.g., 1000"
            />
            {errors.conversion_factor && <p className="text-red-500 text-sm mt-1">{errors.conversion_factor}</p>}
            <p className="text-gray-500 text-xs mt-1">
              {formData.is_base_unit 
                ? 'Base unit: conversion factor is always 1'
                : 'How many base units equal this unit'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Conversion Preview</label>
            <div className="text-sm font-medium">
              {getConversionPreview()}
            </div>
          </div>
        </div>
      </div>

      {/* Price Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
          Pricing
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Base Price <span className="text-gray-400 font-normal">(per base unit)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.base_price || ''}
              onChange={e => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
              disabled={loading}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              placeholder="0"
            />
          </div>
          {errors.base_price && <p className="text-red-500 text-sm mt-1">{errors.base_price}</p>}
          <p className="text-gray-500 text-xs mt-1">
            {baseUnit 
              ? `Price per 1 ${baseUnit.metric_units?.unit_name || 'base unit'}` 
              : 'Price per 1 base unit of this product'}
          </p>
        </div>
      </div>

      {/* Usage Flags Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
          Usage & Status
        </h3>

        <div className="space-y-3">
          {/* Is Base Unit */}
          <label className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
            formData.is_base_unit 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="checkbox"
              checked={formData.is_base_unit}
              onChange={e => setFormData({ ...formData, is_base_unit: e.target.checked })}
              disabled={loading}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">Base Unit</span>
              <p className="text-xs text-gray-500">Satuan dasar untuk konversi (hanya 1 per produk)</p>
            </div>
            {formData.is_base_unit && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                Required
              </span>
            )}
          </label>

          {/* Default Stock */}
          <label className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
            formData.is_default_stock_unit 
              ? 'border-green-500 bg-green-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="checkbox"
              checked={formData.is_default_stock_unit}
              onChange={e => setFormData({ ...formData, is_default_stock_unit: e.target.checked })}
              disabled={loading}
              className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">Default Stock Unit</span>
              <p className="text-xs text-gray-500">Untuk laporan stok gudang</p>
            </div>
            {formData.is_default_stock_unit && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                Stock
              </span>
            )}
          </label>

          {/* Default Purchase */}
          <label className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
            formData.is_default_purchase_unit 
              ? 'border-purple-500 bg-purple-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="checkbox"
              checked={formData.is_default_purchase_unit}
              onChange={e => setFormData({ ...formData, is_default_purchase_unit: e.target.checked })}
              disabled={loading}
              className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">Default Purchase Unit</span>
              <p className="text-xs text-gray-500">Untuk pembelian dari supplier</p>
            </div>
            {formData.is_default_purchase_unit && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                Purchase
              </span>
            )}
          </label>

          {/* Default Transfer */}
          <label className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
            formData.is_default_transfer_unit 
              ? 'border-orange-500 bg-orange-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="checkbox"
              checked={formData.is_default_transfer_unit}
              onChange={e => setFormData({ ...formData, is_default_transfer_unit: e.target.checked })}
              disabled={loading}
              className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">Default Transfer Unit</span>
              <p className="text-xs text-gray-500">Untuk transfer antar gudang/cabang</p>
            </div>
            {formData.is_default_transfer_unit && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                Transfer
              </span>
            )}
          </label>
        </div>

        {/* Status */}
        <div className="pt-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <div className="flex gap-3">
            <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              formData.status_uom === 'ACTIVE'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="status_uom"
                value="ACTIVE"
                checked={formData.status_uom === 'ACTIVE'}
                onChange={e => setFormData({ ...formData, status_uom: e.target.value as UomStatus })}
                disabled={loading}
                className="w-4 h-4 text-green-600"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
            <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              formData.status_uom === 'INACTIVE'
                ? 'border-gray-400 bg-gray-100'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="status_uom"
                value="INACTIVE"
                checked={formData.status_uom === 'INACTIVE'}
                onChange={e => setFormData({ ...formData, status_uom: e.target.value as UomStatus })}
                disabled={loading}
                className="w-4 h-4 text-gray-600"
              />
              <span className="text-sm font-medium">Inactive</span>
            </label>
          </div>
          <p className="text-gray-500 text-xs mt-1">
            {formData.status_uom === 'INACTIVE' 
              ? 'Inactive units cannot be used in transactions' 
              : 'Active units are available for use'}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={loading || isLoadingUnits}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? 'Saving...' : uom ? 'Update UOM' : 'Create UOM'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading || isLoadingUnits}
          className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

