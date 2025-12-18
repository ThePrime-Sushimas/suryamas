import { useState, useEffect } from 'react'
import { categoryService } from '@/services/categoryService'
import type { SubCategory, Category } from '@/types/category'

interface Props {
  subCategory?: SubCategory
  onSubmit: (data: any) => Promise<void>
  loading?: boolean
}

export function SubCategoryForm({ subCategory, onSubmit, loading }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [formData, setFormData] = useState({
    category_id: subCategory?.category_id || '',
    sub_category_code: subCategory?.sub_category_code || '',
    sub_category_name: subCategory?.sub_category_name || '',
    description: subCategory?.description || '',
    sort_order: subCategory?.sort_order || 0,
  })

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await categoryService.list(1, 100)
        setCategories(res.data.data)
      } catch (error) {
        console.error('Failed to fetch categories')
      }
    }
    fetchCategories()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Category</label>
        <select
          value={formData.category_id}
          onChange={e => setFormData({ ...formData, category_id: e.target.value })}
          disabled={!!subCategory}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="">Select a category</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.category_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">SubCategory Code</label>
        <input
          type="text"
          value={formData.sub_category_code}
          onChange={e => setFormData({ ...formData, sub_category_code: e.target.value })}
          disabled={!!subCategory}
          maxLength={50}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          placeholder="e.g., LAPTOP"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">SubCategory Name</label>
        <input
          type="text"
          value={formData.sub_category_name}
          onChange={e => setFormData({ ...formData, sub_category_name: e.target.value })}
          maxLength={255}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Laptops"
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
        {loading ? 'Saving...' : subCategory ? 'Update SubCategory' : 'Create SubCategory'}
      </button>
    </form>
  )
}
