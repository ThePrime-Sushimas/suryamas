import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBranchesStore } from '../store/branches.store'
import { BranchTable } from '../components/BranchTable'
import { useToast } from '@/contexts/ToastContext'

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export default function BranchesPage() {
  const navigate = useNavigate()
  const { branches, loading, fetchBranches, searchBranches, deleteBranch } = useBranchesStore()
  const [search, setSearch] = useState('')
  const { success, error } = useToast()

  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      if (value) {
        searchBranches(value, 1, 1000)
      } else {
        fetchBranches(1, 1000)
      }
    }, 300),
    [searchBranches, fetchBranches]
  )

  useEffect(() => {
    fetchBranches(1, 1000)
  }, [])

  const handleDelete = async (id: string) => {
    if (confirm('Delete this branch?')) {
      try {
        await deleteBranch(id)
        success('Branch deleted successfully')
      } catch (err) {
        error('Failed to delete branch')
        console.error('Delete failed:', err)
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
          onChange={e => {
            setSearch(e.target.value)
            debouncedSearch(e.target.value)
          }}
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
