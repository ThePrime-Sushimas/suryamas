import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { categoriesApi } from '../api/categories.api'
import { useCategoriesStore } from '../store/categories.store'
import { CategoryForm } from '../components/CategoryForm'
import type { Category, CreateCategoryDto, UpdateCategoryDto } from '../types'
import { useToast } from '@/contexts/ToastContext'

export default function EditCategoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateCategory, loading: updating } = useCategoriesStore()
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const { success, error } = useToast()

  useEffect(() => {
    const controller = new AbortController()
    const fetchCategory = async () => {
      try {
        const data = await categoriesApi.getById(id || '')
        if (!controller.signal.aborted) {
          setCategory(data)
        }
      } catch {
        if (!controller.signal.aborted) {
          error('Category not found')
          navigate('/categories')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }
    fetchCategory()
    return () => controller.abort()
  }, [id, navigate, error])

  const handleSubmit = async (data: CreateCategoryDto | UpdateCategoryDto) => {
    try {
      await updateCategory(id || '', data as UpdateCategoryDto)
      success('Category updated successfully')
      navigate('/categories')
    } catch (err: unknown) {
      const message = err instanceof Error && 'response' in err 
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error 
        : 'Failed to update category'
      error(message || 'Failed to update category')
    }
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (!category) return <div className="p-4 text-red-600">Category not found</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Category</h1>
      <CategoryForm initialData={category} isEdit onSubmit={handleSubmit} isLoading={updating} />
    </div>
  )
}
