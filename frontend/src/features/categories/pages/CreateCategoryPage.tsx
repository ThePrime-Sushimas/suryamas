import { useNavigate } from 'react-router-dom'
import { useCategoriesStore } from '../store/categories.store'
import { CategoryForm } from '../components/CategoryForm'
import { useToast } from '@/contexts/ToastContext'

export default function CreateCategoryPage() {
  const navigate = useNavigate()
  const { createCategory, loading } = useCategoriesStore()
  const { success, error } = useToast()

  const handleSubmit = async (data: any) => {
    try {
      await createCategory(data)
      success('Category created successfully')
      navigate('/categories')
    } catch (err: any) {
      error(err.response?.data?.error || 'Failed to create category')
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Category</h1>
      <CategoryForm onSubmit={handleSubmit} isLoading={loading} />
    </div>
  )
}
