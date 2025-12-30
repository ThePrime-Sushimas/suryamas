import { useEffect, useCallback, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, Building2, Search, ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import type { EmployeeBranch } from '../api/types'

export default function EmployeeBranchesPage() {
  const navigate = useNavigate()
  const { items, total, loading, list } = useEmployeeBranchesStore()
  
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isSearching, setIsSearching] = useState(false)
  const itemsPerPage = 10
  
  const grouped = useMemo(() => {
    return items.reduce((acc, item) => {
      if (!acc[item.employee_id]) {
        acc[item.employee_id] = { employee_name: item.employee_name, branches: [] }
      }
      acc[item.employee_id].branches.push(item)
      return acc
    }, {} as Record<string, { employee_name: string; branches: EmployeeBranch[] }>)
  }, [items])

  useEffect(() => {
    setIsSearching(true)
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
      setIsSearching(false)
    }, 300)
    return () => {
      clearTimeout(timer)
      setIsSearching(false)
    }
  }, [search])

  useEffect(() => {
    list({ page: currentPage, limit: itemsPerPage, search: debouncedSearch })
  }, [list, currentPage, debouncedSearch])

  const getPrimaryBranch = useCallback((employeeId: string) => {
    return items.find(i => i.employee_id === employeeId && i.is_primary)
  }, [items])

  const getBranchCount = useCallback((employeeId: string) => {
    return items.filter(i => i.employee_id === employeeId).length
  }, [items])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Employee Branches</h1>
                <p className="text-sm text-gray-600 mt-0.5">Kelola penempatan karyawan di cabang</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('./create')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-sm"
              aria-label="Add new employee branch assignment"
            >
              <Plus className="w-4 h-4" />
              Tambah Penempatan
            </button>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              id="employee-branch-search"
              name="search"
              placeholder="Cari karyawan atau cabang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading.list ? (
            <div className="p-12">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {debouncedSearch ? 'No results found' : 'Belum ada penempatan'}
              </h3>
              <p className="text-gray-600 mb-4">
                {debouncedSearch ? `No employees or branches match "${debouncedSearch}"` : 'Mulai dengan menambahkan penempatan karyawan ke cabang'}
              </p>
              {!debouncedSearch && (
                <button
                  onClick={() => navigate('./create')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Penempatan Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Branch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Branches</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(grouped).map(([employeeId, { employee_name }]) => {
                    const primaryBranch = getPrimaryBranch(employeeId)
                    const branchCount = getBranchCount(employeeId)
                    return (
                      <tr key={employeeId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                              {employee_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="font-medium text-gray-900">{employee_name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {primaryBranch ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900">{primaryBranch.branch_name}</span>
                              <span className="text-xs text-gray-500">({primaryBranch.branch_code})</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500 italic">No primary</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {branchCount} {branchCount === 1 ? 'branch' : 'branches'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => navigate(`/employees/${employeeId}/branches`)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                          >
                            <Settings className="w-4 h-4" />
                            Manage Branches
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading.list && Object.keys(grouped).length > 0 && (
          <div className="mt-6 flex items-center justify-between bg-white rounded-lg border border-gray-200 px-6 py-4">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, total)} of {total} assignments
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(total / itemsPerPage) }, (_, i) => i + 1)
                  .filter(p => {
                    const totalPages = Math.ceil(total / itemsPerPage)
                    if (totalPages <= 7) return true
                    if (p === 1 || p === totalPages) return true
                    if (p >= currentPage - 1 && p <= currentPage + 1) return true
                    return false
                  })
                  .map((p, i, arr) => {
                    const prev = arr[i - 1]
                    const showEllipsis = prev && p - prev > 1
                    return (
                      <div key={p} className="flex items-center">
                        {showEllipsis && <span className="px-2 text-gray-400">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`px-3 py-2 rounded-lg transition-colors ${
                            currentPage === p
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      </div>
                    )
                  })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / itemsPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(total / itemsPerPage)}
                className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
