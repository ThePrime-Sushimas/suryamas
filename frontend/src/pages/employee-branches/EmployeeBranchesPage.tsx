import { useState, useEffect } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { employeeBranchService } from '@/services/employeeBranchService'
import { employeeService } from '@/services/employeeService'
import { branchService } from '@/services/branchService'
import { EmployeeBranchTable } from '@/components/employee-branches/EmployeeBranchTable'
import { EmployeeBranchForm } from '@/components/employee-branches/EmployeeBranchForm'
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
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
    loadEmployees()
    loadBranches()
  }, [search])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await employeeBranchService.list(1, 1000)
      let filteredData = response.data.data
      
      if (search) {
        filteredData = filteredData.filter((item: any) => 
          item.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
          item.branch_name?.toLowerCase().includes(search.toLowerCase())
        )
      }
      
      setData(filteredData)
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
  }

  const handleClearSearch = () => {
    setSearch('')
  }

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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 md:px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base min-h-[44px]"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 md:px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm md:text-base min-h-[44px] whitespace-nowrap flex items-center justify-center gap-2"
            >
              <Search size={18} /> {isMobile ? 'Search' : 'Search'}
            </button>
            {search && (
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
