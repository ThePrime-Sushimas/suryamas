import { useState } from 'react'
import type { Category } from '../types'

interface CategoryFormProps {
  initialData?: Category
  isEdit?: boolean
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export const CategoryForm = ({ initialData, isEdit, onSubmit, isLoading }: CategoryFormProps) => {
  const [formData, setFormData] = useState({
    category_code: initialData?.category_code || '',
    category_name: initialData?.category_name || '',
    description: initialData?.description || '',
    sort_order: initialData?.sort_order || 0
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(isEdit ? { category_name: formData.category_name, description: formData.description, sort_order: Number(formData.sort_order) } : formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium">Category Code *</label>
          <input name="category_code" value={formData.category_code} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium">Category Name *</label>
        <input name="category_name" value={formData.category_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" required />
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
