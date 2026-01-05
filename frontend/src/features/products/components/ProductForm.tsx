import { useState, useEffect } from 'react'
import type { Product, ProductStatus, CreateProductDto, UpdateProductDto } from '../types'
import api from '@/lib/axios'

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
    is_requestable: initialData?.is_requestable ?? true,
    is_purchasable: initialData?.is_purchasable ?? true,
    notes: initialData?.notes || '',
    status: (initialData?.status || 'ACTIVE') as ProductStatus
  })

  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [filteredSubCategories, setFilteredSubCategories] = useState<SubCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const [catRes, subCatRes] = await Promise.all([
          api.get('/categories'),
          api.get('/sub-categories')
        ])
        setCategories(catRes.data.data || [])
        setSubCategories(subCatRes.data.data || [])
      } catch (error) {
        console.error('Failed to load categories', error)
      } finally {
        setLoadingCategories(false)
      }
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    if (formData.category_id) {
      setFilteredSubCategories(
        subCategories.filter(sub => sub.category_id === formData.category_id)
      )
    } else {
      setFilteredSubCategories([])
    }
  }, [formData.category_id, subCategories])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    
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
      is_requestable: formData.is_requestable,
      is_purchasable: formData.is_purchasable,
      notes: formData.notes || undefined,
      status: formData.status
    } : formData

    await onSubmit(submitData)
  }

  if (loadingCategories) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Code <span className="text-red-500">*</span>
          </label>
          <input
            name="product_code"
            value={formData.product_code}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.product_code ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., PROD001"
          />
          {errors.product_code && (
            <p className="mt-1 text-sm text-red-600">{errors.product_code}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Product Name <span className="text-red-500">*</span>
        </label>
        <input
          name="product_name"
          value={formData.product_name}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.product_name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter product name"
        />
        {errors.product_name && (
          <p className="mt-1 text-sm text-red-600">{errors.product_name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">BOM Name</label>
        <input
          name="bom_name"
          value={formData.bom_name}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Bill of Materials name (optional)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            name="category_id"
            value={formData.category_id}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.category_id ? 'border-red-500' : 'border-gray-300'
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sub-Category <span className="text-red-500">*</span>
          </label>
          <select
            name="sub_category_id"
            value={formData.sub_category_id}
            onChange={handleChange}
            disabled={!formData.category_id}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
              errors.sub_category_id ? 'border-red-500' : 'border-gray-300'
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

      <div className="flex gap-6">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            name="is_requestable"
            checked={formData.is_requestable}
            onChange={handleChange}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
          />
          <span className="text-sm font-medium text-gray-700">Requestable</span>
        </label>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            name="is_purchasable"
            checked={formData.is_purchasable}
            onChange={handleChange}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
          />
          <span className="text-sm font-medium text-gray-700">Purchasable</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="DISCONTINUED">Discontinued</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
