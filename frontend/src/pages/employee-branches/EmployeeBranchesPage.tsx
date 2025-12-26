import { useState } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { employeeBranchService } from '@/services/employeeBranchService'
import { EmployeeBranchTable } from '@/components/employee-branches/EmployeeBranchTable'
import { EmployeeBranchForm } from '@/components/employee-branches/EmployeeBranchForm'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { useEmployeeBranchesList } from '@/hooks/useEmployeeBranches'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { EmployeeBranchFilter } from '@/types/employeeBranch'
import { PAGINATION } from '@/constants/branches.constants'

export function EmployeeBranchesPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { success, error: showError } = useToast()
  
  const [page, setPage] = useState<number>(PAGINATION.DEFAULT_PAGE)
  const [limit, setLimit] = useState<number>(PAGINATION.DEFAULT_LIMIT)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  
  const filter: EmployeeBranchFilter | null = search ? { search } : null
  const { data, pagination, loading, error, refetch } = useEmployeeBranchesList(page, limit, filter)
  
  const { selectedIds, selectOne, selectAll, clearSelection } = useBulkSelection(data)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  
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
    const item = data.find(d => d.id === id)
    setConfirmModal({
      isOpen: true,
      title: 'Delete Assignment',
      message: `Remove ${item?.employee_name} from ${item?.branch_name}?`,
      onConfirm: async () => {
        setDeleteLoading(true)
        try {
          await employeeBranchService.delete(id)
          success('Assignment deleted successfully')
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
          refetch()
        } catch (err: any) {
          showError(err.response?.data?.error || 'Failed to delete assignment')
        } finally {
          setDeleteLoading(false)
        }
      },
    })
  }

  const handleBulkDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Multiple Assignments',
      message: `Delete ${selectedIds.length} assignment(s)?`,
      onConfirm: async () => {
        setBulkLoading(true)
        try {
          await employeeBranchService.bulkDelete(selectedIds)
          success(`${selectedIds.length} assignment(s) deleted`)
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
          clearSelection()
          refetch()
        } catch (err: any) {
          showError(err.response?.data?.error || 'Failed to delete assignments')
        } finally {
          setBulkLoading(false)
        }
      },
    })
  }

  const handleSetPrimary = async (employeeId: string, branchId: string) => {
    try {
      await employeeBranchService.setPrimaryBranch(employeeId, branchId)
      success('Primary branch updated')
      refetch()
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to set primary branch')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Employee Branches</h1>
              <p className="text-gray-600 mt-2">Manage employee branch assignments</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Add new assignment"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              {isMobile ? 'Add' : 'New Assignment'}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by employee or branch..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              aria-label="Search assignments"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <span className="font-medium text-blue-900">{selectedIds.length} selected</span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-5 w-5" />
              Delete Selected
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3" role="alert">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Assignments</h2>
            <p className="text-gray-600 text-sm mt-1">
              {loading ? 'Loading...' : `Total: ${pagination.total} assignments`}
            </p>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <TableSkeleton rows={limit} columns={5} />
            ) : (
              <EmployeeBranchTable
                data={data}
                loading={loading}
                onDelete={handleDelete}
                onSetPrimary={handleSetPrimary}
                onSelectionChange={(ids) => ids.forEach(id => selectOne(id, true))}
                onEdit={(id) => navigate(`/employee-branches/${id}/edit`)}
              />
            )}
          </div>
        </div>

        {/* Pagination */}
        {!loading && pagination.total > 0 && (
          <div className="flex items-center justify-between py-4 px-4 bg-white border-t border-gray-200 rounded-lg">
            <div className="text-sm text-gray-600">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= pagination.total}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <EmployeeBranchForm
          onSubmit={async (assignments) => {
            try {
              for (const assignment of assignments) {
                await employeeBranchService.create(assignment)
              }
              success('Assignments created successfully')
              setShowForm(false)
              refetch()
            } catch (err: any) {
              showError(err.response?.data?.error || 'Failed to create assignments')
            }
          }}
          onCancel={() => setShowForm(false)}
          loading={false}
          loadingData={false}
          employees={[]}
          branches={[]}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
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
