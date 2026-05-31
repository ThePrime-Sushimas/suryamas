import { useState } from 'react'
import { ClipboardList, Plus, RefreshCw, Filter, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUrlFilters } from '@/lib/urlFilters'
import { useDailyPrepOrders } from '../api/dailyPrepOrders.api'
import { DpoStatusBadge } from '../components/DpoStatusBadge'
import { DpoGenerateModal } from '../components/DpoGenerateModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useBranches } from '@/features/branches/api/branches.api'
import { dpoFilterConfig } from '../utils/dpoFilters.url'
import type { DailyPrepOrder } from '../api/dailyPrepOrders.api'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export default function DailyPrepOrdersPage() {
  const navigate = useNavigate()
  const hasPermission = usePermissionStore(s => s.hasPermission)
  const canInsert = hasPermission('daily_prep_orders', 'insert')

  const { filters, setFilters, resetFilters, setPage } = useUrlFilters(dpoFilterConfig)
  const [showGenerate, setShowGenerate] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading, refetch, isFetching } = useDailyPrepOrders({
    page: filters.page,
    limit: filters.limit,
    branch_id: filters.branch_id || undefined,
    status: (filters.status || undefined) as any,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  })
  const orders = data?.data ?? []
  const pagination = data?.pagination

  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  const hasActiveFilters = filters.status || filters.branch_id || filters.date_from || filters.date_to

  const handleGenerated = (dpo: DailyPrepOrder) => {
    setShowGenerate(false)
    navigate(`/inventory/daily-prep-orders/${dpo.id}`)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Daily Prep Order
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {pagination?.total ?? 0} dokumen
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
                onClick={() => navigate('/inventory/daily-prep-orders/manual/create')}
                className="flex items-center gap-2 px-4 py-2.5 border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl text-sm font-medium transition-all"
              >
                <Plus className="w-4 h-4" /> Manual DPO
              </button>
            )}
            {canInsert && (
              <button
                type="button"
                onClick={() => setShowGenerate(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" /> Generate DPO
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                  <option value="CANCELLED">Cancelled</option>
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">No. DPO</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cabang</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tgl Operasional</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Gudang</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dikonfirmasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-6 py-5">
                      <div className="h-5 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
                    </td></tr>
                  ))
                ) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-16 text-center">
                    <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">Belum ada Daily Prep Order</p>
                  </td></tr>
                ) : orders.map(dpo => (
                  <tr
                    key={dpo.id}
                    onClick={() => navigate(`/inventory/daily-prep-orders/${dpo.id}`)}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-blue-700 dark:text-blue-400">
                      {dpo.dpo_number}
                      {dpo.has_upcoming_holiday && (
                        <span className="ml-2 text-xs text-amber-600">🎌 libur</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">{dpo.branch_name}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {fmtDate(dpo.prep_date)}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{dpo.source_warehouse_name}</span>
                      <span className="mx-1 text-gray-300">→</span>
                      <span>{dpo.target_warehouse_name}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">
                      {dpo.line_count}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <DpoStatusBadge status={dpo.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {dpo.confirmed_by_name
                        ? <span className="text-green-600 dark:text-green-400 font-medium">✓ {dpo.confirmed_by_name}</span>
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
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
            ) : orders.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">Belum ada DPO</div>
            ) : orders.map(dpo => (
              <div
                key={dpo.id}
                onClick={() => navigate(`/inventory/daily-prep-orders/${dpo.id}`)}
                className="p-4 cursor-pointer hover:bg-blue-50/10 dark:hover:bg-blue-900/5 active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">{dpo.dpo_number}</p>
                    <p className="text-sm text-gray-900 dark:text-white">{dpo.branch_name}</p>
                    <p className="text-xs text-gray-500">{fmtDate(dpo.prep_date)} · {dpo.line_count} item</p>
                  </div>
                  <DpoStatusBadge status={dpo.status} />
                </div>
              </div>
            ))}
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

      {showGenerate && (
        <DpoGenerateModal
          onClose={() => setShowGenerate(false)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  )
}
