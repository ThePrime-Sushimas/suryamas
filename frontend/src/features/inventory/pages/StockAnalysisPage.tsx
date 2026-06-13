import { useState, useMemo, useEffect, useRef } from 'react'
import { BarChart3, Loader2, Search, X, AlertTriangle, HelpCircle, ChevronDown, Check, Download } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import { useBranches } from '@/features/branches/api/branches.api'
import { useProducts } from '@/features/products/api/products.api'
import { useStockAnalysis } from '../api/stockAnalysis.api'
import type { StockAnalysisRow } from '../api/stockAnalysis.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { exportStockAnalysisExcel } from '../utils/stockAnalysisExport'

const fmt = (n: number | null | undefined) =>
  n == null ? '-' : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

const fmtRp = (n: number | null | undefined) =>
  n == null ? '-' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const fmtPct = (n: number | null | undefined) =>
  n == null ? '-' : `${n.toFixed(1)}%`

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })

// ─── COLUMN HEADER WITH TOOLTIP ─────────────────────────────────────────────

function ColHeader({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span className="relative group/tip">
        <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 text-xs font-normal text-white bg-gray-800 dark:bg-gray-700 rounded-md shadow-lg whitespace-normal w-48 text-left opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity z-50">
          {tip}
        </span>
      </span>
    </span>
  )
}

// ─── PRODUCT MULTI-SELECT PICKER ────────────────────────────────────────────

interface SelectedProduct { id: string; name: string }

function ProductMultiSelect({
  selected,
  onChange,
}: {
  selected: SelectedProduct[]
  onChange: (items: SelectedProduct[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useProducts({ search, limit: 30, status: 'ACTIVE' })
  const products = data?.data ?? []

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedIds = new Set(selected.map(s => s.id))

  const toggle = (id: string, name: string) => {
    if (selectedIds.has(id)) {
      onChange(selected.filter(s => s.id !== id))
    } else {
      onChange([...selected, { id, name }])
    }
  }

  const remove = (id: string) => onChange(selected.filter(s => s.id !== id))

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Produk</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex items-center gap-1.5 min-w-40"
      >
        <span className="truncate text-left flex-1">
          {selected.length === 0 ? (
            <span className="text-gray-400">Semua produk</span>
          ) : (
            <span>{selected.length} dipilih</span>
          )}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      </button>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 max-w-[300px]">
          {selected.map(s => (
            <span key={s.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
              {s.name.length > 20 ? s.name.slice(0, 20) + '…' : s.name}
              <button onClick={() => remove(s.id)} className="hover:text-blue-900 dark:hover:text-blue-100">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {selected.length > 1 && (
            <button onClick={() => onChange([])} className="text-xs text-gray-400 hover:text-gray-600 px-1">
              Hapus semua
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-64 flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari produk..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {products.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Tidak ada produk ditemukan</p>
            ) : (
              products.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id, p.product_name)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedIds.has(p.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-500'}`}>
                    {selectedIds.has(p.id) && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="truncate text-gray-800 dark:text-gray-200">{p.product_name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{p.product_code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function StockAnalysisPage() {
  // Draft filter state (not yet applied)
  const [branchId, setBranchId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [warehouseType, setWarehouseType] = useState<'READY' | 'MAIN' | 'FINISHED_GOODS'>('READY')
  const [onlyVariance, setOnlyVariance] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])

  // Applied filter state (triggers API)
  const [appliedFilters, setAppliedFilters] = useState<{
    branch_id: string
    date_from: string
    date_to: string
    warehouse_type: 'READY' | 'MAIN' | 'FINISHED_GOODS'
    search: string
    product_ids: string[]
    only_with_variance: boolean
  } | null>(null)
  const [page, setPage] = useState(1)

  const { data: branchesData } = useBranches({ limit: 100, filter: { status: 'active' } })
  const branches = branchesData?.data ?? []

  // Apply all filters at once
  const applyFilters = () => {
    if (!branchId || !dateFrom || !dateTo) return
    setAppliedFilters({
      branch_id: branchId,
      date_from: dateFrom,
      date_to: dateTo,
      warehouse_type: warehouseType,
      search: productSearch.trim(),
      product_ids: selectedProducts.map(p => p.id),
      only_with_variance: onlyVariance,
    })
    setPage(1)
  }

  const params = useMemo(() => {
    if (!appliedFilters) return null
    return {
      branch_id: appliedFilters.branch_id,
      date_from: appliedFilters.date_from,
      date_to: appliedFilters.date_to,
      warehouse_type: appliedFilters.warehouse_type,
      search: appliedFilters.search || undefined,
      product_ids: appliedFilters.product_ids.length > 0 ? appliedFilters.product_ids : undefined,
      only_with_variance: appliedFilters.only_with_variance || undefined,
      page,
      limit: 20,
    }
  }, [appliedFilters, page])

  const { data: result, isLoading, isFetching } = useStockAnalysis(params ?? {
    branch_id: '', date_from: '', date_to: '',
  })
  const rows = params ? (result?.data?.rows ?? []) : []
  const warehouseName = params ? result?.data?.warehouse_name : undefined
  const activeWarehouseType = params ? (result?.data?.warehouse_type ?? appliedFilters?.warehouse_type ?? 'READY') : warehouseType
  const pagination = params ? result?.pagination : undefined

  // Quick date helpers (set draft state only)
  const setYesterday = () => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    const str = d.toISOString().split('T')[0]
    setDateFrom(str); setDateTo(str)
  }
  const setLast7Days = () => {
    const end = new Date()
    const start = new Date(); start.setDate(start.getDate() - 7)
    setDateFrom(start.toISOString().split('T')[0])
    setDateTo(end.toISOString().split('T')[0])
  }
  const setLast30Days = () => {
    const end = new Date()
    const start = new Date(); start.setDate(start.getDate() - 30)
    setDateFrom(start.toISOString().split('T')[0])
    setDateTo(end.toISOString().split('T')[0])
  }

  const canQuery = branchId && dateFrom && dateTo

  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!params) return
    setIsExporting(true)
    try {
      await exportStockAnalysisExcel(params, warehouseName ?? 'gudang')
    } catch (err: unknown) {
      const message = err instanceof Error && err.message === 'NO_DATA'
        ? 'Tidak ada data untuk diekspor'
        : parseApiError(err, 'Gagal mengekspor data')
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  // Check if draft filters differ from applied filters
  const isDirty = appliedFilters != null && (
    branchId !== appliedFilters.branch_id ||
    dateFrom !== appliedFilters.date_from ||
    dateTo !== appliedFilters.date_to ||
    warehouseType !== appliedFilters.warehouse_type ||
    onlyVariance !== appliedFilters.only_with_variance ||
    productSearch.trim() !== appliedFilters.search ||
    selectedProducts.map(p => p.id).join() !== appliedFilters.product_ids.join()
  )

  return (
    <div className="h-full flex flex-col p-4 md:p-6 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Stock Analysis Center</h1>
        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || !params}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!params ? 'Tampilkan data terlebih dahulu sebelum export' : undefined}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Mengekspor...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cari Produk</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Nama / kode produk..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyFilters() }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg pl-8 pr-7 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-[180px]"
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
          <ProductMultiSelect
            selected={selectedProducts}
            onChange={setSelectedProducts}
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cabang *</label>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
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
              onChange={e => setWarehouseType(e.target.value as 'READY' | 'MAIN' | 'FINISHED_GOODS')}
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
              onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sampai *</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
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
              onChange={e => setOnlyVariance(e.target.checked)}
              className="rounded"
            />
            Hanya selisih
          </label>

          <button
            onClick={applyFilters}
            disabled={!canQuery}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              isDirty ? 'bg-amber-500 hover:bg-amber-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isDirty ? '↻ Update' : 'Tampilkan'}
          </button>

        </div>

        {!canQuery && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">Pilih cabang dan rentang tanggal untuk memuat data.</p>
        )}
      </div>

      {/* Warehouse label */}
      {warehouseName && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Menampilkan data gudang: <span className="font-medium text-gray-700 dark:text-gray-300">{warehouseName}</span></p>
      )}

      {/* Table */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <AnalysisTableHeader warehouseType={activeWarehouseType} />
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading && params ? (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Memuat data analisa...
                  </td>
                </tr>
              ) : !appliedFilters ? (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-gray-400">
                    <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    Pilih filter dan klik Tampilkan untuk memulai analisa
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-gray-400">
                    Tidak ada data untuk filter yang dipilih
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <AnalysisRow key={`${row.tanggal}-${row.product_id}-${idx}`} row={row} warehouseType={activeWarehouseType} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Produk {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total}
            </span>
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

// ─── COLUMN VISIBILITY CONFIG ────────────────────────────────────────────────

type WType = 'MAIN' | 'READY' | 'FINISHED_GOODS'

function getVisibleColumns(wt: string) {
  const t = wt as WType
  return {
    opening:           t === 'MAIN',
    masuk_pembelian:   t === 'MAIN',
    masuk_transfer:    t === 'READY' || t === 'FINISHED_GOODS',
    masuk_daily:       t === 'READY',
    masuk_produksi:    t === 'READY' || t === 'FINISHED_GOODS',
    penjualan_teoritis: t === 'READY',
    waste:             t === 'READY',
    keluar_proses:     t === 'READY' || t === 'FINISHED_GOODS',
    keluar_transfer:   t === 'MAIN' || t === 'FINISHED_GOODS',
    keluar_daily:      t === 'MAIN',
    keluar_produksi:   t === 'READY',
    actual:            t === 'READY',
    selisih:           t === 'READY',
    selisih_rp:        t === 'READY',
    akurasi:           t === 'READY',
  }
}

// ─── TABLE HEADER ───────────────────────────────────────────────────────────

function AnalysisTableHeader({ warehouseType }: { warehouseType: string }) {
  const v = getVisibleColumns(warehouseType)

  // Build dynamic formula indicators per visible column
  let letter = 'A' // stok_awal
  const nextLetter = () => { const l = letter; letter = String.fromCharCode(letter.charCodeAt(0) + 1); return l }
  const stokLabel = nextLetter() // A
  const formulaCols: { key: string; sign: '+' | '−'; label: string }[] = []
  if (v.masuk_pembelian) formulaCols.push({ key: 'masuk_pembelian', sign: '+', label: nextLetter() })
  if (v.masuk_transfer) formulaCols.push({ key: 'masuk_transfer', sign: '+', label: nextLetter() })
  if (v.masuk_daily) formulaCols.push({ key: 'masuk_daily', sign: '+', label: nextLetter() })
  if (v.masuk_produksi) formulaCols.push({ key: 'masuk_produksi', sign: '+', label: nextLetter() })
  if (v.penjualan_teoritis) formulaCols.push({ key: 'penjualan_teoritis', sign: '−', label: nextLetter() })
  if (v.waste) formulaCols.push({ key: 'waste', sign: '−', label: nextLetter() })
  if (v.keluar_proses) formulaCols.push({ key: 'keluar_proses', sign: '−', label: nextLetter() })
  if (v.keluar_transfer) formulaCols.push({ key: 'keluar_transfer', sign: '−', label: nextLetter() })
  if (v.keluar_daily) formulaCols.push({ key: 'keluar_daily', sign: '−', label: nextLetter() })
  if (v.keluar_produksi) formulaCols.push({ key: 'keluar_produksi', sign: '−', label: nextLetter() })

  return (
    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
      <tr className="text-gray-600 dark:text-gray-400">
        <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Tanggal</th>
        <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Produk</th>
        <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Stok Awal" tip="Saldo stok di awal hari." />
        </th>
        {v.opening && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Opening" tip="Opening balance/adjustment (informatif, tidak masuk formula)." />
        </th>}
        {v.masuk_pembelian && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Masuk Beli" tip="Barang masuk dari penerimaan pembelian (Goods Receipt)." />
        </th>}
        {v.masuk_transfer && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Masuk Transfer" tip="Barang masuk dari transfer antar gudang (DPO, stock transfer)." />
        </th>}
        {v.masuk_daily && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Pengambilan Harian Masuk" tip="Bahan masuk ke gudang READY dari proses pengambilan harian (IN_DAILY)." />
        </th>}
        {v.masuk_produksi && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Masuk Produksi" tip="Barang masuk dari hasil produksi (production order)." />
        </th>}
        {v.penjualan_teoritis && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Penj. Teoritis" tip="Estimasi pemakaian berdasarkan POS × resep menu." />
        </th>}
        {v.waste && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Waste" tip="Barang terbuang (expired, rusak, susut opname)." />
        </th>}
        {v.keluar_proses && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Proses" tip="Barang keluar untuk breakdown menjadi produk lain." />
        </th>}
        {v.keluar_transfer && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Keluar Transfer" tip="Barang keluar via transfer ke gudang lain (stock transfer antar gudang/cabang)." />
        </th>}
        {v.keluar_daily && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Pengambilan Harian Keluar" tip="Bahan keluar dari gudang MAIN karena Pengambilan Harian (OUT_DAILY)." />
        </th>}
        {v.keluar_produksi && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Keluar Produksi" tip="Bahan terpakai untuk production order." />
        </th>}
        <th className="px-2 py-2 text-right font-medium whitespace-nowrap bg-blue-50 dark:bg-blue-900/20">
          <ColHeader label="Expected" tip="Stok yang diharapkan tersisa berdasarkan formula." />
        </th>
        {v.actual && <th className="px-2 py-2 text-right font-medium whitespace-nowrap bg-green-50 dark:bg-green-900/20">
          <ColHeader label="Actual" tip="Stok aktual hasil opname di hari ini." />
        </th>}
        {v.selisih && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Selisih" tip="Selisih qty = Actual − Expected." />
        </th>}
        {v.selisih_rp && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Selisih (Rp)" tip="Selisih × harga per unit." />
        </th>}
        {v.akurasi && <th className="px-2 py-2 text-right font-medium whitespace-nowrap">
          <ColHeader label="Akurasi" tip="(Actual / Expected) × 100%." />
        </th>}
      </tr>
      {/* Formula guide row */}
      <tr className="bg-gray-100/60 dark:bg-gray-800/60 text-[10px] text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
        <td className="px-2 py-0.5" colSpan={2}></td>
        <td className="px-2 py-0.5 text-right font-mono">{stokLabel}</td>
        {v.opening && <td className="px-2 py-0.5 text-right"></td>}
        {formulaCols.map(c => (
          <td key={c.key} className={`px-2 py-0.5 text-right font-mono ${c.sign === '+' ? 'text-green-600' : 'text-red-500'}`}>
            {c.sign} {c.label}
          </td>
        ))}
        <td className="px-2 py-0.5 text-right font-mono font-bold text-blue-600">= Expected</td>
        {v.actual && <td className="px-2 py-0.5"></td>}
        {v.selisih && <td className="px-2 py-0.5"></td>}
        {v.selisih_rp && <td className="px-2 py-0.5"></td>}
        {v.akurasi && <td className="px-2 py-0.5"></td>}
      </tr>
    </thead>
  )
}

// ─── TABLE ROW ──────────────────────────────────────────────────────────────

function AnalysisRow({ row, warehouseType }: { row: StockAnalysisRow; warehouseType: string }) {
  const v = getVisibleColumns(warehouseType)
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
      <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.stok_awal)}</td>
      {v.opening && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{row.masuk_opening ? fmt(row.masuk_opening) : '-'}</td>}
      {v.masuk_pembelian && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.masuk_pembelian)}</td>}
      {v.masuk_transfer && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.masuk_transfer)}</td>}
      {v.masuk_daily && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.masuk_daily)}</td>}
      {v.masuk_produksi && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.masuk_produksi)}</td>}
      {v.penjualan_teoritis && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.penjualan_teoritis)}</td>}
      {v.waste && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.waste)}</td>}
      {v.keluar_proses && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.keluar_proses)}</td>}
      {v.keluar_transfer && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.keluar_transfer)}</td>}
      {v.keluar_daily && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.keluar_daily)}</td>}
      {v.keluar_produksi && <td className="px-2 py-1.5 text-right text-gray-700 dark:text-gray-300 font-mono">{fmt(row.keluar_produksi)}</td>}
      <td className="px-2 py-1.5 text-right font-mono font-medium bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300">{fmt(row.expected_sisa)}</td>
      {v.actual && <td className="px-2 py-1.5 text-right font-mono font-medium bg-green-50/50 dark:bg-green-900/10 text-green-700 dark:text-green-300">{fmt(row.actual_sisa)}</td>}
      {v.selisih && <td className={`px-2 py-1.5 text-right font-mono font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : isPositive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`}>
        {fmt(row.selisih_qty)}
      </td>}
      {v.selisih_rp && <td className={`px-2 py-1.5 text-right font-mono text-xs ${isNegative ? 'text-red-600 dark:text-red-400' : isPositive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`}>
        {fmtRp(row.selisih_rp)}
      </td>}
      {v.akurasi && <td className="px-2 py-1.5 text-right font-mono text-xs text-gray-500">{fmtPct(row.akurasi_pct)}</td>}
    </tr>
  )
}
