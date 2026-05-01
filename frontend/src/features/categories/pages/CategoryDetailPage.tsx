import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { categoriesApi } from '../api/categories.api'
import type { Category } from '../types'
import { ArrowLeft, Edit, Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    categoriesApi.getById(id)
      .then(setCategory)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Gagal memuat kategori'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/categories')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 mb-6">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
            <div className="h-24 bg-gray-200 dark:bg-gray-700" />
            <div className="p-8 space-y-6">
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-2/3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/4" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !category) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/categories')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 mb-6">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <p className="mt-2 text-gray-500 dark:text-gray-400">{error || 'Kategori tidak ditemukan'}</p>
            <button onClick={() => navigate('/categories')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              Kembali
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => navigate('/categories')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={() => navigate(`/categories/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-gray-900/50 overflow-hidden">
          <div className="bg-linear-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">Kode Kategori</p>
                <h1 className="text-3xl font-bold">{category.category_code}</h1>
              </div>
              <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                category.is_active ? 'bg-green-500' : 'bg-gray-500'
              }`}>
                {category.is_active ? <><CheckCircle className="w-4 h-4" /> Aktif</> : <><XCircle className="w-4 h-4" /> Nonaktif</>}
              </span>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nama Kategori</label>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{category.category_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Deskripsi</label>
              <p className="mt-1 text-gray-700 dark:text-gray-300 leading-relaxed">
                {category.description || <span className="text-gray-400 dark:text-gray-500 italic">Tidak ada deskripsi</span>}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Urutan</label>
              <p className="mt-1 text-lg text-gray-900 dark:text-white">{category.sort_order}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <Calendar className="w-4 h-4" /> Dibuat
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">{new Date(category.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <Calendar className="w-4 h-4" /> Diperbarui
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">{new Date(category.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
