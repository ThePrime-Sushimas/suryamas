import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoryService } from '@/services/categoryService'
import { CategoryTable } from '@/components/categories/CategoryTable'
import type { Category } from '@/types/category'
import { Search, Plus, ChevronLeft, ChevronRight, Loader2, AlertCircle, Tag, Trash2 } from 'lucide-react'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showTrash, setShowTrash] = useState(false)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const fetchCategories = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = showTrash
        ? await categoryService.trash(page, limit)
        : search
          ? await categoryService.search(search, page, limit)
          : await categoryService.list(page, limit)
      setCategories(res.data.data)
      setTotal(res.data.pagination.total)
    } catch (error) {
      setError('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [showTrash, search])

  useEffect(() => {
    fetchCategories()
  }, [page, search, showTrash])

  const handleDelete = async (id: string) => {
    if (confirm('Delete this category?')) {
      try {
        await categoryService.delete(id)
        fetchCategories()
      } catch (error) {
        setError('Failed to delete category')
      }
    }
  }

  const handleRestore = async (id: string) => {
    if (confirm('Restore this category?')) {
      try {
        await categoryService.restore(id)
        fetchCategories()
      } catch (error) {
        setError('Failed to restore category')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Tag className="h-8 w-8 text-blue-600" />
              {showTrash ? 'Trash' : 'Categories'}
            </h1>
          </div>
          {!showTrash && (
            <button
              onClick={() => navigate('/categories/new')}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-5 w-5" />
              Add Category
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="mb-6 space-y-4">
            {!showTrash && (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <button
              onClick={() => setShowTrash(!showTrash)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                showTrash ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Trash2 className="h-5 w-5" />
              {showTrash ? 'View Active' : 'View Trash'}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto mb-6">
                <CategoryTable
                  categories={categories}
                  onView={id => navigate(`/categories/${id}`)}
                  onEdit={id => navigate(`/categories/${id}/edit`)}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                  isTrashView={showTrash}
                />
              </div>

              <div className="flex justify-between items-center">
                <p className="text-gray-600">
                  Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={!hasPrev}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="px-4 py-2">{page}/{totalPages}</span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={!hasNext}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
