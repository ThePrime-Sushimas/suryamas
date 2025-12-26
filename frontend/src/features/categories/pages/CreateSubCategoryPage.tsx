import { useNavigate } from 'react-router-dom'
import { useCategoriesStore } from '../store/categories.store'
import { SubCategoryForm } from '../components/SubCategoryForm'

export default function CreateSubCategoryPage() {
  const navigate = useNavigate()
  const { createSubCategory, loading } = useCategoriesStore()

  const handleSubmit = async (data: any) => {
    try {
      await createSubCategory(data)
      alert('Sub-category created successfully')
      navigate('/sub-categories')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create sub-category')
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Sub-Category</h1>
      <SubCategoryForm onSubmit={handleSubmit} isLoading={loading} />
    </div>
  )
}
