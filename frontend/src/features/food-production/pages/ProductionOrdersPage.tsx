import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Factory, Plus, Package } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import { useProductionOrders, useProductionOrderSummary, useProductionOrderMaterials, useActiveBranches } from '../api/food-production.api'

import { PRODUCTION_STATUS_COLORS } from '../components/production-order.constants'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)
const today = () => new Date().toISOString().slice(0, 10)

export default function ProductionOrdersPage() {
  const navigate = useNavigate()
  const branches = useActiveBranches()

  const [tab, setTab] = useState<'orders' | 'materials'>('orders')
  const [page, setPage] = useState(1)
  const [branchFilter, setBranchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())

  const listParams = useMemo(() => ({
    page, limit: 20,
    ...(branchFilter ? { branch_id: branchFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    date_from: dateFrom, date_to: dateTo,
  }), [page, branchFilter, statusFilter, dateFrom, dateTo])

  const orders = useProductionOrders(listParams)
  const summary = useProductionOrderSummary({ date_from: dateFrom, date_to: dateTo, branch_id: branchFilter || undefined })
  const materials = useProductionOrderMaterials({ date_from: dateFrom, date_to: dateTo, branch_id: branchFilter || undefined })

  const summaryTotals = useMemo(() => {
    const items = summary.data || []
    return {
      orders: items.reduce((s, i) => s + i.order_count, 0),
      batches: items.reduce((s, i) => s + Number(i.total_batches), 0),
      cost: items.reduce((s, i) => s + Number(i.total_cost), 0),
      waste: items.reduce((s, i) => s + Number(i.total_waste_cost), 0),
    }
  }, [summary.data])

  const data = orders.data?.data || []
  const pagination = orders.data?.pagination

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-indigo-600 rounded-xl"><Factory className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Produksi Harian</h1>
          <p className="text-xs text-gray-400">Catat produksi WIP per cabang per hari</p>
        </div>
        <button onClick={() => navigate('/food-production/production/new')}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus className="w-3.5 h-3.5" /> Buat Order
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        <span className="text-xs text-gray-400">s/d</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
          className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setPage(1) }}
          className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="">Semua Cabang</option>
          {(branches.data || []).map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
        </select>
        {tab === 'orders' && (
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="COMPLETED">Completed</option>
            <option value="JOURNALED">Journaled</option>
            <option value="VOID">Void</option>
          </select>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total Order</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">{summaryTotals.orders}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total Batch</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">{summaryTotals.batches}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total Cost</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white font-mono">Rp {fmt(summaryTotals.cost)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Waste Cost</p>
          <p className="text-xl font-bold text-red-500 font-mono">Rp {fmt(summaryTotals.waste)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button onClick={() => setTab('orders')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${tab === 'orders' ? 'bg-indigo-50 border-indigo-300 text-indigo-800 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300' : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-300'}`}>
          Daftar Order
        </button>
        <button onClick={() => setTab('materials')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border flex items-center gap-1.5 ${tab === 'materials' ? 'bg-indigo-50 border-indigo-300 text-indigo-800 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300' : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-300'}`}>
          <Package className="w-3.5 h-3.5" /> Pemakaian Bahan
        </button>
      </div>

      {/* Tab: Orders */}
      {tab === 'orders' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">No Order</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Cabang</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Waste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {orders.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-3 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                  ))
                ) : data.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-12 text-center text-gray-400">Belum ada production order</td></tr>
                ) : data.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/food-production/production/${o.id}`)}>
                    <td className="px-3 py-2.5 font-mono text-xs">{o.order_number}</td>
                    <td className="px-3 py-2.5 text-gray-900 dark:text-white">{o.branch_name}</td>
                    <td className="px-3 py-2.5 text-gray-500">{new Date(o.production_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${PRODUCTION_STATUS_COLORS[o.status] || ''}`}>{o.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(o.total_material_cost)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-500">{o.total_waste_cost > 0 ? fmt(o.total_waste_cost) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <Pagination pagination={pagination} onPageChange={setPage} currentLength={data.length} />
            </div>
          )}
        </div>
      )}

      {/* Tab: Materials Report */}
      {tab === 'materials' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Bahan</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Terpakai</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Waste</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Waste Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {materials.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-3 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                  ))
                ) : (materials.data || []).length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-12 text-center text-gray-400">Belum ada data pemakaian bahan</td></tr>
                ) : (materials.data || []).map(m => (
                  <tr key={m.product_id}>
                    <td className="px-3 py-2.5">
                      <span className="text-gray-900 dark:text-white font-medium">{m.product_name}</span>
                      <span className="ml-2 text-xs text-gray-400">{m.product_code}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(m.total_used)} <span className="text-xs text-gray-400">{m.uom}</span></td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-500">{m.total_waste > 0 ? fmt(m.total_waste) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono">Rp {fmt(m.total_cost)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-500">{m.total_waste_cost > 0 ? `Rp ${fmt(m.total_waste_cost)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
