import { useState } from 'react'
import type { SubCategory } from '../types'

interface SubCategoryFormProps {
  initialData?: SubCategory
  isEdit?: boolean
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export const SubCategoryForm = ({ initialData, isEdit, onSubmit, isLoading }: SubCategoryFormProps) => {
  const [formData, setFormData] = useState({
    category_id: initialData?.category_id || '',
    sub_category_code: initialData?.sub_category_code || '',
    sub_category_name: initialData?.sub_category_name || '',
    description: initialData?.description || '',
    sort_order: initialData?.sort_order || 0
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(isEdit ? {
      sub_category_name: formData.sub_category_name,
      description: formData.description,
      sort_order: Number(formData.sort_order)
    } : formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <>
          <div>
            <label className="block text-sm font-medium">Category ID *</label>
            <input name="category_id" value={formData.category_id} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
          </div>
          <div>
            <label className="block text-sm font-medium">Sub-Category Code *</label>
            <input name="sub_category_code" value={formData.sub_category_code} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
          </div>
        </>
      )}
      <div>
        <label className="block text-sm font-medium">Sub-Category Name *</label>
        <input name="sub_category_name" value={formData.sub_category_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea name="description" value={formData.description} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" rows={3} />
      </div>
      <div>
        <label className="block text-sm font-medium">Sort Order</label>
        <input type="number" name="sort_order" value={formData.sort_order} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
      </div>
      <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
        {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
      </button>
    </form>
  )
}
