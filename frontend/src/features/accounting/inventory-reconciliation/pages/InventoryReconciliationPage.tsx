import React, { useState, useMemo, useCallback } from 'react'
import { Search, AlertCircle, AlertTriangle, Download, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useInventoryReconciliation } from '../api/inventoryReconciliation.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import type { InventoryReconciliationFilter, InventoryReconciliationRow, UnjournaledWasteRow, UnjournaledShortageRow } from '../types/inventory-reconciliation.types'

function fmt(v: number): string {
  if (v === 0) return '-'
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function fmtPct(v: number): string {
  if (v === 0) return '-'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

type TabView = 'reconciliation' | 'unjournaled' | 'unjournaled_shortage'

function exportCsv(rows: InventoryReconciliationRow[], asOfDate: string) {
  const header = ['#', 'Cabang', 'Stock Subledger', 'Saldo GL', 'Selisih', '% Selisih'].join(';')
  const lines = rows.map((r, i) => [i + 1, r.branch_name, r.subledger_value, r.gl_balance, r.variance, `${r.variance_pct}%`].join(';'))
  const csv = [header, ...lines].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `inventory-reconciliation_${asOfDate}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function InventoryReconciliationPage() {
  const { branches } = useBranchContextStore()
  const [asOfDate, setAsOfDate] = useState(getToday())
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [fetchKey, setFetchKey] = useState(0)
  const [isStale, setIsStale] = useState(false)
  const [tab, setTab] = useState<TabView>('reconciliation')
  const [showInfo, setShowInfo] = useState(false)

  const filter: InventoryReconciliationFilter = useMemo(() => ({
    as_of_date: asOfDate,
    branch_ids: selectedBranches,
  }), [asOfDate, selectedBranches])

  const [appliedFilter, setAppliedFilter] = useState(filter)

  const { data, isLoading, isError, error } = useInventoryReconciliation(appliedFilter, fetchKey > 0)

  const handleShow = useCallback(() => {
    setAppliedFilter({ ...filter })
    setFetchKey(prev => prev + 1)
    setIsStale(false)
  }, [filter])

  const handleFilterChange = useCallback(() => {
    if (fetchKey > 0) setIsStale(true)
  }, [fetchKey])

  const toggleBranch = useCallback((branchId: string) => {
    setSelectedBranches(prev => {
      const next = prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]
      return next
    })
    handleFilterChange()
  }, [handleFilterChange])

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rekonsiliasi Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Perbandingan nilai stock subledger vs saldo GL (akun persediaan 1105xx)
          </p>
        </div>
        {data && data.total_variance !== 0 && (
          <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${
            Math.abs(data.total_variance) > 0
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
              : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
          }`}>
            Selisih: Rp {fmt(data.total_variance)}
          </div>
        )}
      </div>

      {/* Explanation Panel */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <Info size={16} className="text-blue-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
            Apa itu laporan ini? Kenapa bisa ada selisih?
          </span>
          {showInfo ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {showInfo && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700 space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Sumber Data</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li><span className="font-medium text-gray-800 dark:text-gray-200">Stock Subledger</span> = SUM(qty x avg_cost) dari tabel <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">stock_balances</code> per warehouse per branch. Ini mencerminkan <em>nilai fisik</em> inventory yang tercatat di sistem operasional.</li>
                <li><span className="font-medium text-gray-800 dark:text-gray-200">Saldo GL</span> = Net (debit - credit) dari jurnal yang sudah POSTED pada akun persediaan (110501, 110502, 110505, 110598) per branch. Ini mencerminkan <em>nilai akuntansi</em> inventory di General Ledger.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Kenapa Bisa Selisih?</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Selisih terjadi ketika stock subledger berubah (qty berkurang/bertambah) tanpa ada jurnal akuntansi yang mengimbangi. Penyebab utama:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-600 dark:text-gray-400">
                <li><span className="font-medium text-gray-800 dark:text-gray-200">Waste dari opname belum dijurnal</span> — saat daily opname confirm, stock qty langsung berkurang. Tapi journal baru muncul setelah classification selesai dan stock adjustment ter-confirm. Kalau classification belum dilakukan atau journal generation gagal, GL tetap tinggi sementara subledger sudah turun.</li>
                <li><span className="font-medium text-gray-800 dark:text-gray-200">Shortage resolved tapi journal gagal/belum</span> — shortage yang dipotong gaji harusnya generate journal (DR Piutang Karyawan CR Persediaan). Kalau gagal, GL tidak ikut turun.</li>
                <li><span className="font-medium text-gray-800 dark:text-gray-200">Fiscal period belum dibuka</span> — journal generation di-skip otomatis jika fiscal period untuk tanggal opname belum open.</li>
                <li><span className="font-medium text-gray-800 dark:text-gray-200">COGS theoretical vs actual</span> — COGS finalize menggunakan <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">menus.estimated_cost</code> (dari pricelist/recipe), bukan actual avg_cost dari stock. Selisih kecil antara theoretical cost dan actual purchase cost terakumulasi seiring waktu.</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Cara Mengatasi</h3>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-600 dark:text-gray-400">
                <li><span className="font-medium text-gray-800 dark:text-gray-200">Cek tab &quot;Waste Belum Dijurnal&quot;</span> — jika ada, re-classify opname session tersebut (masuk menu Opname Harian, buka sesi, submit ulang classification) atau buat manual Stock Adjustment (Waste) dengan <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">source_closing_id</code> yang sesuai.</li>
                <li><span className="font-medium text-gray-800 dark:text-gray-200">Buka fiscal period</span> — pastikan fiscal period untuk bulan berjalan sudah OPEN di menu Fiscal Periods, lalu retry journal dari Opname/Shortage yang gagal.</li>
                <li><span className="font-medium text-gray-800 dark:text-gray-200">Adjustment manual</span> — untuk selisih akumulatif yang sudah besar dan tidak bisa di-trace ke specific opname, buat Stock Adjustment journal manual (DR Selisih HPP 510301, CR Persediaan 110505) sebesar selisih.</li>
              </ol>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
              <strong>Target:</strong> Selisih 0% berarti GL dan stock fisik perfectly in sync. Selisih &lt;1% dianggap normal (rounding, timing). Selisih &gt;5% perlu investigasi segera.
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Per Tanggal</label>
            <input
              type="date"
              value={asOfDate}
              onChange={e => { setAsOfDate(e.target.value); handleFilterChange() }}
              className="h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1" />

          <button
            onClick={handleShow}
            disabled={isLoading || !asOfDate}
            className={`h-10 flex items-center gap-2 px-5 text-white rounded-lg disabled:opacity-50 transition-colors font-medium text-sm shadow-sm ${
              isStale ? 'bg-amber-600 hover:bg-amber-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Search size={16} />
            {isStale ? 'Update Report' : 'Show Report'}
          </button>

          {data && data.reconciliation.length > 0 && (
            <button
              onClick={() => exportCsv(data.reconciliation, asOfDate)}
              className="h-10 flex items-center gap-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              <Download size={16} /> Export
            </button>
          )}
        </div>

        {/* Branch multi-select */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
            Branch {selectedBranches.length > 0 ? `(${selectedBranches.length} selected)` : '(All)'}
          </label>
          <div className="flex flex-wrap gap-2">
            {branches.map(b => {
              const selected = selectedBranches.includes(b.branch_id)
              return (
                <button
                  key={b.branch_id}
                  onClick={() => toggleBranch(b.branch_id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }`}
                >
                  {b.branch_name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      {fetchKey === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Set tanggal lalu klik &quot;Show Report&quot;</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700/50 rounded" />)}
          </div>
        </div>
      ) : isError ? (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">{error instanceof Error ? error.message : 'Error loading data'}</p>
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryCard label="Stock Subledger" value={data.total_subledger} />
            <SummaryCard label="Saldo GL (1105xx)" value={data.total_gl} />
            <SummaryCard
              label="Selisih (Sub - GL)"
              value={data.total_variance}
              variant={data.total_variance === 0 ? 'success' : Math.abs(data.total_variance) > 1000000 ? 'danger' : 'warning'}
            />
          </div>

          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
              <TabBtn active={tab === 'reconciliation'} onClick={() => setTab('reconciliation')}>
                Per Cabang ({data.reconciliation.length})
              </TabBtn>
              <TabBtn active={tab === 'unjournaled'} onClick={() => setTab('unjournaled')}>
                <span className="flex items-center gap-1.5">
                  Waste Belum Dijurnal
                  {data.unjournaled_waste.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                      {data.unjournaled_waste.length}
                    </span>
                  )}
                </span>
              </TabBtn>
              <TabBtn active={tab === 'unjournaled_shortage'} onClick={() => setTab('unjournaled_shortage')}>
                <span className="flex items-center gap-1.5">
                  Shortage Belum Dijurnal
                  {data.unjournaled_shortage.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-amber-500 rounded-full">
                      {data.unjournaled_shortage.length}
                    </span>
                  )}
                </span>
              </TabBtn>
            </div>

            <div className="overflow-x-auto">
              {tab === 'reconciliation' && <ReconciliationTable rows={data.reconciliation} />}
              {tab === 'unjournaled' && <UnjournaledWasteTable rows={data.unjournaled_waste} />}
              {tab === 'unjournaled_shortage' && <UnjournaledShortageTable rows={data.unjournaled_shortage} />}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, variant }: { label: string; value: number; variant?: 'success' | 'warning' | 'danger' }) {
  const colors = variant === 'danger'
    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    : variant === 'warning'
    ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
    : variant === 'success'
    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'

  const textColor = variant === 'danger'
    ? 'text-red-700 dark:text-red-400'
    : variant === 'warning'
    ? 'text-amber-700 dark:text-amber-400'
    : variant === 'success'
    ? 'text-green-700 dark:text-green-400'
    : 'text-gray-900 dark:text-gray-100'

  return (
    <div className={`p-4 rounded-xl border shadow-sm ${colors}`}>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1.5 font-mono ${textColor}`}>Rp {fmt(value)}</p>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${active
        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  )
}

function ReconciliationTable({ rows }: { rows: InventoryReconciliationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-12 text-center">
        <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">Tidak ada data stock untuk branch yang dipilih</p>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <tr>
          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-center w-10">#</th>
          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Cabang</th>
          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Stock Subledger</th>
          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Saldo GL</th>
          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Selisih</th>
          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">%</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {rows.map((r, i) => {
          const severity = Math.abs(r.variance_pct) > 5 ? 'high' : Math.abs(r.variance_pct) > 1 ? 'medium' : 'low'
          return (
            <tr key={r.branch_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-2.5 text-center text-xs text-gray-400">{i + 1}</td>
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{r.branch_name}</td>
              <td className="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">{fmt(r.subledger_value)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">{fmt(r.gl_balance)}</td>
              <td className={`px-4 py-2.5 text-right font-mono font-medium ${
                severity === 'high' ? 'text-red-600 dark:text-red-400'
                : severity === 'medium' ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-700 dark:text-gray-300'
              }`}>
                {fmt(r.variance)}
              </td>
              <td className={`px-4 py-2.5 text-right font-mono text-xs ${
                severity === 'high' ? 'text-red-600 dark:text-red-400'
                : severity === 'medium' ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-500 dark:text-gray-400'
              }`}>
                {fmtPct(r.variance_pct)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function UnjournaledWasteTable({ rows }: { rows: UnjournaledWasteRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
          <Search className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <p className="text-green-700 dark:text-green-400 font-medium">Semua waste classification sudah memiliki journal</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tidak ada gap terdeteksi</p>
      </div>
    )
  }

  const totalValue = rows.reduce((s, r) => s + r.unjournaled_waste_value, 0)

  return (
    <div>
      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">{rows.length} sesi opname memiliki waste yang belum dijurnal (total: Rp {fmt(totalValue)})</p>
          <p className="mt-0.5 text-amber-700 dark:text-amber-400">
            Stock subledger sudah berkurang tapi GL belum ter-update. Re-classify atau buat manual stock adjustment untuk generate journal.
          </p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-center w-10">#</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Tanggal</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Cabang</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Posisi</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Item</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Nilai Waste</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {rows.map((r, i) => (
            <tr key={r.closing_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-2.5 text-center text-xs text-gray-400">{i + 1}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">{r.closing_date}</td>
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{r.branch_name}</td>
              <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{r.position_name ?? '-'}</td>
              <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{r.waste_line_count}</td>
              <td className="px-4 py-2.5 text-right font-mono font-medium text-red-600 dark:text-red-400">{fmt(r.unjournaled_waste_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UnjournaledShortageTable({ rows }: { rows: UnjournaledShortageRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
          <Search className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <p className="text-green-700 dark:text-green-400 font-medium">Semua shortage resolve sudah memiliki journal</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tidak ada gap terdeteksi</p>
      </div>
    )
  }

  const totalValue = rows.reduce((s, r) => s + r.deduction_amount, 0)

  return (
    <div>
      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">{rows.length} shortage resolve tanpa jurnal (total: Rp {fmt(totalValue)})</p>
          <p className="mt-0.5 text-amber-700 dark:text-amber-400">
            Shortage sudah di-resolve (potong gaji) tapi jurnal DR Piutang Karyawan / CR Persediaan gagal di-generate.
            Kemungkinan penyebab: fiscal period closed atau COA 110403/110505 belum di-setup. Buka fiscal period lalu retry resolve.
          </p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-center w-10">#</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Tanggal</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Cabang</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Product</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Nilai Potongan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {rows.map((r, i) => (
            <tr key={r.vcl_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-2.5 text-center text-xs text-gray-400">{i + 1}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">{r.closing_date}</td>
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{r.branch_name}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-gray-500 dark:text-gray-400">{r.product_id}</td>
              <td className="px-4 py-2.5 text-right font-mono font-medium text-amber-600 dark:text-amber-400">{fmt(r.deduction_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
