import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { subCategoryService } from '@/services/categoryService'
import { SubCategoryForm } from '@/components/sub-categories/SubCategoryForm'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { SubCategory } from '@/types/category'

export default function EditSubCategoryPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
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

  const handleSubmit = async (data: any) => {
    setLoading(true)
    try {
      await subCategoryService.update(id!, data)
      navigate('/sub-categories')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update sub-category')
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
          onClick={() => navigate('/sub-categories')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to SubCategories
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit SubCategory</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {subCategory && <SubCategoryForm subCategory={subCategory} onSubmit={handleSubmit} loading={loading} />}
        </div>
      </div>
    </div>
  )
}
