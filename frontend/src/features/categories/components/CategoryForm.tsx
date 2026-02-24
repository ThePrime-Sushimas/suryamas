import { useState } from 'react'
import type { Category, CreateCategoryDto, UpdateCategoryDto } from '../types'

interface CategoryFormProps {
  initialData?: Category
  isEdit?: boolean
  onSubmit: (data: CreateCategoryDto | UpdateCategoryDto) => Promise<void>
  isLoading?: boolean
}

export const CategoryForm = ({ initialData, isEdit, onSubmit, isLoading }: CategoryFormProps) => {
  const [formData, setFormData] = useState({
    category_code: initialData?.category_code || '',
    category_name: initialData?.category_name || '',
    description: initialData?.description || '',
    sort_order: initialData?.sort_order || 0,
    is_active: initialData?.is_active ?? true
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setFormData(prev => ({ ...prev, [e.target.name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(isEdit 
      ? { category_name: formData.category_name, description: formData.description, sort_order: Number(formData.sort_order), is_active: formData.is_active } 
      : formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category Code *</label>
          <input name="category_code" value={formData.category_code} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category Name *</label>
        <input name="category_name" value={formData.category_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
        <textarea name="description" value={formData.description} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" rows={3} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sort Order</label>
        <input type="number" name="sort_order" value={formData.sort_order} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
      </div>
      {isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
          <select 
            name="is_active" 
            value={formData.is_active ? 'true' : 'false'} 
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      )}
      <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
        {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
      </button>
    </form>
  )
}
