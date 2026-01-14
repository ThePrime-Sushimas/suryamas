// Supplier Product Form - Create/Edit form component

import { useState, useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { supplierProductsApi } from '../api/supplierProducts.api'
import { useSupplierSearch } from '../hooks/useSupplierSearch'
import { useProductSearch } from '../hooks/useProductSearch'
import { CURRENCY_OPTIONS, LEAD_TIME_OPTIONS } from '../constants/supplier-product.constants'
import type { CreateSupplierProductDto, UpdateSupplierProductDto, SupplierProduct } from '../types/supplier-product.types'

interface SupplierProductFormProps {
  initialData?: SupplierProduct
  onSubmit: (data: CreateSupplierProductDto | UpdateSupplierProductDto) => Promise<void>
  onCancel: () => void
  submitLabel: string
  isEdit?: boolean
  loading?: boolean
}

export function SupplierProductForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel,
  isEdit,
  loading
}: SupplierProductFormProps) {
  const toast = useToast()
  const supplierSearch = useSupplierSearch()
  const productSearch = useProductSearch()
  const [submitting, setSubmitting] = useState(false)
  const [preferredCount, setPreferredCount] = useState(0)

  const [formData, setFormData] = useState<CreateSupplierProductDto>({
    supplier_id: initialData?.supplier_id || '',
    product_id: initialData?.product_id || '',
    price: initialData?.price || 0,
    currency: initialData?.currency || 'IDR',
    lead_time_days: initialData?.lead_time_days ?? undefined,
    min_order_qty: initialData?.min_order_qty ?? undefined,
    is_preferred: initialData?.is_preferred ?? false,
    is_active: initialData?.is_active ?? true
  })

  // Check preferred supplier count when product changes
  useEffect(() => {
    const controller = new AbortController()
    
    const checkPreferredCount = async () => {
      if (!formData.product_id) {
        setPreferredCount(0)
        return
      }
      try {
        const products = await supplierProductsApi.getByProduct(formData.product_id, false, controller.signal)
        const count = products.filter((p) => p.is_preferred && p.is_active && (!initialData || p.id !== initialData.id)).length
        setPreferredCount(count)
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError' && err.name !== 'CanceledError') {
          toast.error('Failed to check preferred suppliers')
          setPreferredCount(0)
        }
      }
    }
    
    checkPreferredCount()
    return () => controller.abort()
  }, [formData.product_id, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const submitData = { ...formData }
      
      // Remove undefined/null values for optional fields
      if (submitData.lead_time_days === undefined || submitData.lead_time_days === null) {
        delete submitData.lead_time_days
      }
      if (submitData.min_order_qty === undefined || submitData.min_order_qty === null) {
        delete submitData.min_order_qty
      }
      // Only delete currency if explicitly IDR (backend default)
      if (submitData.currency === 'IDR') {
        delete submitData.currency
      }

      if (isEdit) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { supplier_id: _supplier_id, product_id: _product_id, ...updateData } = submitData
        await onSubmit(updateData)
      } else {
        await onSubmit(submitData)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, type, value } = e.target

    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else if (type === 'number' || name === 'lead_time_days') {
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? undefined : Number(value)
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
      {/* Supplier Selection */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Supplier & Product</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier *
            </label>
            <input
              type="text"
              placeholder="Search supplier..."
              value={supplierSearch.search}
              onChange={(e) => supplierSearch.setSearch(e.target.value)}
              disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <select
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleChange}
              required
              disabled={isEdit || supplierSearch.loading}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Select Supplier</option>
              {supplierSearch.suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplier_code} - {supplier.supplier_name}
                </option>
              ))}
            </select>
            {isEdit && <p className="text-xs text-gray-500 mt-1">Supplier cannot be changed</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product *
            </label>
            <input
              type="text"
              placeholder="Search product..."
              value={productSearch.search}
              onChange={(e) => productSearch.setSearch(e.target.value)}
              disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <select
              name="product_id"
              value={formData.product_id}
              onChange={handleChange}
              required
              disabled={isEdit || productSearch.loading}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Select Product</option>
              {productSearch.products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.product_code} - {product.product_name}
                </option>
              ))}
            </select>
            {isEdit && <p className="text-xs text-gray-500 mt-1">Product cannot be changed</p>}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Pricing</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Price *
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CURRENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lead Time & MOQ */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lead Time (Days)
            </label>
            <select
              name="lead_time_days"
              value={formData.lead_time_days ?? ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Lead Time</option>
              {LEAD_TIME_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Order Qty
            </label>
            <input
              type="number"
              name="min_order_qty"
              value={formData.min_order_qty ?? ''}
              onChange={handleChange}
              min="0.01"
              step="0.01"
              placeholder="e.g., 10"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Status Options */}
      <div className="border-t pt-4">
        <div className="space-y-4">
          <div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="is_preferred"
                checked={formData.is_preferred}
                onChange={handleChange}
                disabled={!formData.is_preferred && preferredCount >= 3}
                className="mr-2 w-4 h-4 text-yellow-500 focus:ring-yellow-500 border-gray-300 rounded disabled:opacity-50"
              />
              <span className="text-sm font-medium text-gray-700">Preferred Supplier</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Max 3 preferred suppliers per product
              {formData.product_id && (
                <span className={`ml-2 font-medium ${preferredCount >= 3 ? 'text-red-600' : preferredCount >= 2 ? 'text-yellow-600' : 'text-green-600'}`}>
                  ({preferredCount}/3 used)
                </span>
              )}
            </p>
            {preferredCount >= 3 && !formData.is_preferred && (
              <p className="text-xs text-red-600 mt-1 ml-6">⚠ Maximum preferred suppliers reached for this product</p>
            )}
          </div>
          <div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || submitting}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
