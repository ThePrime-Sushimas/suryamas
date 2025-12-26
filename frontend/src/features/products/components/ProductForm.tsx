import { useState } from 'react'
import type { Product } from '../types'

interface ProductFormProps {
  initialData?: Product
  isEdit?: boolean
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export const ProductForm = ({ initialData, isEdit, onSubmit, isLoading }: ProductFormProps) => {
  const [formData, setFormData] = useState({
    product_code: initialData?.product_code || '',
    product_name: initialData?.product_name || '',
    bom_name: initialData?.bom_name || '',
    category_id: initialData?.category_id || '',
    sub_category_id: initialData?.sub_category_id || '',
    is_requestable: initialData?.is_requestable ?? true,
    is_purchasable: initialData?.is_purchasable ?? true,
    notes: initialData?.notes || '',
    status: initialData?.status || 'ACTIVE'
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setFormData(prev => ({ ...prev, [e.target.name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(isEdit ? {
      product_name: formData.product_name,
      bom_name: formData.bom_name || undefined,
      category_id: formData.category_id,
      sub_category_id: formData.sub_category_id,
      is_requestable: formData.is_requestable,
      is_purchasable: formData.is_purchasable,
      notes: formData.notes || undefined,
      status: formData.status
    } : formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium">Product Code *</label>
          <input name="product_code" value={formData.product_code} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium">Product Name *</label>
        <input name="product_name" value={formData.product_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
      </div>
      <div>
        <label className="block text-sm font-medium">BOM Name</label>
        <input name="bom_name" value={formData.bom_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Category ID *</label>
          <input name="category_id" value={formData.category_id} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Sub-Category ID *</label>
          <input name="sub_category_id" value={formData.sub_category_id} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center">
          <input type="checkbox" name="is_requestable" checked={formData.is_requestable} onChange={handleChange} className="mr-2" />
          Requestable
        </label>
        <label className="flex items-center">
          <input type="checkbox" name="is_purchasable" checked={formData.is_purchasable} onChange={handleChange} className="mr-2" />
          Purchasable
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium">Status</label>
        <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border rounded-md">
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="DISCONTINUED">Discontinued</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" rows={3} />
      </div>
      <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
        {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
      </button>
    </form>
  )
}
