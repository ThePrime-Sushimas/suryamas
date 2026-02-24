import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { categoriesApi } from '../api/categories.api'
import type { Category } from '../types'
import { ArrowLeft, Edit, Calendar, CheckCircle, XCircle } from 'lucide-react'

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    
    const fetchCategory = async () => {
      try {
        setLoading(true)
        const data = await categoriesApi.getById(id)
        setCategory(data)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load category'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchCategory()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error || !category) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Category not found'}</p>
          <button
            onClick={() => navigate('/categories')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Categories
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/categories')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Categories
          </button>
          <button
            onClick={() => navigate(`/categories/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 overflow-hidden">
          {/* Header Section */}
          <div className="bg-linear-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">Category Code</p>
                <h1 className="text-3xl font-bold">{category.category_code}</h1>
              </div>
              <div className="flex items-center gap-2">
                {category.is_active ? (
                  <span className="flex items-center gap-1 px-3 py-1 bg-green-500 rounded-full text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1 bg-gray-500 rounded-full text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="px-8 py-6 space-y-6">
            {/* Category Name */}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Category Name</label>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{category.category_name}</p>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Description</label>
              <p className="mt-1 text-gray-700 dark:text-gray-300 leading-relaxed">
                {category.description || <span className="text-gray-400 dark:text-gray-500 italic">No description provided</span>}
              </p>
            </div>

            {/* Sort Order */}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sort Order</label>
              <p className="mt-1 text-lg text-gray-900 dark:text-white">{category.sort_order}</p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <Calendar className="w-4 h-4" />
                  Created At
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">{new Date(category.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <Calendar className="w-4 h-4" />
                  Updated At
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">{new Date(category.updated_at).toLocaleString()}</p>
              </div>            
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
