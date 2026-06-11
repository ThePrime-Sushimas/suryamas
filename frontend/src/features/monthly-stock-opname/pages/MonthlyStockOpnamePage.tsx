import { useState } from 'react'
import { ClipboardCheck, Plus, RefreshCw, Filter, X, Search } from 'lucide-react'
import { useUrlFilters, useListNavigation } from '@/lib/urlFilters'
import { useMonthlyOpnameList, useCreateMonthlyOpname } from '../api/monthlyStockOpname'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useBranches } from '@/features/branches/api/branches.api'
import { monthlyOpnameFilterConfig } from '../utils/monthlyOpnameFilters.url'
import { CreateMonthlyOpnameDialog } from '../components/CreateMonthlyOpnameDialog'
import type { MonthlyOpnameStatus } from '../types'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

function StatusBadge({ status }: { status: MonthlyOpnameStatus }) {
  const styles: Record<MonthlyOpnameStatus, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    REOPENED: 'bg-blue-100 text-blue-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

export default function MonthlyStockOpnamePage() {
  const hasPermission = usePermissionStore(s => s.hasPermission)
  const canInsert = hasPermission('monthly_stock_opname', 'insert')
  

  const { filters, searchInput, setSearchInput, setFilters, resetFilters, setPage } =
    useUrlFilters({ ...monthlyOpnameFilterConfig, searchField: 'search' })
  const { openDetail } = useListNavigation('/inventory/monthly-stock-opname')

  const [showFilters, setShowFilters] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const { data, isLoading, refetch, isFetching } = useMonthlyOpnameList({
    page: filters.page,
    limit: filters.limit,
    branch_id: filters.branch_id || undefined,
    warehouse_id: filters.warehouse_id || undefined,
    status: (filters.status || undefined) as MonthlyOpnameStatus | undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    search: filters.search || undefined,
  })
  const sessions = data?.data ?? []
  const pagination = data?.pagination

  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  const createOpname = useCreateMonthlyOpname()

  const hasActiveFilters = filters.status || filters.branch_id || filters.warehouse_id || filters.date_from || filters.date_to || filters.search

  const handleCreate = async (formData: {
    branch_id: string
    warehouse_id: string
    opname_date: string
    scope: 'ALL_PRODUCTS' | 'BY_POSITION'
    position_id?: string
    notes?: string
  }) => {
    try {
      const result = await createOpname.mutateAsync(formData)
      setShowCreateDialog(false)
      openDetail(`/inventory/monthly-stock-opname/${result.id}`)
    } catch {
      // Error handled by mutation/toast
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SO Bulanan</h1>
            <p className="text-sm text-gray-500">Stock Opname Bulanan - Semua Warehouse</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canInsert && (
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Buat SO Bulanan
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor SO atau PIC..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg ${hasActiveFilters ? 'text-indigo-700 bg-indigo-50 border-indigo-300' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'}`}
        >
          <Filter className="h-4 w-4" />
          Filter
          {hasActiveFilters && (
            <button onClick={(e) => { e.stopPropagation(); resetFilters() }} className="ml-1">
              <X className="h-3 w-3" />
            </button>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
            <select
              value={filters.branch_id}
              onChange={(e) => setFilters({ branch_id: e.target.value })}
              className="w-full text-sm border-gray-300 rounded-md"
            >
              <option value="">Semua Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value as MonthlyOpnameStatus | '' })}
              className="w-full text-sm border-gray-300 rounded-md"
            >
              <option value="">Semua Status</option>
              <option value="DRAFT">DRAFT</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="REOPENED">REOPENED</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ date_from: e.target.value })}
              className="w-full text-sm border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ date_to: e.target.value })}
              className="w-full text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. SO</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warehouse</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PIC</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Memuat data...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Tidak ada data SO bulanan</td></tr>
              ) : sessions.map((session) => (
                <tr
                  key={session.id}
                  onClick={() => openDetail(`/inventory/monthly-stock-opname/${session.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm font-medium text-indigo-600">{session.opname_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{fmtDate(session.opname_date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{session.warehouse_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{session.branch_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{session.pic_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={session.status} /></td>
                  <td className="px-4 py-3 text-sm text-gray-700">{session.completed_lines}/{session.total_lines}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {Number(session.total_selisih_value) > 0 ? fmtCurrency(Number(session.total_selisih_value)) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t">
            <Pagination
              pagination={{
                page: filters.page,
                limit: filters.limit,
                total: pagination.total,
                totalPages: pagination.totalPages,
                hasNext: pagination.page < pagination.totalPages,
                hasPrev: pagination.page > 1,
              }}
              onPageChange={setPage}
              showLimitSelect={false}
            />
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateMonthlyOpnameDialog
          onClose={() => setShowCreateDialog(false)}
          onSubmit={handleCreate}
          isLoading={createOpname.isPending}
        />
      )}
    </div>
  )
}
