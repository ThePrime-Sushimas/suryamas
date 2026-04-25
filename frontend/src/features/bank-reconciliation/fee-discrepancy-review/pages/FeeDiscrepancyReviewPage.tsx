import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { feeDiscrepancyApi } from '../api/fee-discrepancy.api'
import type { FeeDiscrepancyItem, FeeDiscrepancyStatus, FeeDiscrepancySource } from '../types/fee-discrepancy.types'
import { AlertTriangle, CheckCircle, ArrowUpDown, Filter, MoreHorizontal, Check, X, Eye, FileEdit, Plus, Trash2, Undo2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const sourceLabel: Record<string, string> = { SINGLE_MATCH: '1:1', MULTI_MATCH: 'Multi', SETTLEMENT_GROUP: 'Settlement' }
const sourceBadge: Record<string, string> = {
  SINGLE_MATCH: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  MULTI_MATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SETTLEMENT_GROUP: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

export const FeeDiscrepancyReviewPage = () => {
  const toast = useToast()
  const qc = useQueryClient()
  const today = new Date()
  const toIso = (d: Date) => d.toISOString().split('T')[0]
  const getQuickRange = (type: 'week' | 'month') => {
    const from = new Date(today)
    if (type === 'week') from.setDate(from.getDate() - 6)
    else from.setDate(1)
    return { from: toIso(from), to: toIso(today) }
  }
  const defaultRange = getQuickRange('month')

  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [quickFilter, setQuickFilter] = useState<'week' | 'month' | 'custom'>('month')
  const [status, setStatus] = useState<FeeDiscrepancyStatus | ''>('')
  const [page, setPage] = useState(1)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [notesModal, setNotesModal] = useState<{ item: FeeDiscrepancyItem; action: 'CONFIRMED' | 'DISMISSED' | 'CORRECT' } | null>(null)
  const [notesText, setNotesText] = useState('')
  const [correctionLines, setCorrectionLines] = useState<Array<{ correctionType: string; amount: number }>>([{ correctionType: 'POS_PENDING', amount: 0 }])
  const limit = 50

  useEffect(() => {
    const handler = () => setActionMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const applyQuickFilter = (type: 'week' | 'month') => {
    const range = getQuickRange(type)
    setDateFrom(range.from); setDateTo(range.to); setQuickFilter(type); setPage(1)
  }

  const { data: summaryData } = useQuery({
    queryKey: ['fee-discrepancy-summary', dateFrom, dateTo],
    queryFn: () => feeDiscrepancyApi.summary({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  })
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['fee-discrepancy-list', dateFrom, dateTo, status, page],
    queryFn: () => feeDiscrepancyApi.list({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, status: status || undefined, page, limit }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { source: FeeDiscrepancySource; sourceId: string; status: 'CONFIRMED' | 'CORRECTED' | 'DISMISSED'; notes?: string }) =>
      feeDiscrepancyApi.updateStatus(p.source, p.sourceId, { status: p.status, notes: p.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-discrepancy-list'] }); qc.invalidateQueries({ queryKey: ['fee-discrepancy-summary'] }); toast.success('Status berhasil diupdate'); setNotesModal(null); setNotesText('') },
    onError: (err: Error) => toast.error(err.message),
  })
  const correctionMutation = useMutation({
    mutationFn: (p: { source: FeeDiscrepancySource; sourceId: string; lines: Array<{ correctionType: string; amount: number }>; notes?: string }) =>
      feeDiscrepancyApi.createCorrection(p.source, p.sourceId, p.lines, p.notes),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ['fee-discrepancy-list'] }); qc.invalidateQueries({ queryKey: ['fee-discrepancy-summary'] }); toast.success(`Jurnal koreksi ${data?.journalNumber || 'berhasil'} dibuat`); setNotesModal(null); setNotesText('') },
    onError: (err: Error) => toast.error(err.message),
  })
  const undoMutation = useMutation({
    mutationFn: (p: { source: FeeDiscrepancySource; sourceId: string }) => feeDiscrepancyApi.undoCorrection(p.source, p.sourceId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-discrepancy-list'] }); qc.invalidateQueries({ queryKey: ['fee-discrepancy-summary'] }); toast.success('Koreksi berhasil di-undo') },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleAction = (item: FeeDiscrepancyItem, action: 'CONFIRMED' | 'DISMISSED' | 'CORRECT') => {
    setNotesModal({ item, action }); setNotesText('')
    setCorrectionLines([{ correctionType: 'POS_PENDING', amount: Math.abs(item.discrepancyAmount) }])
    setActionMenuId(null)
  }
  const submitAction = () => {
    if (!notesModal) return
    if (notesModal.action === 'CORRECT') correctionMutation.mutate({ source: notesModal.item.source, sourceId: notesModal.item.sourceId, lines: correctionLines, notes: notesText || undefined })
    else updateMutation.mutate({ source: notesModal.item.source, sourceId: notesModal.item.sourceId, status: notesModal.action, notes: notesText || undefined })
  }

  const items = listData?.data || []
  const total = listData?.pagination?.total || 0
  const summary = summaryData
  const isPending = updateMutation.isPending || correctionMutation.isPending || undoMutation.isPending

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fee Discrepancy Review</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review selisih fee antara POS dan bank. Konfirmasi, dismiss, atau buat jurnal koreksi.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <SummaryCard label="Pending Review" value={summary?.totalPending || 0} icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} />
          <SummaryCard label="Bank Bayar Kurang" value={fmt(summary?.sumPendingPositive || 0)} icon={<ArrowUpDown className="w-5 h-5 text-red-500" />} />
          <SummaryCard label="Bank Bayar Lebih" value={fmt(Math.abs(summary?.sumPendingNegative || 0))} icon={<ArrowUpDown className="w-5 h-5 text-green-500" />} />
          <SummaryCard label="Confirmed" value={summary?.totalConfirmed || 0} icon={<CheckCircle className="w-5 h-5 text-blue-500" />} />
          <SummaryCard
            label="Outstanding (Belum Koreksi)"
            value={fmt(
              (summary?.sumPendingPositive || 0) + (summary?.sumPendingNegative || 0) +
              (summary?.sumConfirmedPositive || 0) + (summary?.sumConfirmedNegative || 0)
            )}
            icon={<AlertTriangle className="w-5 h-5 text-purple-500" />}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3"><Filter className="w-4 h-4 text-gray-400" /><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter</span></div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Periode</label>
              <div className="flex gap-1">
                {(['week', 'month'] as const).map(t => (
                  <button key={t} onClick={() => applyQuickFilter(t)} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${quickFilter === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {t === 'week' ? '7 Hari' : 'Bulan Ini'}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">Dari Tanggal</label><input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setQuickFilter('custom'); setPage(1) }} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Sampai Tanggal</label><input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setQuickFilter('custom'); setPage(1) }} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => { setStatus(e.target.value as FeeDiscrepancyStatus | ''); setPage(1) }} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Semua</option><option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option><option value="CORRECTED">Corrected</option><option value="DISMISSED">Dismissed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto overscroll-contain">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment / Branch</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Nett POS</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bank Cair</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Selisih</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {listLoading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400"><div className="animate-pulse">Memuat data...</div></td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">Tidak ada selisih fee ditemukan</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">{formatDate(item.transactionDate)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full ${sourceBadge[item.source]}`}>{sourceLabel[item.source]}</span></td>
                    <td className="px-4 py-3 text-sm"><div className="text-gray-900 dark:text-white">{item.paymentMethodName || '-'}</div>{item.branchName && <BranchList branches={item.branchName} />}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white whitespace-nowrap">{fmt(item.posNettAmount)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white whitespace-nowrap">{fmt(item.bankAmount)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold whitespace-nowrap">{(() => { const d = -item.discrepancyAmount; return <span className={d > 0 ? 'text-green-600' : d < 0 ? 'text-red-600' : 'text-gray-500'}>{d > 0 ? '+' : ''}{fmt(d)}</span> })()}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-48 truncate">{item.notes || item.bankDescription || '-'}</td>
                    <td className="px-4 py-3 text-center relative">
                      {item.status === 'PENDING' ? (
                        <div className="relative inline-block">
                          <button onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === item.id ? null : item.id) }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><MoreHorizontal className="w-4 h-4 text-gray-500" /></button>
                          {actionMenuId === item.id && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-44">
                              <button onClick={() => handleAction(item, 'CONFIRMED')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-green-700 dark:text-green-400"><Check className="w-3.5 h-3.5" /> Konfirmasi Fee Disc</button>
                              <button onClick={() => handleAction(item, 'DISMISSED')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500"><X className="w-3.5 h-3.5" /> Dismiss</button>
                              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                              <button onClick={() => handleAction(item, 'CORRECT')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-blue-700 dark:text-blue-400"><FileEdit className="w-3.5 h-3.5" /> Buat Journal Koreksi</button>
                            </div>
                          )}
                        </div>
                      ) : item.status === 'CORRECTED' ? (
                        <button
                          onClick={() => { if (confirm('Undo koreksi? Journal koreksi akan dihapus dan status kembali PENDING.')) undoMutation.mutate({ source: item.source, sourceId: item.sourceId }) }}
                          disabled={undoMutation.isPending}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500 hover:text-red-700"
                          title="Undo Koreksi"
                        ><Undo2 className="w-4 h-4" /></button>
                      ) : <Eye className="w-4 h-4 text-gray-300 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > limit && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-500">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} dari {total}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40">Prev</button>
                <button disabled={page * limit >= total} onClick={() => setPage(page + 1)} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !isPending && setNotesModal(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {notesModal.action === 'CONFIRMED' ? 'Konfirmasi Fee Discrepancy' : notesModal.action === 'CORRECT' ? 'Buat Journal Koreksi' : 'Dismiss Fee Discrepancy'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {notesModal.action === 'CONFIRMED' ? 'Selisih ini memang fee discrepancy yang valid (biarkan di akun 610105).'
                : notesModal.action === 'CORRECT' ? 'Buat jurnal koreksi otomatis: reverse Fee Discrepancy ke akun yang dipilih.'
                : 'Selisih ini bukan fee discrepancy (misal: POS belum masuk, akan dikoreksi nanti).'}
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Selisih</span>{(() => { const d = -notesModal.item.discrepancyAmount; return <span className={`font-bold ${d > 0 ? 'text-green-600' : d < 0 ? 'text-red-600' : 'text-gray-500'}`}>{d > 0 ? '+' : ''}{fmt(d)}</span> })()}</div>
              <div className="flex justify-between mt-1"><span className="text-gray-500">Tanggal</span><span className="text-gray-900 dark:text-white">{formatDate(notesModal.item.transactionDate)}</span></div>
              {notesModal.item.paymentMethodName && <div className="flex justify-between mt-1"><span className="text-gray-500">Payment Method</span><span className="text-gray-900 dark:text-white">{notesModal.item.paymentMethodName}</span></div>}
            </div>
            {notesModal.action === 'CORRECT' && (() => {
              const discAmt = Math.round(Math.abs(notesModal.item.discrepancyAmount) * 100) / 100
              const linesTotal = Math.round(correctionLines.reduce((s, l) => s + l.amount, 0) * 100) / 100
              const remaining = Math.round((discAmt - linesTotal) * 100) / 100
              const isBalanced = Math.abs(remaining) < 0.01

              const updateLine = (idx: number, field: 'correctionType' | 'amount', val: string | number) => {
                setCorrectionLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: field === 'amount' ? Number(val) : val } : l))
              }
              const addLine = () => setCorrectionLines(prev => [...prev, { correctionType: 'POS_PENDING', amount: remaining > 0 ? remaining : 0 }])
              const removeLine = (idx: number) => setCorrectionLines(prev => prev.filter((_, i) => i !== idx))

              return (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Rincian Koreksi</label>
                    <button onClick={addLine} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"><Plus className="w-3 h-3" /> Tambah Baris</button>
                  </div>
                  <div className="space-y-2">
                    {correctionLines.map((line, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select value={line.correctionType} onChange={(e) => updateLine(idx, 'correctionType', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                          <option value="POS_PENDING">POS Belum Masuk</option>
                          <option value="REFUND_CUSTOMER">Refund Customer</option>
                          <option value="PLATFORM_COMPENSATION">Kompensasi Platform</option>
                          <option value="STAFF_DEDUCTION">Potongan Staff</option>
                          <option value="ROUNDING">Pembulatan</option>
                        </select>
                        <input type="number" value={line.amount || ''} onChange={(e) => updateLine(idx, 'amount', e.target.value)}
                          placeholder="Amount" className="w-32 px-2 py-1.5 text-xs text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        {correctionLines.length > 1 && (
                          <button onClick={() => removeLine(idx)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={`flex justify-between mt-2 text-xs font-medium ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    <span>Total: {fmt(linesTotal)}</span>
                    <span>{isBalanced ? '✓ Balance' : `Sisa: ${fmt(remaining)}`}</span>
                  </div>
                </div>
              )
            })()}
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan (opsional)</label>
            <textarea value={notesText} onChange={(e) => setNotesText(e.target.value)} placeholder="Tambahkan catatan..." className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4" rows={2} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setNotesModal(null)} disabled={isPending} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">Batal</button>
              <button onClick={submitAction} disabled={isPending} className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${notesModal.action === 'CONFIRMED' ? 'bg-green-600 hover:bg-green-700' : notesModal.action === 'CORRECT' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}>
                {isPending ? 'Menyimpan...' : notesModal.action === 'CONFIRMED' ? 'Konfirmasi' : notesModal.action === 'CORRECT' ? 'Buat Jurnal Koreksi' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div><p className="text-xs text-gray-500 dark:text-gray-400">{label}</p><p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{value}</p></div>
        {icon}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: FeeDiscrepancyStatus }) {
  const styles: Record<FeeDiscrepancyStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    CONFIRMED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    CORRECTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    DISMISSED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  }
  return <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full ${styles[status]}`}>{status}</span>
}

function BranchList({ branches }: { branches: string }) {
  const list = branches.split(', ').filter(Boolean)
  const [expanded, setExpanded] = useState(false)

  if (list.length <= 1) return <div className="text-[11px] text-gray-400">{branches}</div>

  if (expanded) {
    return (
      <div className="text-[11px] text-gray-400">
        {list.join(', ')}
        <button onClick={() => setExpanded(false)} className="ml-1 text-blue-500 hover:text-blue-700">tutup</button>
      </div>
    )
  }

  return (
    <div className="text-[11px] text-gray-400">
      {list[0]} <button onClick={() => setExpanded(true)} className="text-blue-500 hover:text-blue-700">+{list.length - 1} lainnya</button>
    </div>
  )
}

export default FeeDiscrepancyReviewPage
