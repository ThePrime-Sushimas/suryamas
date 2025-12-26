import { useNavigate } from 'react-router-dom'
import { useCategoriesStore } from '../store/categories.store'
import { CategoryForm } from '../components/CategoryForm'

export default function CreateCategoryPage() {
  const navigate = useNavigate()
  const { createCategory, loading } = useCategoriesStore()

  const handleSubmit = async (data: any) => {
    try {
      await createCategory(data)
      alert('Category created successfully')
      navigate('/categories')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create category')
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Category</h1>
      <CategoryForm onSubmit={handleSubmit} isLoading={loading} />
    </div>
  )
}
