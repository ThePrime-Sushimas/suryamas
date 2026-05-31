import { Plus, Trash2, Search, Scissors } from 'lucide-react'
import { useUrlFilters, useListNavigation } from '@/lib/urlFilters'
import { useStockAdjustments } from '../api/stockAdjustments.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import {
  parsePositiveInt, parseEnum, parseString,
  serializeString, serializeNumber, mergeWithPageReset,
  type UrlFilterBase, type UrlFilterUtils,
} from '@/lib/urlFilters'

type AdjStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | ''
type AdjType = 'WASTE' | 'BREAKDOWN' | ''
const VALID_STATUSES = new Set<AdjStatus>(['DRAFT', 'CONFIRMED', 'CANCELLED', ''])
const VALID_TYPES = new Set<AdjType>(['WASTE', 'BREAKDOWN', ''])

type Filters = UrlFilterBase & { adjustment_type: AdjType; status: AdjStatus; branch_id: string; date_from: string; date_to: string; search: string }
const DEFAULTS: Filters = { page: 1, limit: 25, adjustment_type: '', status: '', branch_id: '', date_from: '', date_to: '', search: '' }

const filterConfig: UrlFilterUtils<Filters> = {
  defaults: DEFAULTS,
  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 25, 100),
    adjustment_type: parseEnum(sp.get('adjustment_type'), VALID_TYPES, ''),
    status: parseEnum(sp.get('status'), VALID_STATUSES, ''),
    branch_id: parseString(sp.get('branch_id')),
    date_from: parseString(sp.get('date_from')),
    date_to: parseString(sp.get('date_to')),
    search: parseString(sp.get('search')),
  }),
  stringify: (f) => {
    const sp = new URLSearchParams()
    const s = (k: string, v: string | null) => { if (v) sp.set(k, v) }
    s('page', serializeNumber(f.page, 1)); s('limit', serializeNumber(f.limit, 25))
    s('adjustment_type', serializeString(f.adjustment_type)); s('status', serializeString(f.status))
    s('branch_id', serializeString(f.branch_id))
    s('date_from', serializeString(f.date_from)); s('date_to', serializeString(f.date_to))
    s('search', serializeString(f.search))
    return sp
  },
  merge: (current, patch) => mergeWithPageReset(current, patch, DEFAULTS, ['adjustment_type', 'status', 'branch_id', 'date_from', 'date_to', 'search']),
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CONFIRMED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function StockAdjustmentsPage() {
  const { filters, searchInput, setSearchInput, setFilters, resetFilters, setPage } =
    useUrlFilters({ ...filterConfig, searchField: 'search' })
  const { openDetail } = useListNavigation('/inventory/stock-adjustments')
  const { branches } = useBranchContextStore()

  const { data, isLoading } = useStockAdjustments({
    page: filters.page, limit: filters.limit,
    adjustment_type: filters.adjustment_type || undefined,
    status: filters.status || undefined,
    branch_id: filters.branch_id || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    search: filters.search || undefined,
  })

  const items = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Waste & Breakdown</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Catat buang barang atau pecah produk</p>
          </div>
          <button onClick={() => openDetail('create')} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm">
            <Plus className="w-4 h-4" /> Buat Baru
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Cari nomor / produk..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <select value={filters.status} onChange={e => setFilters({ status: e.target.value as any })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none">
            <option value="">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select value={filters.adjustment_type} onChange={e => setFilters({ adjustment_type: e.target.value as any })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none">
            <option value="">Semua Tipe</option>
            <option value="WASTE">Waste</option>
            <option value="BREAKDOWN">Breakdown</option>
          </select>
          <select value={filters.branch_id} onChange={e => setFilters({ branch_id: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none">
            <option value="">Semua Cabang</option>
            {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
          <input type="date" value={filters.date_from} onChange={e => setFilters({ date_from: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none" />
          <input type="date" value={filters.date_to} onChange={e => setFilters({ date_to: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none" />
          {(filters.status || filters.adjustment_type || filters.branch_id || filters.date_from || filters.date_to || filters.search) && (
            <button onClick={resetFilters} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">Reset</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Trash2 className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Belum ada data</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipe</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produk Input</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cabang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {items.map(item => (
                <tr key={item.id} onClick={() => openDetail(item.id)} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 cursor-pointer">
                  <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{item.adjustment_number}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${item.adjustment_type === 'WASTE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                      {item.adjustment_type === 'WASTE' ? <Trash2 className="w-3 h-3" /> : <Scissors className="w-3 h-3" />}
                      {item.adjustment_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {item.adjustment_type === 'BREAKDOWN' ? (
                      <>
                        <div className="text-xs font-medium">{item.input_product_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{item.input_product_code}</div>
                      </>
                    ) : (
                      <div className="text-xs font-medium">{item.line_count} produk</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                    {item.adjustment_type === 'BREAKDOWN'
                      ? <>{Number(item.input_qty ?? 0).toLocaleString('id-ID')} <span className="text-xs text-gray-400">{item.input_base_unit_name ?? ''}</span></>
                      : <span className="text-xs text-gray-400">{item.line_count} item</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.branch_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.adjustment_date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[item.status] ?? ''}`}>{item.status}</span>
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
          <span className="text-xs text-gray-500">{pagination.total} item • Halaman {pagination.page} dari {Math.ceil(pagination.total / pagination.limit)}</span>
          <div className="flex gap-2">
            <button disabled={!pagination.hasPrev} onClick={() => setPage(filters.page - 1)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">Prev</button>
            <button disabled={!pagination.hasNext} onClick={() => setPage(filters.page + 1)} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
