import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, Building2, Search, Settings } from 'lucide-react'
import { employeeBranchesApi } from '../api/employeeBranches.api'
import { Pagination } from '@/components/ui/Pagination'
import type { GroupedEmployeeBranch } from '../api/types'

export default function EmployeeBranchesPage() {
  const navigate = useNavigate()
  
  const [items, setItems] = useState<GroupedEmployeeBranch[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  })

  useEffect(() => {
    setIsSearching(true)
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPagination(prev => ({ ...prev, page: 1 }))
      setIsSearching(false)
    }, 300)
    return () => {
      clearTimeout(timer)
      setIsSearching(false)
    }
  }, [search])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await employeeBranchesApi.listGrouped({ 
          page: pagination.page, 
          limit: pagination.limit, 
          search: debouncedSearch 
        })
        setItems(result.data)
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
          hasNext: result.pagination.hasNext,
          hasPrev: result.pagination.hasPrev,
        }))
      } catch {
        setItems([])
        setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [pagination.page, pagination.limit, debouncedSearch])

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handleLimitChange = (limit: number) => {
    setPagination(prev => ({ ...prev, page: 1, limit }))
  }

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
          {loading ? (
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
                  {items.map((item) => (
                    <tr key={item.employee_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                            {item.employee_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="font-medium text-gray-900">{item.employee_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.primary_branch ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{item.primary_branch.branch_name}</span>
                            <span className="text-xs text-gray-500">({item.primary_branch.branch_code})</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 italic">No primary</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.total_branches} {item.total_branches === 1 ? 'branch' : 'branches'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => navigate(`/employees/${item.employee_id}/branches`)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                        >
                          <Settings className="w-4 h-4" />
                          Manage Branches
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && items.length > 0 && (
          <Pagination
            pagination={pagination}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            currentLength={items.length}
          />
        )}
      </div>
    </div>
  )
}

