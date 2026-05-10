import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Product, ProductStatus, CreateProductDto, UpdateProductDto } from '../types'
import api from '@/lib/axios'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { STATIONS } from '../constants/stations'

interface ProductFormProps {
  initialData?: Product
  isEdit?: boolean
  onSubmit: (data: CreateProductDto | UpdateProductDto) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

interface Category {
  id: string
  category_name: string
}

interface SubCategory {
  id: string
  sub_category_name: string
  category_id: string
}

export const ProductForm = ({ initialData, isEdit, onSubmit, onCancel, isLoading }: ProductFormProps) => {
  const [formData, setFormData] = useState({
    product_code: initialData?.product_code || '',
    product_name: initialData?.product_name || '',
    bom_name: initialData?.bom_name || '',
    category_id: initialData?.category_id || '',
    sub_category_id: initialData?.sub_category_id || '',
    station: initialData?.station || '',
    average_cost: initialData?.average_cost || 0,
    is_requestable: initialData?.is_requestable ?? true,
    is_purchasable: initialData?.is_purchasable ?? true,
    notes: initialData?.notes || '',
    status: (initialData?.status || 'ACTIVE') as ProductStatus,
    base_unit_id: '',
  })

  const { data: categories = [], isLoading: loadingCat } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => { const { data } = await api.get('/categories'); return (data.data || []) as Category[] },
    staleTime: 5 * 60_000,
  })
  const { data: subCategories = [], isLoading: loadingSub } = useQuery({
    queryKey: ['sub-categories'],
    queryFn: async () => { const { data } = await api.get('/sub-categories', { params: { limit: 200 } }); return (data.data || []) as SubCategory[] },
    staleTime: 5 * 60_000,
  })
  const { data: metricUnits = [] } = useQuery({
    queryKey: ['metric-units'],
    queryFn: async () => { const { data } = await api.get('/metric-units', { params: { limit: 200 } }); return (data.data || []) as { id: string; unit_name: string }[] },
    staleTime: 5 * 60_000,
  })

  const filteredSubCategories = formData.category_id
    ? subCategories.filter(sub => sub.category_id === formData.category_id)
    : []

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    let newValue: string | number | boolean = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    
    // Convert average_cost to number
    if (name === 'average_cost') {
      newValue = parseFloat(value) || 0
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue,
      ...(name === 'category_id' ? { sub_category_id: '' } : {})
    }))
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!isEdit && !formData.product_code.trim()) {
      newErrors.product_code = 'Product code is required'
    }
    if (!formData.product_name.trim()) {
      newErrors.product_name = 'Product name is required'
    }
    if (!formData.category_id) {
      newErrors.category_id = 'Category is required'
    }
    if (!formData.sub_category_id) {
      newErrors.sub_category_id = 'Sub-category is required'
    }
    if (!isEdit && !formData.base_unit_id) {
      newErrors.base_unit_id = 'Satuan dasar wajib dipilih'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) {
      return
    }

    const submitData: CreateProductDto | UpdateProductDto = isEdit ? {
      product_name: formData.product_name,
      bom_name: formData.bom_name || undefined,
      category_id: formData.category_id,
      sub_category_id: formData.sub_category_id,
      station: formData.station || null,
      is_requestable: formData.is_requestable,
      is_purchasable: formData.is_purchasable,
      notes: formData.notes || undefined,
      status: formData.status
    } : {
      product_code: formData.product_code,
      product_name: formData.product_name,
      bom_name: formData.bom_name || undefined,
      category_id: formData.category_id,
      sub_category_id: formData.sub_category_id,
      station: formData.station || null,
      is_requestable: formData.is_requestable,
      is_purchasable: formData.is_purchasable,
      notes: formData.notes || undefined,
      status: formData.status,
      base_unit_id: formData.base_unit_id || undefined,
    }

    await onSubmit(submitData)
  }

  if (loadingCat && loadingSub) {
    return (
      <div className="flex items-center justify-center py-8">
        <CardSkeleton />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Product Code <span className="text-red-500">*</span>
          </label>
          <input
            name="product_code"
            value={formData.product_code}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
              errors.product_code ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="e.g., PROD001"
          />
          {errors.product_code && (
            <p className="mt-1 text-sm text-red-600">{errors.product_code}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Product Name <span className="text-red-500">*</span>
        </label>
        <input
          name="product_name"
          value={formData.product_name}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            errors.product_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
          placeholder="Enter product name"
        />
        {errors.product_name && (
          <p className="mt-1 text-sm text-red-600">{errors.product_name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">BOM Name</label>
        <input
          name="bom_name"
          value={formData.bom_name}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Bill of Materials name (optional)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            name="category_id"
            value={formData.category_id}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
              errors.category_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <option value="">Select category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.category_name}
              </option>
            ))}
          </select>
          {errors.category_id && (
            <p className="mt-1 text-sm text-red-600">{errors.category_id}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Sub-Category <span className="text-red-500">*</span>
          </label>
          <select
            name="sub_category_id"
            value={formData.sub_category_id}
            onChange={handleChange}
            disabled={!formData.category_id}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
              errors.sub_category_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <option value="">Select sub-category</option>
            {filteredSubCategories.map(sub => (
              <option key={sub.id} value={sub.id}>
                {sub.sub_category_name}
              </option>
            ))}
          </select>
          {errors.sub_category_id && (
            <p className="mt-1 text-sm text-red-600">{errors.sub_category_id}</p>
          )}
        </div>
      </div>

      {/* Station */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Station</label>
        <select
          name="station"
          value={formData.station}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
        >
          <option value="">Tidak ada station</option>
          {STATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Satuan Dasar <span className="text-red-500">*</span>
            </label>
            <select
              name="base_unit_id"
              value={formData.base_unit_id}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.base_unit_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <option value="">Pilih satuan dasar</option>
              {metricUnits.map(u => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
            </select>
            {errors.base_unit_id && <p className="mt-1 text-sm text-red-600">{errors.base_unit_id}</p>}
            <p className="mt-1 text-xs text-gray-400">Satuan terkecil (misal: Gram, Mililiter, Pcs)</p>
          </div>
        )}

        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Average Cost</label>
            <input
              type="number"
              name="average_cost"
              value={formData.average_cost}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-gray-400">Otomatis dari pricelist</p>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            name="is_requestable"
            checked={formData.is_requestable}
            onChange={handleChange}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 mr-2 bg-white dark:bg-gray-700"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Requestable</span>
        </label>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            name="is_purchasable"
            checked={formData.is_purchasable}
            onChange={handleChange}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 mr-2 bg-white dark:bg-gray-700"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Purchasable</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="DISCONTINUED">Discontinued</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          rows={3}
          placeholder="Additional notes (optional)"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {isEdit ? 'Updating...' : 'Creating...'}
            </span>
          ) : (
            isEdit ? 'Update Product' : 'Create Product'
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
