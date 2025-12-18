import { useState } from 'react'
import type { Category } from '@/types/category'

interface Props {
  category?: Category
  onSubmit: (data: any) => Promise<void>
  loading?: boolean
}

export function CategoryForm({ category, onSubmit, loading }: Props) {
  const [formData, setFormData] = useState({
    category_code: category?.category_code || '',
    category_name: category?.category_name || '',
    description: category?.description || '',
    sort_order: category?.sort_order || 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Category Code</label>
        <input
          type="text"
          value={formData.category_code}
          onChange={e => setFormData({ ...formData, category_code: e.target.value })}
          disabled={!!category}
          maxLength={50}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          placeholder="e.g., ELEC"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Category Name</label>
        <input
          type="text"
          value={formData.category_name}
          onChange={e => setFormData({ ...formData, category_name: e.target.value })}
          maxLength={255}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Electronics"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
        <textarea
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Optional description"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Sort Order</label>
        <input
          type="number"
          value={formData.sort_order}
          onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
      </button>
    </form>
  )
}
