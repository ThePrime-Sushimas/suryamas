import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategoriesStore } from '../store/categories.store'
import { CategoryTable } from '../components/CategoryTable'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const { categories, loading, fetchCategories, searchCategories, deleteCategory } = useCategoriesStore()
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (search) {
      searchCategories(search, 1, 1000)
    } else {
      fetchCategories(1, 1000)
    }
  }, [search])

  const handleDelete = async (id: string) => {
    if (confirm('Delete this category?')) {
      try {
        await deleteCategory(id)
      } catch (error) {
        console.error('Delete failed')
      }
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button onClick={() => navigate('/categories/new')} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Add Category
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <input
          type="text"
          placeholder="Search categories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <CategoryTable
          categories={categories}
          onView={id => navigate(`/categories/${id}`)}
          onEdit={id => navigate(`/categories/${id}/edit`)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
