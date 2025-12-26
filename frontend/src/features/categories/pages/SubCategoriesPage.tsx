import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategoriesStore } from '../store/categories.store'
import { SubCategoryTable } from '../components/SubCategoryTable'

export default function SubCategoriesPage() {
  const navigate = useNavigate()
  const { subCategories, loading, fetchSubCategories, searchSubCategories, deleteSubCategory } = useCategoriesStore()
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (search) {
      searchSubCategories(search, 1, 1000)
    } else {
      fetchSubCategories(1, 1000)
    }
  }, [search])

  const handleDelete = async (id: string) => {
    if (confirm('Delete this sub-category?')) {
      try {
        await deleteSubCategory(id)
      } catch (error) {
        console.error('Delete failed')
      }
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sub-Categories</h1>
        <button onClick={() => navigate('/sub-categories/new')} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Add Sub-Category
        </button>
      </div>
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <input
          type="text"
          placeholder="Search sub-categories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <SubCategoryTable
          subCategories={subCategories}
          onView={id => navigate(`/sub-categories/${id}`)}
          onEdit={id => navigate(`/sub-categories/${id}/edit`)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
