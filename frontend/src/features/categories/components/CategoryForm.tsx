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
    is_active: initialData?.is_active ?? true,
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

  const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode Kategori *</label>
          <input name="category_code" value={formData.category_code} onChange={handleChange} className={inputClass} required />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Kategori *</label>
        <input name="category_name" value={formData.category_name} onChange={handleChange} className={inputClass} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
        <textarea name="description" value={formData.description} onChange={handleChange} className={inputClass} rows={3} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Urutan</label>
        <input type="number" name="sort_order" value={formData.sort_order} onChange={handleChange} className={inputClass} />
      </div>
      {isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
          <select
            name="is_active"
            value={formData.is_active ? 'true' : 'false'}
            onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
            className={inputClass}
          >
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </div>
      )}
      <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
        {isLoading ? 'Menyimpan...' : isEdit ? 'Perbarui' : 'Buat'}
      </button>
    </form>
  )
}
