import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowDownLeft, ArrowUpRight, X } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import { useStockMovements, useWarehouses } from '../api/inventory.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const MOVEMENT_LABELS: Record<string, string> = {
  IN_PURCHASE: 'Pembelian',
  IN_TRANSFER: 'Transfer Masuk',
  IN_RETURN: 'Pengembalian',
  IN_PRODUCTION: 'Hasil Produksi',
  IN_ADJUSTMENT: 'Penyesuaian (+)',
  IN_OPENING: 'Saldo Awal',
  OUT_TRANSFER: 'Transfer Keluar',
  OUT_LOAN: 'Pinjam Cabang',
  OUT_DAILY: 'Turun Harian',
  OUT_ADJUSTMENT: 'Penyesuaian (-)',
  OUT_WASTE: 'Waste',
  OUT_PRODUCTION: 'Bahan Produksi',
}

export default function StockMovementsPage() {
  const [page, setPage] = useState(1)
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: warehousesData } = useWarehouses({ limit: 50 })
  const warehouseOptions = warehousesData?.data ?? []

  const queryParams = useMemo(() => ({
    page, limit: 50,
    warehouse_id: warehouseFilter || undefined,
    movement_type: typeFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }), [page, warehouseFilter, typeFilter, dateFrom, dateTo])

  const { data, isLoading } = useStockMovements(queryParams)
  const movements = data?.data ?? []
  const pagination = data?.pagination

  const resetFilters = () => { setWarehouseFilter(''); setTypeFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <ArrowUpDown className="w-6 h-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mutasi Stok</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} mutasi</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2 flex-wrap">
          <select value={warehouseFilter} onChange={e => { setWarehouseFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            <option value="">Semua Gudang</option>
            {warehouseOptions.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
          </select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
            <option value="">Semua Tipe</option>
            {Object.entries(MOVEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          {(warehouseFilter || typeFilter || dateFrom || dateTo) && (
            <button onClick={resetFilters} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
              <X className="w-4 h-4 inline mr-1" />Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gudang</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Saldo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Catatan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                ))
              ) : movements.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Tidak ada mutasi ditemukan</td></tr>
              ) : movements.map(m => {
                const isIn = m.qty > 0
                return (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(m.movement_date)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.warehouse_name}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{m.product_name}</div>
                      <div className="text-xs text-gray-500">{m.product_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${isIn ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {isIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {MOVEMENT_LABELS[m.movement_type] || m.movement_type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${isIn ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {isIn ? '+' : ''}{fmt(m.qty)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">{fmt(m.balance_after)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-[150px] truncate">{m.notes || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{m.created_by_name || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={() => {}} currentLength={movements.length} loading={isLoading} />
        )}
      </div>
    </div>
  )
}
