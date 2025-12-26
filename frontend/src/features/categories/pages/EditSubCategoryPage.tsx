import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { subCategoriesApi } from '../api/categories.api'
import { useCategoriesStore } from '../store/categories.store'
import { SubCategoryForm } from '../components/SubCategoryForm'
import type { SubCategory } from '../types'

export default function EditSubCategoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateSubCategory, loading: updating } = useCategoriesStore()
  const [subCategory, setSubCategory] = useState<SubCategory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await subCategoriesApi.getById(id || '')
        setSubCategory(data)
      } catch (error) {
        alert('Sub-category not found')
        navigate('/sub-categories')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id, navigate])

  const handleSubmit = async (data: any) => {
    try {
      await updateSubCategory(id || '', data)
      alert('Sub-category updated successfully')
      navigate('/sub-categories')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update sub-category')
    }
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (!subCategory) return <div className="p-4 text-red-600">Sub-category not found</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Sub-Category</h1>
      <SubCategoryForm initialData={subCategory} isEdit onSubmit={handleSubmit} isLoading={updating} />
    </div>
  )
}
