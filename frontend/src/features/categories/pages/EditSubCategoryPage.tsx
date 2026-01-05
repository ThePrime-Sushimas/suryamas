import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { subCategoriesApi } from '../api/categories.api'
import { useCategoriesStore } from '../store/categories.store'
import { SubCategoryForm } from '../components/SubCategoryForm'
import type { SubCategory, CreateSubCategoryDto, UpdateSubCategoryDto } from '../types'
import { useToast } from '@/contexts/ToastContext'

export default function EditSubCategoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateSubCategory, loading: updating } = useCategoriesStore()
  const [subCategory, setSubCategory] = useState<SubCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const { success, error } = useToast()

  useEffect(() => {
    const controller = new AbortController()
    const fetch = async () => {
      try {
        const data = await subCategoriesApi.getById(id || '')
        if (!controller.signal.aborted) {
          setSubCategory(data)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          error('Sub-category not found')
          navigate('/sub-categories')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }
    fetch()
    return () => controller.abort()
  }, [id, navigate, error])

  const handleSubmit = async (data: CreateSubCategoryDto | UpdateSubCategoryDto) => {
    try {
      await updateSubCategory(id || '', data as UpdateSubCategoryDto)
      success('Sub-category updated successfully')
      navigate('/sub-categories')
    } catch (err: unknown) {
      const message = err instanceof Error && 'response' in err 
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error 
        : 'Failed to update sub-category'
      error(message || 'Failed to update sub-category')
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
