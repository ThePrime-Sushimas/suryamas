import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBranchesStore } from '../store/branches.store'
import { BranchTable } from '../components/BranchTable'

export default function BranchesPage() {
  const navigate = useNavigate()
  const { branches, loading, fetchBranches, searchBranches, deleteBranch } = useBranchesStore()
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (search) {
      searchBranches(search, 1, 1000)
    } else {
      fetchBranches(1, 1000)
    }
  }, [search])

  const handleDelete = async (id: string) => {
    if (confirm('Delete this branch?')) {
      try {
        await deleteBranch(id)
      } catch (error) {
        console.error('Delete failed')
      }
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Branches</h1>
        <button
          onClick={() => navigate('/branches/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Add Branch
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <input
          type="text"
          placeholder="Search branches..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <BranchTable
          branches={branches}
          onView={id => navigate(`/branches/${id}`)}
          onEdit={id => navigate(`/branches/${id}/edit`)}
          onDelete={handleDelete}
          canEdit={true}
          canDelete={true}
        />
      )}
    </div>
  )
}
