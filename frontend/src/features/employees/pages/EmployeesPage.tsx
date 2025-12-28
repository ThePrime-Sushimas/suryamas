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

import { Users, Plus, Search, AlertCircle, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

type QueryState = {
  page: number
  limit: number
  sort: string
  order: 'asc' | 'desc'
  search: string
  branch?: string
  position?: string
  status?: string
  isActive?: string
}

type EmployeeFilters = {
  branch_name?: string
  job_position?: string
  status_employee?: string
  is_active?: string
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
    filterOptions,
    pagination,
    isLoading
  } = useEmployeeStore()

  const [query, setQuery] = useState<QueryState>({
    page: 1,
    limit: 50,
    sort: 'full_name',
    order: 'asc',
    search: '',
    branch: '',
    position: '',
    status: '',
    isActive: ''
  })

  const [searchInput, setSearchInput] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const {
    selectedIds,
    selectedCount,
    selectAll,
    selectOne,
    clearSelection,
    isSelected
  } = useBulkSelection(employees)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(q => ({ ...q, search: searchInput, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Init filter options once
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])

  // Build filters helper
  const buildFilters = useCallback((q: QueryState): EmployeeFilters => {
    const filters: EmployeeFilters = {}
    if (q.branch) filters.branch_name = q.branch
    if (q.position) filters.job_position = q.position
    if (q.status) filters.status_employee = q.status
    if (q.isActive) filters.is_active = q.isActive
    return filters
  }, [])

  // Declarative data fetch with abort
  useEffect(() => {
    const controller = new AbortController()
    const fetch = async () => {
      try {
        setError(null)
        const filters = buildFilters(query)
        const hasFilters = Object.keys(filters).length > 0
        
        if (query.search || hasFilters) {
          await searchEmployees(query.search || '', query.sort, query.order, filters, query.page, query.limit)
        } else {
          await fetchEmployees(query.sort, query.order, query.page, query.limit)
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load employees')
        }
      }
    }
    fetch()
    return () => controller.abort()
  }, [query, buildFilters, searchEmployees, fetchEmployees])

  // Auto-clear selection when page changes
  useEffect(() => {
    clearSelection()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.page])

  // Handlers
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setQuery(q => ({ ...q, page: 1 }))
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    setQuery(q => ({ ...q, search: '', page: 1 }))
  }, [])

  const handleFilterChange = useCallback((key: keyof QueryState, value: string) => {
    setQuery(q => ({ ...q, [key]: value, page: 1 }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setQuery(q => ({ ...q, branch: '', position: '', status: '', isActive: '', page: 1 }))
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
    if (selectedCount === 0) return
    setConfirm({
      open: true,
      title: 'Delete Multiple Employees',
      message: `Delete ${selectedCount} employee(s)? This action cannot be undone.`,
      action: async () => {
        const validIds = selectedIds.filter(id => employees.some(e => e.id === id))
        if (validIds.length === 0) throw new Error('Selected employees no longer exist')
        await bulkDelete(validIds)
        success(`${validIds.length} employee(s) deleted`)
      }
    })
  }, [selectedCount, selectedIds, employees, bulkDelete, success])

  const handleBulkActive = useCallback((active: boolean) => {
    if (selectedCount === 0) return
    setConfirm({
      open: true,
      title: active ? 'Set Active' : 'Set Inactive',
      message: `Update ${selectedCount} employee(s) to ${active ? 'Active' : 'Inactive'}?`,
      action: async () => {
        const validIds = selectedIds.filter(id => employees.some(e => e.id === id))
        if (validIds.length === 0) throw new Error('Selected employees no longer exist')
        await bulkUpdateActive(validIds, active)
        success(`${validIds.length} employee(s) updated`)
      }
    })
  }, [selectedCount, selectedIds, employees, bulkUpdateActive, success])

  const handleConfirm = useCallback(async () => {
    if (!confirm || isConfirming) return
    setIsConfirming(true)
    try {
      await confirm.action()
      setQuery(q => ({ ...q }))
    } catch (e: any) {
      toastError(e.message || 'Action failed')
    } finally {
      setIsConfirming(false)
      setConfirm(null)
    }
  }, [confirm, isConfirming, toastError])

  const handleImportSuccess = useCallback(() => {
    setShowImport(false)
    setQuery(q => ({ ...q })) // Trigger refetch
  }, [])

  // Memoized export filter
  const exportFilter = useMemo(() => {
    const filters: Record<string, string> = {}
    if (query.search) filters.q = query.search
    if (query.branch) filters.branch_name = query.branch
    if (query.position) filters.job_position = query.position
    if (query.status) filters.status_employee = query.status
    if (query.isActive) filters.is_active = query.isActive
    return filters
  }, [query.search, query.branch, query.position, query.status, query.isActive])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (query.branch) count++
    if (query.position) count++
    if (query.status) count++
    if (query.isActive) count++
    return count
  }, [query.branch, query.position, query.status, query.isActive])

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

        {/* Search & Filter */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <div className="flex gap-2 mb-4">
            <form onSubmit={handleSearchSubmit} className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search by ID, name, email, or phone..."
                  className="w-full pl-12 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  aria-label="Search employees"
                />
                {searchInput && (
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
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${showFilter ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
            >
              <Filter className="h-5 w-5" />
              {activeFilterCount > 0 && <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>}
            </button>
          </div>

          {showFilter && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t">
              <select
                value={query.branch}
                onChange={e => handleFilterChange('branch', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Branches</option>
                {filterOptions?.branches.map(b => <option key={b.id} value={b.branch_name}>{b.branch_name}</option>)}
              </select>
              <select
                value={query.position}
                onChange={e => handleFilterChange('position', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Positions</option>
                {filterOptions?.positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={query.status}
                onChange={e => handleFilterChange('status', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Status</option>
                {filterOptions?.statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={query.isActive}
                onChange={e => handleFilterChange('isActive', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Active Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
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
              {isLoading ? 'Loading...' : `Total: ${pagination?.total || 0} employees`}
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

        {/* Pagination */}
        {pagination && pagination.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Show</span>
              <select
                value={query.limit}
                onChange={e => setQuery(q => ({ ...q, limit: Number(e.target.value), page: 1 }))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="150">150</option>
              </select>
              <span className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuery(q => ({ ...q, page: q.page - 1 }))}
                disabled={!pagination.hasPrev}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setQuery(q => ({ ...q, page: q.page + 1 }))}
                disabled={!pagination.hasNext}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {confirm && (
        <ConfirmModal
          isOpen={confirm.open}
          title={confirm.title}
          message={confirm.message}
          onConfirm={handleConfirm}
          onClose={() => !isConfirming && setConfirm(null)}
          confirmText={isConfirming ? 'Processing...' : 'Confirm'}
          variant="danger"
        />
      )}
    </div>
  )
}
