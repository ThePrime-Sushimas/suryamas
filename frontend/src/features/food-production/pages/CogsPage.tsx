import { Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { Calculator, FileText, History, AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { useFiscalPeriodsStatus } from '@/features/dashboard/api/useDashboardApi'
import { useCogsPreview, useCogsFinalize, useCogsHistory, useVoidCogs } from '../api/food-production.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import type { CogsPreviewResult } from '../types/food-production.types'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)
const fmtPct = (n: number) => `${n.toFixed(1)}%`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export default function CogsPage() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'calculate' | 'history'>('calculate')

  // Calculate tab state
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [preview, setPreview] = useState<CogsPreviewResult | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false)
  const [finalizeProgress, setFinalizeProgress] = useState<{ current: number; total: number; results: string[] } | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)

  // History tab state
  const [historyPage, setHistoryPage] = useState(1)

  const { branches } = useBranchContextStore()
  const fiscalPeriods = useFiscalPeriodsStatus()
  const openPeriods = useMemo(() => (fiscalPeriods.data || []).filter(p => p.is_open).sort((a, b) => b.period.localeCompare(a.period)), [fiscalPeriods.data])

  const cogsPreview = useCogsPreview()
  const cogsFinalize = useCogsFinalize()
  const cogsHistory = useCogsHistory({ page: historyPage, limit: 25 })
  const voidCogs = useVoidCogs()

  const handleSelectPeriod = (periodId: string) => {
    const p = openPeriods.find(fp => fp.id === periodId)
    if (p) { setPeriodStart(p.period_start); setPeriodEnd(p.period_end) }
  }

  const isMultiBranch = selectedBranches.length > 1

  const handlePreview = async () => {
    if (!periodStart || !periodEnd) { toast.warning('Pilih periode terlebih dahulu'); return }
    if (selectedBranches.length === 0) { toast.warning('Pilih minimal 1 cabang'); return }
    try {
      const result = await cogsPreview.mutateAsync({ period_start: periodStart, period_end: periodEnd, branch_id: selectedBranches[0] })
      setPreview(result)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal preview COGS')) }
  }

  const handleFinalize = async () => {
    if (!periodStart || !periodEnd || selectedBranches.length === 0) return
    // Close modal immediately so progress bar is visible
    setShowConfirm(false)
    const results: string[] = []
    setFinalizeProgress({ current: 0, total: selectedBranches.length, results: [] })
    try {
      for (let i = 0; i < selectedBranches.length; i++) {
        const branchId = selectedBranches[i]
        const branchName = branches.find(b => b.branch_id === branchId)?.branch_name || branchId
        try {
          const result = await cogsFinalize.mutateAsync({ period_start: periodStart, period_end: periodEnd, branch_id: branchId })
          results.push(`✓ ${branchName}: ${result.journal_number}`)
        } catch (err: unknown) {
          results.push(`✗ ${branchName}: ${parseApiError(err, 'Gagal')}`)
        }
        setFinalizeProgress({ current: i + 1, total: selectedBranches.length, results: [...results] })
      }
      const failCount = results.filter(r => r.startsWith('✗')).length
      const successCount = results.filter(r => r.startsWith('✓')).length
      if (failCount === 0) {
        toast.success(`COGS finalized untuk ${successCount} cabang`)
      } else if (successCount === 0) {
        toast.error(`Gagal finalize semua ${failCount} cabang`)
      } else {
        toast.warning(`COGS: ${successCount} berhasil, ${failCount} gagal`)
      }
      setPreview(null)
      // Keep progress visible for 2s so user can see results, then switch to history
      setTimeout(() => {
        setFinalizeProgress(null)
        setActiveTab('history')
      }, 2000)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal finalize COGS'))
      setFinalizeProgress(null)
    }
  }

  const filteredLines = useMemo(() => {
    if (!preview) return []
    return showUnmappedOnly ? preview.lines.filter(l => !l.has_recipe) : preview.lines
  }, [preview, showUnmappedOnly])

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-blue-600 rounded-xl"><Calculator className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">COGS Calculation</h1>
          <p className="text-xs text-gray-400">Hitung Harga Pokok Penjualan dan generate jurnal</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setActiveTab('calculate')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'calculate' ? 'text-blue-600 border-blue-600' : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900'}`}>
          <div className="flex items-center gap-2"><Calculator className="w-4 h-4" /> Hitung COGS</div>
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'text-blue-600 border-blue-600' : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900'}`}>
          <div className="flex items-center gap-2"><History className="w-4 h-4" /> Riwayat</div>
        </button>
      </div>

      {/* ── Tab: Calculate ── */}
      {activeTab === 'calculate' && (
        <div className="space-y-4">
          {/* Period selector */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Periode Fiskal</label>
                <select onChange={e => handleSelectPeriod(e.target.value)}
                  className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">Pilih periode...</option>
                  {openPeriods.map(p => <option key={p.id} value={p.id}>{p.period} ({p.period_start} — {p.period_end})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Dari</label>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                  className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sampai</label>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                  className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              {!isMultiBranch && (
                <button onClick={handlePreview} disabled={cogsPreview.isPending || !periodStart || !periodEnd || selectedBranches.length === 0}
                  className="h-9 px-4 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                  {cogsPreview.isPending ? 'Menghitung...' : 'Preview'}
                </button>
              )}
            </div>

            {/* Branch Multi-Select */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">Cabang (pilih 1 atau lebih)</label>
                <button type="button" onClick={() => {
                  const next = selectedBranches.length === branches.length ? [] : branches.map(b => b.branch_id)
                  setSelectedBranches(next)
                  if (next.length > 1) setPreview(null)
                }} className="text-[10px] text-blue-600 hover:text-blue-800">
                  {selectedBranches.length === branches.length ? 'Hapus semua' : 'Pilih semua'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {branches.map(b => {
                  const isSelected = selectedBranches.includes(b.branch_id)
                  return (
                    <button key={b.branch_id} type="button"
                      onClick={() => {
                        const next = isSelected ? selectedBranches.filter(id => id !== b.branch_id) : [...selectedBranches, b.branch_id]
                        setSelectedBranches(next)
                        if (next.length > 1) setPreview(null)
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}>
                      {b.branch_name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Multi-branch: skip preview, show finalize directly */}
          {isMultiBranch && periodStart && periodEnd && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <span className="font-semibold">{selectedBranches.length} cabang</span> dipilih untuk periode {periodStart} s/d {periodEnd}.
                  Preview tidak tersedia untuk multi-branch. Langsung finalize — progress per cabang akan ditampilkan.
                </p>
              </div>

              {finalizeProgress && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      Memproses {finalizeProgress.current}/{finalizeProgress.total} cabang...
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-3">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${(finalizeProgress.current / finalizeProgress.total) * 100}%` }} />
                  </div>
                  {finalizeProgress.results.map((r, i) => (
                    <p key={i} className={`text-xs ${r.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{r}</p>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end">
                <button onClick={() => setShowConfirm(true)} disabled={cogsFinalize.isPending || selectedBranches.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 text-sm font-medium">
                  <FileText className="w-4 h-4" />
                  {cogsFinalize.isPending ? 'Memproses...' : `Finalize ${selectedBranches.length} Cabang`}
                </button>
              </div>
            </div>
          )}

          {/* Single-branch: preview result */}
          {!isMultiBranch && preview && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                  <p className="text-xs text-gray-400">HPP Makanan</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(preview.summary.total_food_cogs)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                  <p className="text-xs text-gray-400">HPP Minuman</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(preview.summary.total_beverage_cogs)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Total COGS</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(preview.summary.total_cogs)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Cost %</p>
                  <p className={`text-lg font-bold ${preview.summary.cogs_percentage > 40 ? 'text-red-600' : preview.summary.cogs_percentage > 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {fmtPct(preview.summary.cogs_percentage)}
                  </p>
                </div>
              </div>

              {/* Warning: unmapped menus */}
              {preview.summary.unmapped_menu_count > 0 && (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    {preview.summary.unmapped_menu_count} menu belum punya resep (cost = 0)
                  </span>
                  <button onClick={() => setShowUnmappedOnly(!showUnmappedOnly)}
                    className="ml-auto text-xs text-amber-600 hover:text-amber-800 underline">
                    {showUnmappedOnly ? 'Tampilkan semua' : 'Lihat menu tanpa resep'}
                  </button>
                </div>
              )}

              {/* Detail Table */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Menu</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost/Unit</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total COGS</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cost %</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Resep</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {filteredLines.map((l, i) => (
                        <tr key={l.menu_id || l.menu_name + i} className={`${!l.has_recipe ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{l.menu_name}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{l.category_name || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{l.qty_sold}</td>
                          <td className="px-3 py-2 text-right font-mono">{l.cost_per_unit > 0 ? fmt(l.cost_per_unit) : '—'}</td>
                          <td className="px-3 py-2 text-right font-mono font-medium">{l.total_cogs > 0 ? fmt(l.total_cogs) : '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmt(l.revenue)}</td>
                          <td className="px-3 py-2 text-center">
                            {l.cogs_percentage > 0 ? (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${l.cogs_percentage > 40 ? 'bg-red-100 text-red-700' : l.cogs_percentage > 30 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {fmtPct(l.cogs_percentage)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {l.has_recipe ? '✓' : <span className="text-amber-500">✗</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Finalize Button */}
              <div className="flex flex-col gap-3">
                {finalizeProgress && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                        Memproses {finalizeProgress.current}/{finalizeProgress.total} cabang...
                      </span>
                    </div>
                    {finalizeProgress.results.map((r, i) => (
                      <p key={i} className={`text-xs ${r.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{r}</p>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Finalize COGS untuk <span className="font-semibold">{selectedBranches.length}</span> cabang
                  </p>
                  <button onClick={() => setShowConfirm(true)} disabled={cogsFinalize.isPending || !preview || preview.summary.total_cogs === 0 || selectedBranches.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 text-sm font-medium">
                    <FileText className="w-4 h-4" />
                    {cogsFinalize.isPending ? 'Memproses...' : `Finalize ${selectedBranches.length} Cabang`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: History ── */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Periode</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Cabang</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Total COGS</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Cost %</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Jurnal</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Dibuat</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {cogsHistory.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={9} className="px-3 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                  ))
                ) : (cogsHistory.data?.data || []).length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-12 text-center text-gray-400">Belum ada riwayat COGS</td></tr>
                ) : (cogsHistory.data?.data || []).map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2.5 text-gray-900 dark:text-white">{fmtDate(c.period_start)} — {fmtDate(c.period_end)}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 text-xs">{c.branch_name || 'Semua'}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(c.total_cogs)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(c.total_revenue)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${c.cogs_percentage > 40 ? 'bg-red-100 text-red-700' : c.cogs_percentage > 30 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {fmtPct(c.cogs_percentage)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'JOURNALED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : c.status === 'VOID' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">{c.journal_id ? <Link to={`/accounting/journals/${c.journal_id}`} className="text-xs text-blue-600 hover:text-blue-800 underline">Lihat</Link> : <span className="text-xs text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{fmtDate(c.created_at)}</td>
                    <td className="px-3 py-2.5 text-center">
                      {c.status === 'JOURNALED' && (
                        <button onClick={() => { setVoidingId(c.id); setShowVoidConfirm(true) }}
                          disabled={voidCogs.isPending && voidingId === c.id}
                          className="text-[10px] px-2 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-40">
                          {voidCogs.isPending && voidingId === c.id ? '...' : 'Void'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cogsHistory.data?.pagination && cogsHistory.data.pagination.totalPages > 1 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <Pagination
                pagination={cogsHistory.data.pagination}
                onPageChange={setHistoryPage}
                currentLength={cogsHistory.data.data.length}
              />
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => { setShowConfirm(false); setFinalizeProgress(null) }}
        onConfirm={handleFinalize}
        title="Finalize COGS"
        message={isMultiBranch
          ? `Ini akan membuat jurnal COGS untuk ${selectedBranches.length} cabang, periode ${periodStart} s/d ${periodEnd}. Proses berjalan per cabang dengan progress bar. Lanjutkan?`
          : `Ini akan membuat jurnal COGS untuk cabang ${branches.find(b => b.branch_id === selectedBranches[0])?.branch_name || ''}, periode ${periodStart} s/d ${periodEnd}.${preview && preview.summary.unmapped_menu_count > 0 ? ` ⚠️ ${preview.summary.unmapped_menu_count} menu belum punya resep.` : ""} Lanjutkan?`
        }
        confirmText={cogsFinalize.isPending ? 'Memproses...' : `Finalize ${selectedBranches.length} Cabang`}
        variant="warning"
      />

      <ConfirmModal
        isOpen={showVoidConfirm}
        onClose={() => { setShowVoidConfirm(false); setVoidingId(null) }}
        onConfirm={async () => {
          if (!voidingId) return
          try {
            await voidCogs.mutateAsync(voidingId)
            toast.success('COGS berhasil di-void')
          } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal void COGS')) }
          setShowVoidConfirm(false)
          setVoidingId(null)
        }}
        title="Void COGS Calculation"
        message="Journal COGS akan dihapus permanen. COGS bisa di-finalize ulang untuk periode & cabang yang sama."
        confirmText={voidCogs.isPending ? 'Menghapus...' : 'Void & Hapus Journal'}
        variant="danger"
        isLoading={voidCogs.isPending}
      />
    </div>
  )
}
