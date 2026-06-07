import { Plus, ClipboardList, Search, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUrlFilters, useListNavigation } from '@/lib/urlFilters'
import { productionRequestFilterConfig } from '../utils/productionRequestFilters.url'
import { useProductionRequests } from '../api/productionRequests.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  ACCEPTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RECEIVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ACCEPTED: 'Diproses',
  RECEIVED: 'Diterima',
  CANCELLED: 'Dibatalkan',
}

export default function ProductionRequestsPage() {
  const { filters, searchInput, setSearchInput, setFilters, resetFilters, setPage } =
    useUrlFilters({ ...productionRequestFilterConfig, searchField: 'search' })
  const { openDetail } = useListNavigation('/food-production/production-requests')
  const navigate = useNavigate()
  const { branches } = useBranchContextStore()

  const { data, isLoading } = useProductionRequests({
    page: filters.page,
    limit: filters.limit,
    status: filters.status || undefined,
    requesting_branch_id: filters.requesting_branch_id || undefined,
    fulfilling_branch_id: filters.fulfilling_branch_id || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    search: filters.search || undefined,
  })

  const requests = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Request Produksi</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Request pembuatan saos / produk ke central</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/food-production/production-requests/summary')}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium transition-all"
            >
              <BarChart3 className="w-4 h-4" /> Rekap
            </button>
            <button
              onClick={() => openDetail('create')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Buat Request
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Cari nomor request..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Status */}
          <select
            value={filters.status}
            onChange={e => setFilters({ status: e.target.value as any })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="ACCEPTED">Diproses</option>
            <option value="RECEIVED">Diterima</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>

          {/* Requesting branch */}
          <select
            value={filters.requesting_branch_id}
            onChange={e => setFilters({ requesting_branch_id: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Semua Cabang Peminta</option>
            {branches.map(b => (
              <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
            ))}
          </select>

          {/* Date from */}
          <input
            type="date"
            value={filters.date_from}
            onChange={e => setFilters({ date_from: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={e => setFilters({ date_to: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          {(filters.status || filters.requesting_branch_id || filters.fulfilling_branch_id || filters.date_from || filters.date_to || filters.search) && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <ClipboardList className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Belum ada request produksi</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">No. Request</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cabang Peminta</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Central</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {requests.map(r => (
                <tr
                  key={r.id}
                  onClick={() => openDetail(r.id)}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 cursor-pointer"
                >
                  <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{r.request_number}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{r.requesting_branch_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{r.fulfilling_branch_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.request_date}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{r.line_count}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] ?? ''}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700/60 px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {pagination.total} request • Halaman {pagination.page} dari {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <div className="flex gap-2">
            <button
              disabled={!pagination.hasPrev}
              onClick={() => setPage(filters.page - 1)}
              className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Prev
            </button>
            <button
              disabled={!pagination.hasNext}
              onClick={() => setPage(filters.page + 1)}
              className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
