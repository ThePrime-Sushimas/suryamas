import { useState, useMemo } from 'react'
import { BarChart3, TrendingDown, TrendingUp, AlertTriangle, Target, Loader2, Search, X } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import { useBranches } from '@/features/branches/api/branches.api'
import { useStockAnalysis } from '../api/stockAnalysis.api'
import type { StockAnalysisRow, StockAnalysisSummary } from '../api/stockAnalysis.api'

const fmt = (n: number | null | undefined) =>
  n == null ? '-' : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

const fmtRp = (n: number | null | undefined) =>
  n == null ? '-' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const fmtPct = (n: number | null | undefined) =>
  n == null ? '-' : `${n.toFixed(1)}%`

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })

// ─── SUMMARY CARDS ──────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: StockAnalysisSummary | undefined }) {
  if (!summary) return null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
          <TrendingDown className="w-4 h-4" />
          <span className="text-xs font-medium">Kerugian (Kurang)</span>
        </div>
        <p className="text-lg font-bold text-red-700 dark:text-red-300">{fmtRp(summary.total_variance_cost_negative)}</p>
        <p className="text-xs text-gray-500 mt-1">{summary.products_with_negative_variance} produk</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-medium">Surplus (Lebih)</span>
        </div>
        <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmtRp(summary.total_variance_cost_positive)}</p>
        <p className="text-xs text-gray-500 mt-1">{summary.products_with_positive_variance} produk</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
          <Target className="w-4 h-4" />
          <span className="text-xs font-medium">Akurasi Rata-rata</span>
        </div>
        <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmtPct(summary.avg_accuracy_pct)}</p>
        <p className="text-xs text-gray-500 mt-1">{summary.total_products} produk total</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs font-medium">Worst by Cost</span>
        </div>
        {summary.worst_by_cost ? (
          <>
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{summary.worst_by_cost.product_name}</p>
            <p className="text-xs text-red-600 dark:text-red-400">{fmtRp(summary.worst_by_cost.total_rp)}</p>
          </>
        ) : (
          <p className="text-sm text-gray-400">-</p>
        )}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function StockAnalysisPage() {
  const [branchId, setBranchId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [warehouseType, setWarehouseType] = useState<'READY' | 'MAIN' | 'FINISHED_GOODS'>('READY')
  const [onlyVariance, setOnlyVariance] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  const params = useMemo(() => ({
    branch_id: branchId,
    date_from: dateFrom,
    date_to: dateTo,
    warehouse_type: warehouseType,
    only_with_variance: onlyVariance || undefined,
    page,
    limit: 50,
  }), [branchId, dateFrom, dateTo, warehouseType, onlyVariance, page])

  const { data: result, isLoading, isFetching } = useStockAnalysis(params)
  const allRows = result?.data?.rows ?? []
  const summary = result?.data?.summary
  const warehouseName = result?.data?.warehouse_name
  const pagination = result?.pagination

  // Client-side product name filter
  const rows = useMemo(() => {
    if (!productSearch.trim()) return allRows
    const q = productSearch.toLowerCase()
    return allRows.filter(r =>
      r.product_name.toLowerCase().includes(q) ||
      r.product_code.toLowerCase().includes(q)
    )
  }, [allRows, productSearch])

  // Quick date helpers
  const setYesterday = () => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    const str = d.toISOString().split('T')[0]
    setDateFrom(str); setDateTo(str); setPage(1)
  }
  const setLast7Days = () => {
    const end = new Date()
    const start = new Date(); start.setDate(start.getDate() - 7)
    setDateFrom(start.toISOString().split('T')[0])
    setDateTo(end.toISOString().split('T')[0]); setPage(1)
  }
  const setLast30Days = () => {
    const end = new Date()
    const start = new Date(); start.setDate(start.getDate() - 30)
    setDateFrom(start.toISOString().split('T')[0])
    setDateTo(end.toISOString().split('T')[0]); setPage(1)
  }

  const canQuery = branchId && dateFrom && dateTo

  return (
    <div className="h-full flex flex-col p-4 md:p-6 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Stock Analysis Center</h1>
        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
        <div className="relative">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cari Produk</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Nama / kode produk..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg pl-8 pr-7 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-[200px]"
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cabang *</label>
            <select
              value={branchId}
              onChange={e => { setBranchId(e.target.value); setPage(1) }}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[180px]"
            >
              <option value="">Pilih Cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gudang</label>
            <select
              value={warehouseType}
              onChange={e => { setWarehouseType(e.target.value as 'READY' | 'MAIN' | 'FINISHED_GOODS'); setPage(1) }}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="READY">Ready</option>
              <option value="MAIN">Gudang Utama</option>
              <option value="FINISHED_GOODS">Finished Goods</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Dari *</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sampai *</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex gap-1">
            <button onClick={setYesterday} className="px-2 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">Kemarin</button>
            <button onClick={setLast7Days} className="px-2 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">7 Hari</button>
            <button onClick={setLast30Days} className="px-2 py-2 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">30 Hari</button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyVariance}
              onChange={e => { setOnlyVariance(e.target.checked); setPage(1) }}
              className="rounded"
            />
            Hanya selisih
          </label>

        </div>

        {!canQuery && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">Pilih cabang dan rentang tanggal untuk memuat data.</p>
        )}
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={summary} />
      {warehouseName && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Menampilkan data gudang: <span className="font-medium text-gray-700 dark:text-gray-300">{warehouseName}</span></p>
      )}

      {/* Table */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr className="text-gray-600 dark:text-gray-400">
                <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Tanggal</th>
                <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Produk</th>
                <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Kategori</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Stok Awal</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Masuk Transfer</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Masuk Produksi</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Penjualan Teoritis</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Waste</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap bg-blue-50 dark:bg-blue-900/20">Expected</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap bg-green-50 dark:bg-green-900/20">Actual</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Selisih</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Selisih (Rp)</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Akurasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Memuat data analisa...
                  </td>
                </tr>
              ) : !canQuery ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-gray-400">
                    <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    Pilih cabang dan tanggal untuk memulai analisa
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-gray-400">
                    Tidak ada data untuk filter yang dipilih
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <AnalysisRow key={`${row.tanggal}-${row.product_id}-${idx}`} row={row} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
            <Pagination
              pagination={pagination}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TABLE ROW ──────────────────────────────────────────────────────────────

function AnalysisRow({ row }: { row: StockAnalysisRow }) {
  const isNegative = row.selisih_qty != null && row.selisih_qty < 0
  const isPositive = row.selisih_qty != null && row.selisih_qty > 0
  const noOpname = !row.has_opname

  return (
    <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${noOpname ? 'opacity-60' : ''}`}>
      <td className="px-2 py-1.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{fmtDate(row.tanggal)}</td>
      <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
        {row.product_name}
        {row.uom_warning && <span title={row.uom_warning}><AlertTriangle className="w-3 h-3 inline ml-1 text-amber-500" /></span>}
      </td>
      <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.category_name ?? '-'}</td>
      <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.stok_awal)}</td>
      <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.masuk_transfer)}</td>
      <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.masuk_produksi)}</td>
      <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.penjualan_teoritis)}</td>
      <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.waste)}</td>
      <td className="px-2 py-1.5 text-right font-mono font-medium bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300">{fmt(row.expected_sisa)}</td>
      <td className="px-2 py-1.5 text-right font-mono font-medium bg-green-50/50 dark:bg-green-900/10 text-green-700 dark:text-green-300">{fmt(row.actual_sisa)}</td>
      <td className={`px-2 py-1.5 text-right font-mono font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : isPositive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`}>
        {fmt(row.selisih_qty)}
      </td>
      <td className={`px-2 py-1.5 text-right font-mono text-xs ${isNegative ? 'text-red-600 dark:text-red-400' : isPositive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`}>
        {fmtRp(row.selisih_rp)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-500">{fmtPct(row.akurasi_pct)}</td>
    </tr>
  )
}
