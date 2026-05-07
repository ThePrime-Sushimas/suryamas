import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderOpen } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateCategory } from '../api/categories.api'
import { CategoryForm } from '../components/CategoryForm'
import type { CreateCategoryDto, UpdateCategoryDto } from '../types'

export default function CreateCategoryPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createCategory = useCreateCategory()

  const handleSubmit = async (data: CreateCategoryDto | UpdateCategoryDto) => {
    try {
      await createCategory.mutateAsync(data as CreateCategoryDto)
      toast.success('Kategori berhasil dibuat')
      navigate('/categories')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat kategori')) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/categories')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <FolderOpen className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Kategori</h1>
            <p className="text-xs text-gray-400">Buat kategori produk baru</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <CategoryForm onSubmit={handleSubmit} isLoading={createCategory.isPending} />
        </div>
      </div>
    </div>
  )
}
