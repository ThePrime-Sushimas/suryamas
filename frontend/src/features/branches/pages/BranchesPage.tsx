import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBranchesStore } from '../store/branches.store'
import { BranchTable } from '../components/BranchTable'
import { useToast } from '@/contexts/ToastContext'
import { MapPin, Plus, Search, X } from 'lucide-react'

function debounce(fn: (value: string) => void, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (value: string) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(value), delay)
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
  }, [fetchBranches])

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
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Branches</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{branches.length} total</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/branches/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Branch
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              debouncedSearch(e.target.value)
            }}
            placeholder="Search branches..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
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
    </div>
  )
}
