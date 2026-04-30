import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useCategoriesStore } from '../store/categories.store'
import { SubCategoryForm } from '../components/SubCategoryForm'
import { useToast } from '@/contexts/ToastContext'
import type { CreateSubCategoryDto, UpdateSubCategoryDto } from '../types'

export default function CreateSubCategoryPage() {
  const navigate = useNavigate()
  const { createSubCategory, mutationLoading } = useCategoriesStore()
  const toast = useToast()

  const handleSubmit = async (data: CreateSubCategoryDto | UpdateSubCategoryDto) => {
    try {
      await createSubCategory(data as CreateSubCategoryDto)
      toast.success('Sub-kategori berhasil dibuat')
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tambah Sub-Kategori</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Buat sub-kategori baru</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <SubCategoryForm onSubmit={handleSubmit} isLoading={mutationLoading} />
        </div>
      </div>
    </div>
  )
}
