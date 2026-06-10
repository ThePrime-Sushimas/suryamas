import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Search, X, History, SlidersHorizontal, PackagePlus } from 'lucide-react'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { Pagination } from '@/components/ui/Pagination'
import { useStockBalances, useWarehouses } from '../api/inventory.api'
import type { StockBalance } from '../types'
import StockHistoryModal from './StockHistoryModal'
import AdjustStockModal from './AdjustStockModal'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

export default function StockBalancesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [hasStockOnly, setHasStockOnly] = useState(true)
  const [historyTarget, setHistoryTarget] = useState<StockBalance | null>(null)
  const [adjustTarget, setAdjustTarget] = useState<StockBalance | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const { data: warehousesData } = useWarehouses({ limit: 50 })
  const warehouseOptions = warehousesData?.data ?? []

  const queryParams = useMemo(() => ({
    page, limit: 50,
    search: debouncedSearch || undefined,
    warehouse_id: warehouseFilter || undefined,
    has_stock: hasStockOnly ? 'true' : undefined,
  }), [page, debouncedSearch, warehouseFilter, hasStockOnly])

  const { data, isLoading } = useStockBalances(queryParams)
  const balances = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Stock Gudang</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} item</p>
            </div>
          </div>
          <button onClick={() => navigate('/inventory/opening-balance')}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
            <PackagePlus className="w-4 h-4" /> <span className="hidden sm:inline">Saldo Awal</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari produk..." value={search} onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
            {search && <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex gap-2">
            <select value={warehouseFilter} onChange={e => { setWarehouseFilter(e.target.value); setPage(1) }}
              className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Gudang</option>
              {warehouseOptions.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg whitespace-nowrap">
              <input type="checkbox" checked={hasStockOnly} onChange={e => { setHasStockOnly(e.target.checked); setPage(1) }}
                className="rounded border-gray-300 dark:border-gray-600 text-emerald-600" />
              <span className="hidden sm:inline">Hanya ada stok</span>
              <span className="sm:hidden">Stok &gt; 0</span>
            </label>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cabang</th>                
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gudang</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Value</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                  ))
                ) : balances.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Tidak ada data stok</td></tr>
                ) : balances.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{b.branch_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{b.warehouse_name}</td>                  
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{b.product_name}</div>
                      <div className="text-xs text-gray-500">{b.product_code}</div>
                    </td>                    
                    <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                      {fmt(b.qty)} <span className="text-xs text-gray-400">{b.base_unit_name || ''}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">Rp {fmt(b.avg_cost)}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900 dark:text-gray-200">Rp {fmt(b.qty * b.avg_cost)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => setHistoryTarget(b)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400" title="Riwayat">
                          <History className="w-4 h-4" />
                        </button>
                        <button onClick={() => setAdjustTarget(b)} className="text-orange-600 hover:text-orange-800 dark:text-orange-400" title="Penyesuaian">
                          <SlidersHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}
              </div>
            ) : balances.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400 text-sm">Tidak ada data stok</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {balances.map(b => (
                  <div key={b.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{b.product_name}</p>
                        <p className="text-xs text-gray-500">{b.product_code} · {b.warehouse_name}</p>
                      </div>
                      <div className="flex gap-2 shrink-0 ml-2">
                        <button onClick={() => setHistoryTarget(b)} className="p-1.5 text-blue-600 dark:text-blue-400"><History className="w-4 h-4" /></button>
                        <button onClick={() => setAdjustTarget(b)} className="p-1.5 text-orange-600 dark:text-orange-400"><SlidersHorizontal className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <div>
                        <span className="text-gray-500">Qty</span>
                        <p className="font-mono font-medium text-gray-900 dark:text-white">{fmt(b.qty)} {b.base_unit_name || ''}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Avg Cost</span>
                        <p className="font-mono text-gray-600 dark:text-gray-400">Rp {fmt(b.avg_cost)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Value</span>
                        <p className="font-mono font-medium text-gray-900 dark:text-white">Rp {fmt(b.qty * b.avg_cost)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={() => {}} currentLength={balances.length} loading={isLoading} />
        )}
      </div>

      {historyTarget && (
        <StockHistoryModal
          warehouseId={historyTarget.warehouse_id}
          productId={historyTarget.product_id}
          productName={historyTarget.product_name}
          warehouseName={historyTarget.warehouse_name}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {adjustTarget && (
        <AdjustStockModal
          balance={adjustTarget}
          onClose={() => setAdjustTarget(null)}
        />
      )}
    </div>
  )
}
