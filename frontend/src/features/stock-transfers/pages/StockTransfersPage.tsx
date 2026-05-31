import { Plus, ArrowRightLeft, Search } from 'lucide-react'
import { useUrlFilters, useListNavigation } from '@/lib/urlFilters'
import { stockTransferFilterConfig } from '../utils/stockTransferFilters.url'
import { useStockTransfers } from '../api/stockTransfers.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CONFIRMED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  RETURNED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
}

export default function StockTransfersPage() {
  const { filters, searchInput, setSearchInput, setFilters, resetFilters, setPage } =
    useUrlFilters({ ...stockTransferFilterConfig, searchField: 'search' })
  const { openDetail } = useListNavigation('/inventory/stock-transfers')
  const { branches } = useBranchContextStore()

  const { data, isLoading } = useStockTransfers({
    page: filters.page,
    limit: filters.limit,
    transfer_type: filters.transfer_type || undefined,
    status: filters.status || undefined,
    source_branch_id: filters.source_branch_id || undefined,
    target_branch_id: filters.target_branch_id || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    search: filters.search || undefined,
  })

  const transfers = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Stock Transfer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Transfer barang antar gudang / cabang</p>
          </div>
          <button
            onClick={() => openDetail('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Buat Transfer
          </button>
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
              placeholder="Cari nomor transfer..."
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
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Type */}
          <select
            value={filters.transfer_type}
            onChange={e => setFilters({ transfer_type: e.target.value as any })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Semua Tipe</option>
            <option value="TRANSFER">Transfer</option>
            <option value="LOAN">Loan</option>
          </select>

          {/* Branch */}
          <select
            value={filters.source_branch_id}
            onChange={e => setFilters({ source_branch_id: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Semua Cabang</option>
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

          {(filters.status || filters.transfer_type || filters.source_branch_id || filters.date_from || filters.date_to || filters.search) && (
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
        ) : transfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <ArrowRightLeft className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Belum ada stock transfer</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">No. Transfer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipe</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dari</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ke</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {transfers.map(t => (
                <tr
                  key={t.id}
                  onClick={() => openDetail(t.id)}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 cursor-pointer"
                >
                  <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{t.transfer_number}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.transfer_type === 'LOAN' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      {t.transfer_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    <div className="text-xs">{t.source_branch_name}</div>
                    <div className="text-xs text-gray-400">{t.source_warehouse_name}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    <div className="text-xs">{t.target_branch_name}</div>
                    <div className="text-xs text-gray-400">{t.target_warehouse_name}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.transfer_date}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{t.line_count}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[t.status] ?? ''}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
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
            {pagination.total} transfer • Halaman {pagination.page} dari {Math.ceil(pagination.total / pagination.limit)}
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
