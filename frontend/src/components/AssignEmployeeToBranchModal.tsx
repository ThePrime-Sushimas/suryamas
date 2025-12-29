import { useEffect, useState, useMemo } from 'react'
import api from '@/lib/axios'
import { useToast } from '@/contexts/ToastContext'
import { X, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface Employee {
  id: string
  employee_id: string
  full_name: string
  job_position: string
  email: string | null
}

interface Props {
  isOpen: boolean
  branchId: string
  branchName: string
  onClose: () => void
  onSuccess: () => void
}

export default function AssignEmployeeToBranchModal({ isOpen, branchId, branchName, onClose, onSuccess }: Props) {
  const toast = useToast()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 300

  useEffect(() => {
    if (!isOpen || !branchId) return
    setPage(1)
    setSearch('')
    fetchUnassignedEmployees(1, '')
  }, [isOpen, branchId])

  const fetchUnassignedEmployees = async (currentPage: number, searchQuery: string) => {
    setLoading(true)
    try {
      const params: any = {
        page: currentPage,
        limit
      }
      
      // Use search endpoint if there's a search query
      const endpoint = searchQuery ? '/employees/search' : '/employees'
      if (searchQuery) params.q = searchQuery
      
      // Fetch employees
      const { data } = await api.get(endpoint, { params })
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
      
      // Filter out employees already assigned to this branch
      if (branchId && list.length > 0) {
        try {
          const assignedRes = await api.get(`/employee-branches/branch/${branchId}?limit=1000`)
          const assignedIds = new Set(
            (assignedRes.data?.data || []).map((a: any) => a.employee_id)
          )
          const unassigned = list.filter((emp: any) => !assignedIds.has(emp.id))
          setEmployees(unassigned)
          setTotal(unassigned.length)
        } catch (err) {
          console.error('Failed to fetch assigned employees:', err)
          // If can't fetch assigned, show all
          setEmployees(list)
          setTotal(data?.pagination?.total || list.length)
        }
      } else {
        setEmployees(list)
        setTotal(data?.pagination?.total || list.length)
      }
    } catch (error: any) {
      console.error('Failed to fetch employees:', error)
      toast.error('Failed to load employees. Please try again.')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    fetchUnassignedEmployees(1, value)
  }

  const groupedByPosition = useMemo(
    () => employees.reduce((acc, emp) => {
      const position = emp.job_position || 'Unassigned'
      if (!acc[position]) acc[position] = []
      acc[position].push(emp)
      return acc
    }, {} as Record<string, Employee[]>),
    [employees]
  )

  const sortedPositions = Object.keys(groupedByPosition).sort()
  const totalPages = Math.ceil(total / limit)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(employees.map(e => e.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds)
    if (checked) {
      newSet.add(id)
    } else {
      newSet.delete(id)
    }
    setSelectedIds(newSet)
  }

  const handleAssign = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one employee')
      return
    }

    setAssigning(true)
    toast.info(`Assigning ${selectedIds.size} employee${selectedIds.size > 1 ? 's' : ''}...`)
    
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map(employeeId =>
          api.post(`/employee-branches`, {
            employee_id: employeeId,
            branch_id: branchId,
            is_primary: false
          })
        )
      )
      
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      
      if (failed > 0) {
        toast.warning(`Assigned ${succeeded} employee${succeeded > 1 ? 's' : ''}. ${failed} failed.`)
      } else {
        toast.success(`Successfully assigned ${succeeded} employee${succeeded > 1 ? 's' : ''} to ${branchName}`)
      }
      
      if (succeeded > 0) {
        onSuccess()
        onClose()
        setSelectedIds(new Set())
        setSearch('')
      }
    } catch (error) {
      console.error('Failed to assign employees:', error)
      toast.error('Failed to assign employees. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Assign Employees</h2>
            <p className="text-sm text-gray-600 mt-1">Add employees to <span className="font-semibold">{branchName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No unassigned employees found
            </div>
          ) : (
            <div>
              {/* Select All */}
              <div className="p-4 bg-gray-50 flex items-center gap-3 border-b border-gray-200 sticky top-0">
                <input
                  type="checkbox"
                  checked={selectedIds.size === employees.length && employees.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select all on this page ({employees.length})
                </span>
              </div>

              {/* Employee List Grouped by Position */}
              {sortedPositions.map((position) => (
                <div key={position}>
                  <div className="px-4 py-3 bg-blue-50 border-b border-gray-200 sticky top-12">
                    <p className="text-sm font-semibold text-blue-900">{position} ({groupedByPosition[position].length})</p>
                  </div>
                  {groupedByPosition[position].map((emp) => (
                    <div key={emp.id} className="p-4 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-100">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={(e) => handleSelectOne(emp.id, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{emp.full_name}</p>
                        <p className="text-sm text-gray-600">{emp.employee_id}</p>
                        {emp.email && <p className="text-xs text-gray-500">{emp.email}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const newPage = page - 1
                  setPage(newPage)
                  fetchUnassignedEmployees(newPage, search)
                }}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const newPage = page + 1
                  setPage(newPage)
                  fetchUnassignedEmployees(newPage, search)
                }}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || assigning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
              Assign ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
