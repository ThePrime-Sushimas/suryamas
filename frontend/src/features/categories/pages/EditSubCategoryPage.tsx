import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { subCategoriesApi } from '../api/categories.api'
import { useCategoriesStore } from '../store/categories.store'
import { SubCategoryForm } from '../components/SubCategoryForm'
import { useToast } from '@/contexts/ToastContext'
import type { SubCategory, CreateSubCategoryDto, UpdateSubCategoryDto } from '../types'

export default function EditSubCategoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateSubCategory, mutationLoading } = useCategoriesStore()
  const [subCategory, setSubCategory] = useState<SubCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    const controller = new AbortController()
    if (id) {
      subCategoriesApi.getById(id)
        .then(data => { if (!controller.signal.aborted) setSubCategory(data) })
        .catch(() => { if (!controller.signal.aborted) { toast.error('Sub-kategori tidak ditemukan'); navigate('/sub-categories') } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }
    return () => controller.abort()
  }, [id, navigate, toast])

  const handleSubmit = async (data: CreateSubCategoryDto | UpdateSubCategoryDto) => {
    if (!id) return
    try {
      await updateSubCategory(id, data as UpdateSubCategoryDto)
      toast.success('Sub-kategori berhasil diupdate')
      navigate('/sub-categories')
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sub-categories')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Sub-Kategori</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{subCategory?.sub_category_name || 'Loading...'}</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="animate-pulse space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}><div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/4 mb-2" /><div className="h-10 bg-gray-100 dark:bg-gray-700 rounded" /></div>
              ))}
            </div>
          </div>
        ) : !subCategory ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Sub-kategori tidak ditemukan</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <SubCategoryForm initialData={subCategory} isEdit onSubmit={handleSubmit} isLoading={mutationLoading} />
          </div>
        )}
      </div>
    </div>
  )
}
