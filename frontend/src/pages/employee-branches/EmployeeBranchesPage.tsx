import { useState, useEffect } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { employeeBranchService } from '@/services/employeeBranchService'
import { employeeService } from '@/services/employeeService'
import { branchService } from '@/services/branchService'
import { EmployeeBranchTable } from '@/components/employee-branches/EmployeeBranchTable'
import { EmployeeBranchForm } from '@/components/employee-branches/EmployeeBranchForm'
import { useUrlState } from '@/hooks/useUrlState'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { EmployeeBranch, CreateEmployeeBranchDto } from '@/types/employeeBranch'

export function EmployeeBranchesPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [data, setData] = useState<EmployeeBranch[]>([])
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string }>>([])
  const [branches, setBranches] = useState<Array<{ id: string; branch_name: string; branch_code: string }>>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<string[]>([])

  const { state, setState } = useUrlState({
    page: '1',
    limit: '10',
    search: '',
  })

  const limit = parseInt(state.limit)
  const page = parseInt(state.page)

  useEffect(() => {
    loadData()
    loadEmployees()
    loadBranches()
  }, [page, limit, state.search])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await employeeBranchService.list(page, limit)
      let filteredData = response.data.data
      
      if (state.search) {
        filteredData = filteredData.filter((item: any) => 
          item.employee_name?.toLowerCase().includes(state.search.toLowerCase()) ||
          item.branch_name?.toLowerCase().includes(state.search.toLowerCase())
        )
      }
      
      setData(filteredData)
      setTotal(response.data.pagination.total)
    } catch (error) {
      console.error('Failed to load employee branches:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async () => {
    try {
      const response = await employeeService.autocomplete('')
      setEmployees(response.data.data || [])
    } catch (error) {
      console.error('Failed to load employees:', error)
    }
  }

  const loadBranches = async () => {
    try {
      const response = await branchService.list(1, 10000)
      setBranches(response.data.data.map(b => ({ id: b.id, branch_name: b.branch_name, branch_code: b.branch_code })))
    } catch (error) {
      console.error('Failed to load branches:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleCreate = async (formData: CreateEmployeeBranchDto[]) => {
    try {
      setLoading(true)
      for (const assignment of formData) {
        await employeeBranchService.create(assignment)
      }
      setShowForm(false)
      setState({ page: '1' })
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create assignment')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return
    try {
      await employeeBranchService.delete(id)
      loadData()
    } catch (error) {
      alert('Failed to delete')
    }
  }

  const handleSetPrimary = async (employeeId: string, branchId: string) => {
    try {
      await employeeBranchService.setPrimaryBranch(employeeId, branchId)
      loadData()
    } catch (error) {
      alert('Failed to set primary branch')
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.length} items?`)) return
    try {
      await employeeBranchService.bulkDelete(selected)
      setSelected([])
      loadData()
    } catch (error) {
      alert('Failed to delete')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setState({ page: '1' })
  }

  const handleClearSearch = () => {
    setState({ search: '', page: '1' })
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 md:mb-6 gap-3">
        <h1 className="text-xl md:text-2xl font-bold">Employee Branches</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[44px] text-sm md:text-base"
        >
          <Plus size={20} /> {isMobile ? 'Add' : 'New Assignment'}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white shadow rounded-lg p-4 md:p-6 mb-4 md:mb-6">
        <form onSubmit={handleSearch} className="space-y-3 md:space-y-4">
          <div className="flex flex-col md:flex-row gap-2 md:gap-3">
            <input
              type="text"
              placeholder="Search by employee or branch..."
              value={state.search}
              onChange={(e) => setState({ search: e.target.value })}
              className="flex-1 px-3 md:px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base min-h-[44px]"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 md:px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm md:text-base min-h-[44px] whitespace-nowrap flex items-center justify-center gap-2"
            >
              <Search size={18} /> {isMobile ? 'Search' : 'Search'}
            </button>
            {state.search && (
              <button
                type="button"
                onClick={handleClearSearch}
                disabled={loading}
                className="bg-gray-300 text-gray-700 px-4 md:px-6 py-2 rounded hover:bg-gray-400 disabled:opacity-50 text-sm md:text-base min-h-[44px] whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Bulk Actions */}
      {selected.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <span className="text-sm md:text-base font-medium text-blue-900">{selected.length} selected</span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors min-h-[44px] text-sm md:text-base"
          >
            <Trash2 size={18} /> Delete Selected
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <EmployeeBranchTable
          data={data}
          loading={loading}
          onDelete={handleDelete}
          onSetPrimary={handleSetPrimary}
          onSelectionChange={setSelected}
          onEdit={(id) => navigate(`/employee-branches/${id}/edit`)}
        />
      </div>

      {/* Pagination */}
      {data.length > 0 && (
        <div className="bg-white shadow rounded-lg p-3 md:p-4 mt-3 md:mt-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <span className="text-xs md:text-sm text-gray-600">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} entries
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm text-gray-600">Rows:</label>
                <select
                  value={state.limit}
                  onChange={(e) => setState({ limit: e.target.value, page: '1' })}
                  className="px-2 py-1 border rounded text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 md:gap-2">
              <button
                onClick={() => setState({ page: '1' })}
                disabled={page === 1}
                className="px-2 md:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm min-h-[44px]"
              >
                {isMobile ? '«' : 'First'}
              </button>
              <button
                onClick={() => setState({ page: String(page - 1) })}
                disabled={page === 1}
                className="px-2 md:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm min-h-[44px]"
              >
                {isMobile ? '‹' : 'Previous'}
              </button>
              <span className="text-xs md:text-sm text-gray-600 px-2">
                {page}/{totalPages || 1}
              </span>
              <button
                onClick={() => setState({ page: String(page + 1) })}
                disabled={page === totalPages || totalPages === 0}
                className="px-2 md:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm min-h-[44px]"
              >
                {isMobile ? '›' : 'Next'}
              </button>
              <button
                onClick={() => setState({ page: String(totalPages) })}
                disabled={page === totalPages || totalPages === 0}
                className="px-2 md:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm min-h-[44px]"
              >
                {isMobile ? '»' : 'Last'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <EmployeeBranchForm
          employees={employees}
          branches={branches}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          loading={loading}
          loadingData={loadingData}
        />
      )}
    </div>
  )
}
