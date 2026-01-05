import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { subCategoriesApi } from '../api/categories.api'
import type { SubCategoryWithCategory } from '../types'
import { ArrowLeft, Edit, Calendar, FolderOpen } from 'lucide-react'

export default function SubCategoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [subCategory, setSubCategory] = useState<SubCategoryWithCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    
    const fetchSubCategory = async () => {
      try {
        setLoading(true)
        const data = await subCategoriesApi.getById(id)
        setSubCategory(data as SubCategoryWithCategory)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load sub-category'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchSubCategory()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error || !subCategory) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Sub-category not found'}</p>
          <button
            onClick={() => navigate('/sub-categories')}
            className="text-blue-600 hover:underline"
          >
            Back to Sub-Categories
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/sub-categories')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Sub-Categories
          </button>
          <button
            onClick={() => navigate(`/sub-categories/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header Section */}
          <div className="bg-linear-to-r from-purple-600 to-purple-700 px-8 py-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm mb-1">Sub-Category Code</p>
                <h1 className="text-3xl font-bold">{subCategory.sub_category_code}</h1>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="px-8 py-6 space-y-6">
            {/* Parent Category */}
            {subCategory.category && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-blue-700 uppercase tracking-wide mb-2">
                  <FolderOpen className="w-4 h-4" />
                  Parent Category
                </label>
                <p className="text-lg font-semibold text-blue-900">{subCategory.category.category_name}</p>
                <p className="text-sm text-blue-600 mt-1">Code: {subCategory.category.category_code}</p>
              </div>
            )}

            {/* Sub-Category Name */}
            <div>
              <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Sub-Category Name</label>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{subCategory.sub_category_name}</p>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Description</label>
              <p className="mt-1 text-gray-700 leading-relaxed">
                {subCategory.description || <span className="text-gray-400 italic">No description provided</span>}
              </p>
            </div>

            {/* Sort Order */}
            <div>
              <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Sort Order</label>
              <p className="mt-1 text-lg text-gray-900">{subCategory.sort_order}</p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-200">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 uppercase tracking-wide">
                  <Calendar className="w-4 h-4" />
                  Created At
                </label>
                <p className="mt-1 text-gray-900">{new Date(subCategory.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 uppercase tracking-wide">
                  <Calendar className="w-4 h-4" />
                  Updated At
                </label>
                <p className="mt-1 text-gray-900">{new Date(subCategory.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
