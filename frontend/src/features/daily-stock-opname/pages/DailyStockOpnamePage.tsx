import { useState } from 'react'
import { ClipboardCheck, Plus, RefreshCw, Filter, X, Search } from 'lucide-react'
import { useUrlFilters, useListNavigation } from '@/lib/urlFilters'
import { useOpnameList, useCreateOpname } from '../api/dailyStockOpname'
import { OpnameStatusBadge } from '../components/OpnameStatusBadge'
import { CreateOpnameDialog } from '../components/CreateOpnameDialog'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useBranches } from '@/features/branches/api/branches.api'
import { opnameFilterConfig } from '../utils/opnameFilters.url'
import type { DailyClosingCount, OpnameDisplayStatus } from '../types'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function getDisplayStatus(item: DailyClosingCount): OpnameDisplayStatus {
  if (item.status === 'DRAFT') {
    if (item.is_backdate) return 'DRAFT' // backdate DRAFT is not "missed" — it's waiting approval
    const today = todayJakarta()
    if (item.closing_date < today) return 'MISSED'
  }
  return item.status
}

export default function DailyStockOpnamePage() {
  const hasPermission = usePermissionStore(s => s.hasPermission)
  const canInsert = hasPermission('daily_stock_opname', 'insert')
  const { currentBranch } = useBranchContextStore()

  const { filters, searchInput, setSearchInput, setFilters, resetFilters, setPage } =
    useUrlFilters({ ...opnameFilterConfig, searchField: 'search' })
  const { openDetail } = useListNavigation('/inventory/daily-stock-opname')

  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading, refetch, isFetching } = useOpnameList({
    page: filters.page,
    limit: filters.limit,
    branch_id: filters.branch_id || undefined,
    status: (filters.status || undefined) as OpnameDisplayStatus | undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    search: filters.search || undefined,
  })
  const sessions = data?.data ?? []
  const pagination = data?.pagination

  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  const createOpname = useCreateOpname()

  const hasActiveFilters = filters.status || filters.branch_id || filters.date_from || filters.date_to || filters.search

  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const handleCreate = async (data: { branch_id: string; closing_date: string; position_id: string; notes?: string }) => {
    try {
      const result = await createOpname.mutateAsync({
        branch_id: data.branch_id,
        closing_date: data.closing_date,
        position_id: data.position_id,
        notes: data.notes,
      })
      setShowCreateDialog(false)
      openDetail(`/inventory/daily-stock-opname/${result.id}`)
    } catch {
      // Error handled by mutation/toast
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <ClipboardCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Stock Opname
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {pagination?.total ?? 0} sesi opname
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                hasActiveFilters
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            {canInsert && (
              <button
                type="button"
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Mulai Opname
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Branch</label>
                <select
                  value={filters.branch_id}
                  onChange={(e) => setFilters({ branch_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Semua Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ status: e.target.value as typeof filters.status })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Semua Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="FLAGGED">Flagged</option>
                  <option value="REOPENED">Sedang Diedit Ulang</option>
                  <option value="MISSED">Missed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ date_from: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ date_to: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cari PIC</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Nama PIC..."
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                  />
                </div>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-3 w-3" /> Reset Filter
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cabang</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PIC</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Variance Cost</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-6 py-5">
                      <div className="h-5 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
                    </td></tr>
                  ))
                ) : sessions.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-16 text-center">
                    <ClipboardCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">Belum ada sesi opname</p>
                  </td></tr>
                ) : sessions.map(session => {
                  const displayStatus = getDisplayStatus(session)
                  return (
                    <tr
                      key={session.id}
                      onClick={() => openDetail(`/inventory/daily-stock-opname/${session.id}`)}
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 text-gray-900 dark:text-white whitespace-nowrap">
                        {fmtDate(session.closing_date)}
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">
                        {session.branch_name}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {session.position_name ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {session.pic_name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <OpnameStatusBadge status={displayStatus} />
                          {session.is_backdate && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              Backdate
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400 font-mono">
                        {session.completed_count}/{session.line_count}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {session.total_variance_cost
                          ? fmtCurrency(session.total_variance_cost)
                          : '—'
                        }
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline">
                          Lihat
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">Belum ada sesi opname</div>
            ) : sessions.map(session => {
              const displayStatus = getDisplayStatus(session)
              return (
                <div
                  key={session.id}
                  onClick={() => openDetail(`/inventory/daily-stock-opname/${session.id}`)}
                  className="p-4 cursor-pointer hover:bg-blue-50/10 dark:hover:bg-blue-900/5 active:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {session.branch_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmtDate(session.closing_date)} · PIC: {session.pic_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {session.completed_count}/{session.line_count} item
                        {session.total_variance_cost ? ` · ${fmtCurrency(session.total_variance_cost)}` : ''}
                      </p>
                    </div>
                    <OpnameStatusBadge status={displayStatus} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50 p-4">
              <Pagination
                pagination={pagination}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* Create Opname Dialog */}
      <CreateOpnameDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreate}
        isLoading={createOpname.isPending}
        defaultBranchId={currentBranch?.branch_id}
      />
    </div>
  )
}
