import { useState, useEffect } from 'react'
import type { Product, CreateProductDto, UpdateProductDto } from '../../types/product'
import { productService } from '../../services/productService'

interface ProductFormProps {
  product?: Product
  categories: any[]
  subCategories: any[]
  onSubmit: (data: CreateProductDto | UpdateProductDto) => void
  onCancel?: () => void
  isLoading?: boolean
}

export const ProductForm = ({
  product,
  categories,
  subCategories,
  onSubmit,
  isLoading = false,
}: ProductFormProps) => {
  const [formData, setFormData] = useState<any>({
    product_code: '',
    product_name: '',
    category_id: '',
    sub_category_id: '',
    is_requestable: true,
    is_purchasable: true,
  })
  const [nameError, setNameError] = useState<string>('')
  const [checkingName, setCheckingName] = useState(false)

  useEffect(() => {
    if (!product && !formData.product_code) {
      const code = `PRD${Date.now().toString().slice(-8)}`
      setFormData((prev: any) => ({ ...prev, product_code: code }))
    }
    if (product) {
      setFormData({
        product_code: product.product_code,
        product_name: product.product_name,
        bom_name: product.bom_name || '',
        category_id: product.category_id,
        sub_category_id: product.sub_category_id,
        is_requestable: product.is_requestable,
        is_purchasable: product.is_purchasable,
        notes: product.notes || '',
        status: product.status,
      })
    }
  }, [product])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const target = e.target as HTMLInputElement
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? target.checked : value,
    }))

    if (name === 'product_name') {
      setNameError('')
      if (value.trim()) {
        checkProductName(value.trim())
      }
    }
  }

  const checkProductName = async (name: string) => {
    setCheckingName(true)
    try {
      const response = await productService.checkProductName(name, product?.id)
      if (response.data.data.exists) {
        setNameError('Product name already exists')
      }
    } catch (error) {
      console.error('Error checking product name:', error)
    } finally {
      setCheckingName(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (nameError) {
      return
    }
    if (product) {
      const { product_code, ...updateData } = formData
      onSubmit(updateData)
    } else {
      onSubmit(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Product Code *</label>
          <input
            type="text"
            name="product_code"
            value={formData.product_code}
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Product Name *</label>
          <input
            type="text"
            name="product_name"
            value={formData.product_name}
            onChange={handleChange}
            required
            className={`w-full px-3 py-2 border rounded ${
              nameError ? 'border-red-500 bg-red-50' : ''
            }`}
            placeholder="Product Name"
          />
          {checkingName && <p className="text-sm text-gray-500 mt-1">Checking...</p>}
          {nameError && <p className="text-sm text-red-600 mt-1">{nameError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Category *</label>
          <select
            name="category_id"
            value={formData.category_id}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">- Select Category -</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.category_name || cat.name || 'Unnamed'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Sub Category *</label>
          <select
            name="sub_category_id"
            value={formData.sub_category_id}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">- Select Sub Category -</option>
            {subCategories.map(subCat => (
              <option key={subCat.id} value={subCat.id}>{subCat.sub_category_name || subCat.name || 'Unnamed'}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Notes</label>
        <textarea
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded"
          rows={3}
          placeholder="Product notes"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="is_requestable"
            checked={formData.is_requestable}
            onChange={handleChange}
            className="rounded"
          />
          <span className="text-sm">Requestable</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="is_purchasable"
            checked={formData.is_purchasable}
            onChange={handleChange}
            className="rounded"
          />
          <span className="text-sm">Purchasable</span>
        </label>
      </div>

      {product && (
        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <select
            name="status"
            value={formData.status || 'ACTIVE'}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DISCONTINUED">Discontinued</option>
          </select>
        </div>
      )}

      <div className="flex gap-4 justify-end">
        <button
          type="submit"
          disabled={isLoading || nameError !== '' || checkingName}
          className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:bg-gray-400"
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
