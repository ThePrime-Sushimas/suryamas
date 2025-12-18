import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { subCategoryService } from '@/services/categoryService'
import type { SubCategory } from '@/types/category'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'

export default function SubCategoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [subCategory, setSubCategory] = useState<SubCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSubCategory = async () => {
      try {
        const res = await subCategoryService.getById(id!)
        setSubCategory(res.data.data)
      } catch (err) {
        setError('Failed to load sub-category')
      } finally {
        setLoading(false)
      }
    }
    fetchSubCategory()
  }, [id])

  const handleRestore = async () => {
    try {
      const res = await subCategoryService.restore(id!)
      setSubCategory(res.data.data)
      setTimeout(() => navigate('/sub-categories'), 1500)
    } catch (err) {
      setError('Failed to restore sub-category')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (error || !subCategory) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/sub-categories')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{error || 'Sub-category not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  const isDeleted = subCategory.is_deleted === true

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/sub-categories')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">{subCategory.sub_category_name}</h1>
            {isDeleted && <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">Deleted</span>}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <p className="mt-1 text-gray-900">{subCategory.sub_category_code}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Category ID</label>
              <p className="mt-1 text-gray-900">{subCategory.category_id}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <p className="mt-1 text-gray-900">{subCategory.description || '-'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Sort Order</label>
              <p className="mt-1 text-gray-900">{subCategory.sort_order}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Created At</label>
              <p className="mt-1 text-gray-900">{new Date(subCategory.created_at).toLocaleString()}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Updated At</label>
              <p className="mt-1 text-gray-900">{new Date(subCategory.updated_at).toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            {isDeleted ? (
              <button
                onClick={handleRestore}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
              >
                Restore
              </button>
            ) : (
              <button
                onClick={() => navigate(`/sub-categories/${id}/edit`)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Edit
              </button>
            )}
            <button
              onClick={() => navigate('/sub-categories')}
              className="bg-gray-300 text-gray-900 px-6 py-2 rounded-lg hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
