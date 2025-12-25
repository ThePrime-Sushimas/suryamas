import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BranchTable } from '@/components/branches/BranchTable'
import { Pagination } from '@/components/branches/Pagination'
import { BranchBulkActions } from '@/components/branches/BranchBulkActions'
import { useToast } from '@/hooks/useToast'
import { branchService } from '@/services/branchService'
import type { Branch } from '@/types/branch'
import { Search, Building, Plus, Loader2, AlertCircle } from 'lucide-react'
import { useBulkSelection } from '@/hooks/useBulkSelection'

function BranchesPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ field: string; order: 'asc' | 'desc' } | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const { selectedIds, selectOne, selectAll, clearSelection } = useBulkSelection(branches)

  const fetchBranches = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = search
        ? await branchService.search(search, page, limit, sort)
        : await branchService.list(page, limit, sort)
      setBranches(res.data.data)
      setPagination(res.data.pagination)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load branches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [search, JSON.stringify(sort)])

  useEffect(() => {
    fetchBranches()
  }, [page, limit, search, JSON.stringify(sort)])

  const handleDelete = async (id: string) => {
    if (confirm('Delete this branch?')) {
      try {
        await branchService.delete(id)
        success('Branch deleted')
        fetchBranches()
      } catch (err: any) {
        showError(err.response?.data?.error || 'Failed to delete')
      }
    }
  }

  const handleBulkDelete = async () => {
    setBulkLoading(true)
    try {
      await branchService.bulkDelete(selectedIds)
      success('Branches deleted')
      clearSelection()
      fetchBranches()
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to delete')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkUpdateStatus = async (status: string) => {
    setBulkLoading(true)
    try {
      await branchService.bulkUpdateStatus(selectedIds, status)
      success('Status updated')
      clearSelection()
      fetchBranches()
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to update')
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Building className="h-8 w-8 text-blue-600" />
                Branches Management
              </h1>
              <p className="text-gray-600 mt-2">Manage and monitor all your branches</p>
            </div>
            <button
              onClick={() => navigate('/branches/new')}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all font-medium"
            >
              <Plus className="h-5 w-5" />
              Add New Branch
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search branches..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="mb-6">
            <BranchBulkActions
              selectedIds={selectedIds}
              onBulkDelete={handleBulkDelete}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              isLoading={bulkLoading}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              ×
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600 text-lg">Loading branches...</p>
          </div>
        ) : (
          <>
            {/* Table Section */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-6">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Branch List</h2>
                <p className="text-gray-600 text-sm mt-1">Total: {pagination.total} branches</p>
              </div>

              <div className="overflow-x-auto">
                <BranchTable
                  branches={branches}
                  onView={id => navigate(`/branches/${id}`)}
                  onEdit={id => navigate(`/branches/${id}/edit`)}
                  onDelete={handleDelete}
                  canEdit={true}
                  canDelete={true}
                  onSort={(field, order) => setSort({ field, order })}
                  sortField={sort?.field}
                  sortOrder={sort?.order}
                />
              </div>
            </div>

            {/* Pagination */}
            <Pagination
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default BranchesPage
