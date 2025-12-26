import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeStore } from '@/features/employees'
import { useToast } from '@/contexts/ToastContext'
import { useBulkSelection } from '@/hooks/_shared/useBulkSelection'
import { useIsMobile } from '@/hooks/_shared/useMediaQuery'

import { EmployeeTable } from '@/features/employees'
import EmployeeCard from '@/components/mobile/EmployeeCard'
import BulkActionBar from '@/components/BulkActionBar'
import ImportModal from '@/components/ImportModal'
import ExportButton from '@/components/ExportButton'
import FloatingActionButton from '@/components/mobile/FloatingActionButton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { TableSkeleton } from '@/components/ui/Skeleton'

import { Users, Plus, Search, AlertCircle } from 'lucide-react'

type QueryState = {
  page: number
  limit: number
  sort: string
  order: 'asc' | 'desc'
  search: string
}

type ConfirmState = {
  open: boolean
  title: string
  message: string
  action: () => Promise<void>
} | null

export default function EmployeesPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { success, error: toastError } = useToast()

  const {
    employees,
    fetchEmployees,
    searchEmployees,
    deleteEmployee,
    bulkDelete,
    bulkUpdateActive,
    fetchFilterOptions,
    isLoading
  } = useEmployeeStore()

  const [query, setQuery] = useState<QueryState>({
    page: 1,
    limit: 50,
    sort: 'full_name',
    order: 'asc',
    search: ''
  })

  const [showImport, setShowImport] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  const {
    selectedIds,
    selectedCount,
    selectAll,
    selectOne,
    clearSelection,
    isSelected
  } = useBulkSelection(employees)

  // Init filter options once
  useEffect(() => {
    fetchFilterOptions()
  }, [])

  // Declarative data fetch
  useEffect(() => {
    const fetch = async () => {
      try {
        setError(null)
        if (query.search) {
          await searchEmployees(query.search, query.sort, query.order, {}, query.page, query.limit)
        } else {
          await fetchEmployees(query.sort, query.order, query.page, query.limit)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load employees')
      }
    }
    fetch()
  }, [query])

  // Auto-clear selection when data changes
  useEffect(() => {
    clearSelection()
  }, [employees.length])

  // Handlers
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setQuery(q => ({ ...q, page: 1 }))
  }, [])

  const handleClearSearch = useCallback(() => {
    setQuery(q => ({ ...q, search: '', page: 1 }))
  }, [])

  const handleSort = useCallback((field: string) => {
    setQuery(q => ({
      ...q,
      sort: field,
      order: q.sort === field && q.order === 'asc' ? 'desc' : 'asc',
      page: 1
    }))
  }, [])

  const handleDelete = useCallback((id: string, name: string) => {
    setConfirm({
      open: true,
      title: 'Delete Employee',
      message: `Delete "${name}" permanently? This action cannot be undone.`,
      action: async () => {
        await deleteEmployee(id)
        success('Employee deleted')
      }
    })
  }, [deleteEmployee, success])

  const handleBulkDelete = useCallback(() => {
    setConfirm({
      open: true,
      title: 'Delete Multiple Employees',
      message: `Delete ${selectedCount} employee(s)? This action cannot be undone.`,
      action: async () => {
        await bulkDelete(selectedIds)
        success(`${selectedCount} employee(s) deleted`)
      }
    })
  }, [selectedCount, selectedIds, bulkDelete, success])

  const handleBulkActive = useCallback((active: boolean) => {
    setConfirm({
      open: true,
      title: active ? 'Set Active' : 'Set Inactive',
      message: `Update ${selectedCount} employee(s) to ${active ? 'Active' : 'Inactive'}?`,
      action: async () => {
        await bulkUpdateActive(selectedIds, active)
        success(`${selectedCount} employee(s) updated`)
      }
    })
  }, [selectedCount, selectedIds, bulkUpdateActive, success])

  const handleConfirm = useCallback(async () => {
    if (!confirm) return
    try {
      await confirm.action()
      setQuery(q => ({ ...q })) // Trigger refetch
    } catch (e: any) {
      toastError(e.message || 'Action failed')
    } finally {
      setConfirm(null)
    }
  }, [confirm, toastError])

  const handleImportSuccess = useCallback(() => {
    setShowImport(false)
    setQuery(q => ({ ...q })) // Trigger refetch
  }, [])

  // Memoized export filter
  const exportFilter = useMemo(() => 
    query.search ? { search: query.search } : {}
  , [query.search])

  // Memoized bulk actions
  const bulkActions = useMemo(() => [
    { 
      label: 'Set Active', 
      onClick: () => handleBulkActive(true), 
      className: 'px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700' 
    },
    { 
      label: 'Set Inactive', 
      onClick: () => handleBulkActive(false), 
      className: 'px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700' 
    },
    { 
      label: 'Delete', 
      onClick: handleBulkDelete, 
      className: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700' 
    }
  ], [handleBulkActive, handleBulkDelete])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <FloatingActionButton />

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-600" aria-hidden="true" />
                Employees Management
              </h1>
              <p className="text-gray-600 mt-2">Manage and monitor all your employees</p>
            </div>
            <button
              onClick={() => navigate('/employees/create')}
              className="inline-flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label="Add new employee"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Add New Employee
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" aria-hidden="true" />
              <input
                type="text"
                value={query.search}
                onChange={e => setQuery(q => ({ ...q, search: e.target.value }))}
                placeholder="Search by ID, name, email, or phone..."
                className="w-full pl-12 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                aria-label="Search employees"
              />
              {query.search && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Bulk Actions */}
        {selectedCount > 0 && (
          <div className="mb-6">
            <BulkActionBar selectedCount={selectedCount} actions={bulkActions} />
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          <ExportButton endpoint="/employees" filename="employees" filter={exportFilter} />
          <button
            onClick={() => setShowImport(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm md:text-base min-h-[44px]"
          >
            {isMobile ? 'Import' : 'Import Excel'}
          </button>
        </div>

        <ImportModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onSuccess={handleImportSuccess}
          endpoint="/employees"
          title="Employees"
        />

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
            <h2 className="text-xl font-semibold text-gray-900">Employee List</h2>
            <p className="text-gray-600 text-sm mt-1">
              {isLoading ? 'Loading...' : `Total: ${employees.length} employees`}
            </p>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <TableSkeleton rows={10} columns={10} />
            ) : employees.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {query.search ? 'No employees found' : 'No employees'}
              </div>
            ) : isMobile ? (
              <div className="space-y-3 p-4">
                {employees.map(e => (
                  <EmployeeCard
                    key={e.id}
                    employee={{ ...e, branch_name: e.branch_name ?? '-' }}
                    onDelete={handleDelete}
                    isSelected={isSelected(e.id)}
                    onSelect={selectOne}
                  />
                ))}
              </div>
            ) : (
              <EmployeeTable
                employees={employees}
                onSort={handleSort}
                sortField={query.sort}
                sortOrder={query.order}
                onDelete={handleDelete}
                onView={id => navigate(`/employees/${id}`)}
                onEdit={id => navigate(`/employees/edit/${id}`)}
                selectedIds={selectedIds}
                onSelect={selectOne}
                onSelectAll={selectAll}
              />
            )}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirm && (
        <ConfirmModal
          isOpen={confirm.open}
          title={confirm.title}
          message={confirm.message}
          onConfirm={handleConfirm}
          onClose={() => setConfirm(null)}
          confirmText="Confirm"
          variant="danger"
        />
      )}
    </div>
  )
}
