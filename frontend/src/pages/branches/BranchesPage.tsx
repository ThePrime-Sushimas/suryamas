import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { branchService } from '@/services/branchService'
import { BranchTable } from '@/components/branches/BranchTable'
import type { Branch } from '@/types/branch'

function BranchesPage() {
  const navigate = useNavigate()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Record<string, any>>({})

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const fetchBranches = async () => {
    setLoading(true)
    try {
      const res = search
        ? await branchService.search(search, page, limit, filter)
        : await branchService.list(page, limit, undefined, filter)
      setBranches(res.data.data)
      setTotal(res.data.pagination.total)
    } catch (error) {
      console.error('Failed to fetch branches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBranches()
  }, [page, search, JSON.stringify(filter)])

  const handleDelete = async (id: string) => {
    if (confirm('Delete this branch?')) {
      try {
        await branchService.delete(id)
        fetchBranches()
      } catch (error) {
        console.error('Delete failed')
      }
    }
  }

  const setFilterKey = (key: string, value?: string) => {
    setFilter(prev => {
      const next = { ...prev }
      if (!value) delete next[key]
      else next[key] = value
      return next
    })
    setPage(1)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Branches</h1>
        <button
          onClick={() => navigate('/branches/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Create Branch
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="border rounded-md px-3 py-2"
          />

          <select
            value={filter.status || ''}
            onChange={e => setFilterKey('status', e.target.value || undefined)}
            className="border rounded-md px-3 py-2"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={filter.city || ''}
            onChange={e => setFilterKey('city', e.target.value || undefined)}
            className="border rounded-md px-3 py-2"
          >
            <option value="">All Cities</option>
            <option value="Jakarta">Jakarta</option>
            <option value="Surabaya">Surabaya</option>
            <option value="Bandung">Bandung</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <>
          <BranchTable
            branches={branches}
            onView={id => navigate(`/branches/${id}`)}
            onEdit={id => navigate(`/branches/${id}/edit`)}
            onDelete={handleDelete}
            canEdit={true}
            canDelete={true}
          />

          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-gray-600">
              Page {page} of {totalPages} ({total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={!hasPrev}
                className="px-3 py-2 border rounded-md disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={!hasNext}
                className="px-3 py-2 border rounded-md disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default BranchesPage
