import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BranchTable } from '@/components/branches/BranchTable'
import { Pagination } from '@/components/branches/Pagination'
import { BranchBulkActions } from '@/components/branches/BranchBulkActions'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { branchService } from '@/services/branchService'
import { useBranchesList } from '@/hooks/useBranches'
import type { BranchSort, BranchFilter } from '@/types/branch'
import { Search, Building, Plus, AlertCircle } from 'lucide-react'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { PAGINATION } from '@/constants/branches.constants'

function BranchesPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [page, setPage] = useState<number>(PAGINATION.DEFAULT_PAGE)
  const [limit, setLimit] = useState<number>(PAGINATION.DEFAULT_LIMIT)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<BranchSort | null>(null)
  
  // Auto-fetch with dependencies
  const filter: BranchFilter | null = search ? { search } : null
  const { data: branches, pagination, loading, error, refetch } = useBranchesList(page, limit, sort, filter)
  
  const [bulkLoading, setBulkLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { selectedIds, selectOne, selectAll, clearSelection } = useBulkSelection(branches)
  
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  const handleDelete = (id: string) => {
    const branch = branches.find(b => b.id === id)
    setConfirmModal({
      isOpen: true,
      title: 'Delete Branch',
      message: `Are you sure you want to delete "${branch?.branch_name}"? This action cannot be undone.`,
      onConfirm: async () => {
        setDeleteLoading(true)
        try {
          await branchService.delete(id)
          success('Branch deleted successfully')
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
          refetch()
        } catch (err: any) {
          showError(err.response?.data?.error || 'Failed to delete branch')
        } finally {
          setDeleteLoading(false)
        }
      },
    })
  }

  const handleBulkDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Multiple Branches',
      message: `Are you sure you want to delete ${selectedIds.length} branch(es)? This action cannot be undone.`,
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          await branchService.bulkDelete(selectedIds)
          success(`${selectedIds.length} branch(es) deleted successfully`)
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
          clearSelection()
          refetch()
        } catch (err: any) {
          showError(err.response?.data?.error || 'Failed to delete branches')
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleBulkUpdateStatus = async (status: string) => {
    setBulkLoading(true)
    try {
      await branchService.bulkUpdateStatus(selectedIds, status)
      success(`Status updated for ${selectedIds.length} branch(es)`)
      clearSelection()
      refetch()
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to update status')
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
                <Building className="h-8 w-8 text-blue-600" aria-hidden="true" />
                Branches Management
              </h1>
              <p className="text-gray-600 mt-2">Manage and monitor all your branches</p>
            </div>
            <button
              onClick={() => navigate('/branches/new')}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Add new branch"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Add New Branch
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search branches..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              aria-label="Search branches"
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3" role="alert">
            <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Branch List</h2>
            <p className="text-gray-600 text-sm mt-1">
              {loading ? 'Loading...' : `Total: ${pagination.total} branches`}
            </p>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <TableSkeleton rows={limit} columns={7} />
            ) : (
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
                selectedIds={selectedIds}
                onSelectAll={selectAll}
                onSelectOne={selectOne}
                isAllSelected={selectedIds.length === branches.length && branches.length > 0}
              />
            )}
          </div>
        </div>

        {/* Pagination */}
        {!loading && (
          <Pagination
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteLoading || bulkLoading}
      />
    </div>
  )
}

export default BranchesPage
