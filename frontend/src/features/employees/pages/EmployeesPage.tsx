import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmployeeStore } from '@/features/employees'
import { useToast } from '@/contexts/ToastContext'
import { useBulkSelection } from '@/hooks/_shared/useBulkSelection'

import { EmployeeListItem } from '@/features/employees/components/EmployeeListItem'
import { EmployeeDetailPanel } from '@/features/employees/components/EmployeeDetailPanel'
import BulkActionBar from '@/components/BulkActionBar'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

import { Users, Plus, Search, Filter, X } from 'lucide-react'

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
  const [showFilter, setShowFilter] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const {
    selectedIds,
    selectedCount,
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
        const filters = buildFilters(query)
        const hasFilters = Object.keys(filters).length > 0
        
        if (query.search || hasFilters) {
          await searchEmployees(query.search || '', query.sort, query.order, filters, query.page, query.limit, controller.signal)
        } else {
          await fetchEmployees(query.sort, query.order, query.page, query.limit, controller.signal)
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError' && !controller.signal.aborted) {
          console.error('Failed to load employees:', err)
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
  const handleFilterChange = useCallback((key: keyof QueryState, value: string) => {
    setQuery(q => ({ ...q, [key]: value, page: 1 }))
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
    
    // Validate BEFORE showing confirm
    const validIds = selectedIds.filter(id => employees.some(e => e.id === id))
    if (validIds.length === 0) {
      toastError('Selected employees no longer available. Please refresh.')
      clearSelection()
      return
    }
    
    if (validIds.length !== selectedIds.length) {
      toastError(`${selectedIds.length - validIds.length} employee(s) no longer available`)
    }
    
    setConfirm({
      open: true,
      title: 'Delete Multiple Employees',
      message: `Delete ${validIds.length} employee(s)? This action cannot be undone.`,
      action: async () => {
        await bulkDelete(validIds)
        success(`${validIds.length} employee(s) deleted`)
        clearSelection()
      }
    })
  }, [selectedCount, selectedIds, employees, bulkDelete, success, toastError, clearSelection])

  const handleBulkActive = useCallback((active: boolean) => {
    if (selectedCount === 0) return
    
    // Validate BEFORE showing confirm
    const validIds = selectedIds.filter(id => employees.some(e => e.id === id))
    if (validIds.length === 0) {
      toastError('Selected employees no longer available. Please refresh.')
      clearSelection()
      return
    }
    
    if (validIds.length !== selectedIds.length) {
      toastError(`${selectedIds.length - validIds.length} employee(s) no longer available`)
    }
    
    setConfirm({
      open: true,
      title: active ? 'Set Active' : 'Set Inactive',
      message: `Update ${validIds.length} employee(s) to ${active ? 'Active' : 'Inactive'}?`,
      action: async () => {
        await bulkUpdateActive(validIds, active)
        success(`${validIds.length} employee(s) updated`)
        clearSelection()
      }
    })
  }, [selectedCount, selectedIds, employees, bulkUpdateActive, success, toastError, clearSelection])

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
      clearSelection()
    }
  }, [confirm, isConfirming, toastError, clearSelection])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (query.branch) count++
    if (query.position) count++
    if (query.status) count++
    if (query.isActive) count++
    return count
  }, [query.branch, query.position, query.status, query.isActive])

  const bulkActions = useMemo(() => [
    { label: 'Set Active', onClick: () => handleBulkActive(true), className: 'px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700' },
    { label: 'Set Inactive', onClick: () => handleBulkActive(false), className: 'px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700' },
    { label: 'Delete', onClick: handleBulkDelete, className: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700' }
  ], [handleBulkActive, handleBulkDelete])

  // Memoized export filter
  const selectedEmployee = useMemo(() => 
    employees.find(e => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Employees</h1>
              <p className="text-sm text-gray-500">{pagination?.total || 0} total</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/employees/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search employees..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilter ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilter && (
          <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-200">
            <select
              value={query.branch}
              onChange={e => handleFilterChange('branch', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">All Branches</option>
              {filterOptions?.branches.map(b => <option key={b.id} value={b.branch_name}>{b.branch_name}</option>)}
            </select>
            <select
              value={query.position}
              onChange={e => handleFilterChange('position', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">All Positions</option>
              {filterOptions?.positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={query.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">All Status</option>
              {filterOptions?.statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={query.isActive}
              onChange={e => handleFilterChange('isActive', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">All Active Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <div className="px-6 py-2 bg-blue-50 border-b border-blue-200">
          <BulkActionBar selectedCount={selectedCount} actions={bulkActions} />
        </div>
      )}

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* List Panel */}
        <div className="w-96 flex flex-col bg-white border-r border-gray-200">
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : employees.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {query.search ? 'No employees found' : 'No employees'}
              </div>
            ) : (
              employees.map(employee => (
                <EmployeeListItem
                  key={employee.id}
                  employee={employee}
                  isSelected={isSelected(employee.id)}
                  isActive={selectedEmployeeId === employee.id}
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  onSelect={(id) => selectOne(id, !isSelected(id))}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="p-3 border-t border-gray-200 text-center text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setQuery(q => ({ ...q, page: q.page - 1 }))}
                  disabled={!pagination.hasPrev}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  Previous
                </button>
                <button
                  onClick={() => setQuery(q => ({ ...q, page: q.page + 1 }))}
                  disabled={!pagination.hasNext}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex-1">
          {selectedEmployee ? (
            <EmployeeDetailPanel
              employee={selectedEmployee}
              onClose={() => setSelectedEmployeeId(null)}
              onEdit={id => navigate(`/employees/edit/${id}`)}
              onDelete={handleDelete}
              onManageBranches={id => navigate(`/employees/${id}/branches`)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select an employee to view details</p>
              </div>
            </div>
          )}
        </div>
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
