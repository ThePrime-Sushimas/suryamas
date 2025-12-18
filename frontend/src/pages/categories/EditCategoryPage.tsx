import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { categoryService } from '@/services/categoryService'
import { CategoryForm } from '@/components/categories/CategoryForm'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { Category } from '@/types/category'

export default function EditCategoryPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const res = await categoryService.getById(id!)
        setCategory(res.data.data)
      } catch (err) {
        setError('Failed to load category')
      } finally {
        setLoading(false)
      }
    }
    fetchCategory()
  }, [id])

  const handleSubmit = async (data: any) => {
    setLoading(true)
    try {
      await categoryService.update(id!, data)
      navigate('/categories')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update category')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/categories')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Categories
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Category</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {category && <CategoryForm category={category} onSubmit={handleSubmit} loading={loading} />}
        </div>
      </div>
    </div>
  )
}
