import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subCategoryService } from '@/services/categoryService'
import { SubCategoryForm } from '@/components/sub-categories/SubCategoryForm'
import { ArrowLeft } from 'lucide-react'

export default function CreateSubCategoryPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: any) => {
    setLoading(true)
    setError(null)
    try {
      await subCategoryService.create(data)
      navigate('/sub-categories')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create sub-category')
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New SubCategory</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <SubCategoryForm onSubmit={handleSubmit} loading={loading} />
        </div>
      </div>
    </div>
  )
}
