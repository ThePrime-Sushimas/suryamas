import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { categoryService } from '@/services/categoryService'
import type { Category } from '@/types/category'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const res = await categoryService.getById(id!)
        console.log('Category response:', res.data)
        setCategory(res.data.data)
      } catch (err) {
        setError('Failed to load category')
      } finally {
        setLoading(false)
      }
    }
    fetchCategory()
  }, [id])

  const handleRestore = async () => {
    try {
      const res = await categoryService.restore(id!)
      setCategory(res.data.data)
      setTimeout(() => navigate('/categories'), 1500)
    } catch (err) {
      setError('Failed to restore category')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (error || !category) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/categories')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{error || 'Category not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  const isDeleted = category.is_deleted === true
  console.log('Category data:', category, 'isDeleted:', isDeleted)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/categories')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">{category.category_name}</h1>
            {isDeleted && <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">Deleted</span>}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <p className="mt-1 text-gray-900">{category.category_code}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <p className="mt-1 text-gray-900">{category.description || '-'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Sort Order</label>
              <p className="mt-1 text-gray-900">{category.sort_order}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Created At</label>
              <p className="mt-1 text-gray-900">{new Date(category.created_at).toLocaleString()}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Updated At</label>
              <p className="mt-1 text-gray-900">{new Date(category.updated_at).toLocaleString()}</p>
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
                onClick={() => navigate(`/categories/${id}/edit`)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Edit
              </button>
            )}
            <button
              onClick={() => navigate('/categories')}
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
