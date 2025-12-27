import { useEffect, useCallback, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, ChevronDown, ChevronRight, Building2, Star, Trash2, Search, UserCheck } from 'lucide-react'
import { useEmployeeBranchesStore } from '../store/employeeBranches.store'
import { PrimaryBranchModal } from '../components/PrimaryBranchModal'
import { useToast } from '@/contexts/ToastContext'
import type { EmployeeBranch } from '../api/types'

export default function EmployeeBranchesPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { items, loading, list, remove, setPrimary } = useEmployeeBranchesStore()
  
  const [modalState, setModalState] = useState<{
    show: boolean
    employeeId: string
    employeeName: string
    branchId: string
    branchName: string
  }>({ show: false, employeeId: '', employeeName: '', branchId: '', branchName: '' })
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  
  const filteredItems = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(i => 
      i.employee_name.toLowerCase().includes(q) ||
      i.branch_name.toLowerCase().includes(q) ||
      i.branch_code.toLowerCase().includes(q)
    )
  }, [items, search])
  
  const grouped = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      if (!acc[item.employee_id]) {
        acc[item.employee_id] = { employee_name: item.employee_name, branches: [] }
      }
      acc[item.employee_id].branches.push(item)
      return acc
    }, {} as Record<string, { employee_name: string; branches: EmployeeBranch[] }>)
  }, [filteredItems])
  
  const stats = useMemo(() => ({
    total: items.length,
    employees: Object.keys(grouped).length,
    branches: new Set(items.map(i => i.branch_id)).size,
    primary: items.filter(i => i.is_primary).length
  }), [items, grouped])

  useEffect(() => {
    list({ page: 1, limit: 100 })
  }, [list])

  // const onPageChange = useCallback((newPage: number) => {
  //   list({ page: newPage, limit })
  // }, [list, limit])

  const onDelete = useCallback(async (row: EmployeeBranch) => {
    if (row.is_primary) {
      showError('Tidak dapat menghapus primary branch')
      return
    }
    if (!confirm(`Hapus ${row.employee_name} dari ${row.branch_name}?`)) return
    const ok = await remove(row.id)
    if (ok) success('Data berhasil dihapus')
    else showError('Gagal menghapus data')
  }, [remove, success, showError])
  
  const toggleExpand = useCallback((employeeId: string) => {
    setExpanded(prev => ({ ...prev, [employeeId]: !prev[employeeId] }))
  }, [])

  const onSetPrimary = useCallback(async (row: EmployeeBranch) => {
    if (row.is_primary) return
    
    // Check if employee has other primary branch
    const hasPrimary = items.some(i => i.employee_id === row.employee_id && i.is_primary)
    
    if (hasPrimary) {
      setModalState({
        show: true,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        branchId: row.branch_id,
        branchName: row.branch_name
      })
    } else {
      const ok = await setPrimary(row.employee_id, row.branch_id)
      if (ok) success(`Set ${row.branch_name} sebagai primary`)
      else showError('Gagal set primary branch')
    }
  }, [items, setPrimary, success, showError])
  
  const handleModalConfirm = useCallback(async () => {
    const ok = await setPrimary(modalState.employeeId, modalState.branchId)
    if (ok) {
      success(`Primary branch berhasil diganti ke ${modalState.branchName}`)
      setModalState(prev => ({ ...prev, show: false }))
    } else {
      showError('Gagal mengganti primary branch')
    }
  }, [modalState, setPrimary, success, showError])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
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
            >
              <Plus className="w-4 h-4" />
              Tambah Penempatan
            </button>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Penempatan</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Karyawan</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.employees}</p>
                </div>
                <UserCheck className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cabang</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.branches}</p>
                </div>
                <Building2 className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Primary</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.primary}</p>
                </div>
                <Star className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari karyawan atau cabang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Grouped List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading.list ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum ada penempatan</h3>
              <p className="text-gray-600 mb-4">Mulai dengan menambahkan penempatan karyawan ke cabang</p>
              <button
                onClick={() => navigate('./create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Tambah Penempatan Pertama
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(grouped).map(([employeeId, { employee_name, branches }]) => {
                const isExpanded = expanded[employeeId] ?? false
                return (
                  <div key={employeeId}>
                    <button
                      onClick={() => toggleExpand(employeeId)}
                      className="w-full bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 flex items-center justify-between hover:from-blue-100 hover:to-blue-200 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                          {employee_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-900">{employee_name}</h3>
                          <p className="text-sm text-gray-600">{branches.length} cabang</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
                    </button>
                    {isExpanded && (
                      <div className="bg-white">
                        {branches.map(branch => (
                          <div key={branch.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-t">
                            <div className="flex items-center gap-3 flex-1">
                              <Building2 className="w-5 h-5 text-gray-400" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{branch.branch_name}</span>
                                  <span className="text-sm text-gray-500">({branch.branch_code})</span>
                                  {branch.is_primary && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 font-medium">
                                      <Star className="w-3 h-3 mr-1 fill-current" />
                                      Primary
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!branch.is_primary && (
                                <button
                                  onClick={() => onSetPrimary(branch)}
                                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline px-2 py-1"
                                >
                                  Set Primary
                                </button>
                              )}
                              <button
                                onClick={() => onDelete(branch)}
                                disabled={branch.is_primary}
                                className="text-sm text-red-600 hover:text-red-700 hover:underline px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title={branch.is_primary ? 'Set branch lain sebagai primary terlebih dahulu' : ''}
                              >
                                <Trash2 className="w-4 h-4" />
                                Hapus
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      
      <PrimaryBranchModal
        isOpen={modalState.show}
        onClose={() => setModalState(prev => ({ ...prev, show: false }))}
        onConfirm={handleModalConfirm}
        employeeName={modalState.employeeName}
        targetBranchName={modalState.branchName}
        isLoading={loading.setPrimary}
      />
    </div>
  )
}
