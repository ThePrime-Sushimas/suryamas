import { useState, useCallback, useEffect } from 'react'
import { Coins, Search, RefreshCw, Loader2, AlertTriangle, Check, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { cashCountsApi, type CashCountPreviewRow } from '../api/cashCounts.api'
import { CashCountStatusBadge } from '../components/CashCountStatusBadge'
import { CashCountDetailPanel } from '../components/CashCountDetailPanel'
import type { CashCount, CashCountStatus, UpdatePhysicalCountDto, DepositDto } from '../types'
import api from '@/lib/axios'

const fmt = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })

function getYesterday(): string {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
function getMonthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function CashCountsPage() {
  const toast = useToast()

  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getYesterday())
  const [paymentMethodId, setPaymentMethodId] = useState(0)

  const [rows, setRows] = useState<CashCountPreviewRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)

  const [selectedDetail, setSelectedDetail] = useState<CashCount | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const [paymentMethods, setPaymentMethods] = useState<{ id: number; name: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [bankAccounts, setBankAccounts] = useState<{ id: number; account_name: string; bank_name: string }[]>([])

  // Inline edit
  const [editKey, setEditKey] = useState<string | null>(null) // "branchId|date"
  const [editPhysical, setEditPhysical] = useState('')
  const [editEmployeeId, setEditEmployeeId] = useState('')

  useEffect(() => {
    api.get('/payment-methods/options').then((r) => setPaymentMethods((r.data.data || []).map((pm: any) => ({ id: pm.id, name: pm.name })))).catch(() => {})
    api.get('/employees', { params: { limit: 500 } }).then((r) => setEmployees(r.data.data || [])).catch(() => {})
    api.get('/bank-accounts').then((r) => setBankAccounts(
      (r.data.data || []).map((a: any) => ({ id: a.id, account_name: a.account_name, bank_name: a.banks?.bank_name || '' }))
    )).catch(() => {})
  }, [])

  const handlePreview = useCallback(async () => {
    if (!startDate || !endDate || !paymentMethodId) return
    setIsLoading(true)
    try {
      const data = await cashCountsApi.preview(startDate, endDate, paymentMethodId)
      setRows(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat data')
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate, paymentMethodId, toast])

  const rowKey = (r: CashCountPreviewRow) => `${r.branch_id}|${r.transaction_date}`

  const handleSaveCount = useCallback(async (row: CashCountPreviewRow) => {
    const physical = Number(editPhysical)
    if (isNaN(physical) || physical < 0) return

    const diff = physical - row.system_balance
    const isDeficit = diff < 0
    if (isDeficit && !editEmployeeId) {
      toast.error('Deficit wajib mengisi PIC')
      return
    }

    setIsMutating(true)
    try {
      if (row.cash_count_id) {
        await cashCountsApi.updatePhysicalCount(row.cash_count_id, {
          physical_count: physical,
          responsible_employee_id: isDeficit ? editEmployeeId : undefined,
        })
      } else {
        // Create with start_date = end_date = transaction_date (single day)
        const created = await cashCountsApi.create({
          start_date: row.transaction_date,
          end_date: row.transaction_date,
          branch_id: row.branch_id,
          payment_method_id: paymentMethodId,
        })
        await cashCountsApi.updatePhysicalCount(created.id, {
          physical_count: physical,
          responsible_employee_id: isDeficit ? editEmployeeId : undefined,
        })
      }
      toast.success(`${row.branch_name} · ${fmtDate(row.transaction_date)} disimpan`)
      setEditKey(null)
      await handlePreview()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal simpan')
    } finally {
      setIsMutating(false)
    }
  }, [editPhysical, editEmployeeId, paymentMethodId, toast, handlePreview])

  const handleOpenDetail = useCallback(async (row: CashCountPreviewRow) => {
    if (!row.cash_count_id) return
    try {
      const detail = await cashCountsApi.getById(row.cash_count_id)
      setSelectedDetail(detail)
      setShowDetail(true)
    } catch { toast.error('Gagal memuat detail') }
  }, [toast])

  const handleCount = useCallback(async (id: string, dto: UpdatePhysicalCountDto) => {
    await cashCountsApi.updatePhysicalCount(id, dto); toast.success('Disimpan'); handlePreview()
  }, [toast, handlePreview])

  const handleDeposit = useCallback(async (id: string, dto: DepositDto) => {
    await cashCountsApi.deposit(id, dto); toast.success('Setoran dicatat'); handlePreview()
  }, [toast, handlePreview])

  const handleClose = useCallback(async (id: string) => {
    await cashCountsApi.close(id); toast.success('Ditutup'); handlePreview()
  }, [toast, handlePreview])

  // Group rows by branch for subtotal display
  const branches = [...new Set(rows.map((r) => r.branch_id))]
  const branchTotals = branches.map((bid) => {
    const branchRows = rows.filter((r) => r.branch_id === bid)
    return {
      branch_id: bid,
      branch_name: branchRows[0]?.branch_name || '',
      system: branchRows.reduce((s, r) => s + r.system_balance, 0),
      physical: branchRows.reduce((s, r) => s + (r.physical_count ?? 0), 0),
      diff: branchRows.reduce((s, r) => s + (r.difference ?? 0), 0),
      counted: branchRows.filter((r) => r.physical_count !== null).length,
      total: branchRows.length,
    }
  })

  const grandSystem = rows.reduce((s, r) => s + r.system_balance, 0)
  const grandPhysical = rows.reduce((s, r) => s + (r.physical_count ?? 0), 0)
  const grandDiff = rows.reduce((s, r) => s + (r.difference ?? 0), 0)
  const grandCounted = rows.filter((r) => r.physical_count !== null).length

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-amber-600 rounded-xl"><Coins className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Cash Count</h1>
          <p className="text-[10px] text-gray-400">Hitung fisik kas vs system balance POS — per cabang per hari</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-40">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Dari</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="w-40">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Sampai</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="w-52">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Payment Method *</label>
            <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={0}>Pilih payment method</option>
              {paymentMethods.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
            </select>
          </div>
          <button onClick={handlePreview} disabled={isLoading || !paymentMethodId}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Tampilkan
          </button>
        </div>
      </div>

      {/* Table */}
      {rows.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Grand summary */}
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-6 text-xs">
            <span className="text-gray-500">{rows.length} baris · {branches.length} cabang · {grandCounted}/{rows.length} dihitung</span>
            <span className="ml-auto font-mono font-medium text-gray-900 dark:text-white">{fmt(grandSystem)}</span>
            {grandCounted > 0 && (
              <>
                <span className="font-mono font-medium text-gray-900 dark:text-white">{fmt(grandPhysical)}</span>
                <span className={`font-mono font-medium ${grandDiff > 0 ? 'text-blue-600' : grandDiff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {grandDiff > 0 ? '+' : ''}{fmt(grandDiff)}
                </span>
              </>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  <th className="px-3 py-2.5 text-left font-semibold">Cabang</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Tanggal</th>
                  <th className="px-3 py-2.5 text-right font-semibold">System</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Trx</th>
                  <th className="px-3 py-2.5 text-right font-semibold w-40">Fisik</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Selisih</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-left font-semibold">PIC</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((bid) => {
                  const branchRows = rows.filter((r) => r.branch_id === bid)
                  const bt = branchTotals.find((t) => t.branch_id === bid)!

                  return branchRows.map((row, idx) => {
                    const rk = rowKey(row)
                    const isEditing = editKey === rk
                    const diff = row.difference ?? 0
                    const canEdit = !row.status || row.status === 'OPEN'
                    const hasDetail = !!row.cash_count_id && row.status && row.status !== 'OPEN'
                    const isFirstOfBranch = idx === 0
                    const isLastOfBranch = idx === branchRows.length - 1

                    return (
                      <tr key={rk}
                        className={`border-b transition-colors ${
                          isLastOfBranch ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-800'
                        } ${hasDetail ? 'cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/40' : ''}`}
                        onClick={() => hasDetail && handleOpenDetail(row)}>

                        {/* Cabang — show name only on first row, subtotal on last */}
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                          {isFirstOfBranch ? row.branch_name : ''}
                        </td>

                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(row.transaction_date)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">{fmt(row.system_balance)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{row.transaction_count}</td>

                        {/* Fisik — inline edit */}
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <input type="number" value={editPhysical} onChange={(e) => setEditPhysical(e.target.value)} min={0} autoFocus
                                className="w-28 px-2 py-1 border border-amber-300 rounded text-xs text-right font-mono focus:ring-1 focus:ring-amber-500 outline-none dark:bg-gray-700 dark:text-white dark:border-amber-600" />
                              <button onClick={() => handleSaveCount(row)} disabled={isMutating}
                                className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 rounded disabled:opacity-50">
                                {isMutating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => setEditKey(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : row.physical_count !== null ? (
                            <span className="font-mono text-gray-900 dark:text-white">{fmt(row.physical_count)}</span>
                          ) : canEdit ? (
                            <button onClick={() => { setEditKey(rk); setEditPhysical(''); setEditEmployeeId('') }}
                              className="text-[10px] text-amber-600 hover:text-amber-700 font-medium">Input</button>
                          ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>

                        {/* Selisih */}
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                          {row.physical_count !== null ? (
                            <span className={diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-green-600'}>
                              {diff > 0 ? '+' : ''}{fmt(diff)}
                            </span>
                          ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>

                        <td className="px-3 py-2 text-center">
                          {row.status ? <CashCountStatusBadge status={row.status as CashCountStatus} /> : <span className="text-[10px] text-gray-300">—</span>}
                        </td>

                        {/* PIC */}
                        <td className="px-3 py-2 text-gray-500" onClick={(e) => e.stopPropagation()}>
                          {isEditing && editPhysical && Number(editPhysical) < row.system_balance ? (
                            <select value={editEmployeeId} onChange={(e) => setEditEmployeeId(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 dark:text-white">
                              <option value="">PIC</option>
                              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                            </select>
                          ) : row.responsible_employee_id ? (
                            <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {employees.find((e) => e.id === row.responsible_employee_id)?.full_name || '-'}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    )
                  }).concat(
                    // Subtotal row per branch
                    <tr key={`subtotal-${bid}`} className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700">
                      <td className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400" colSpan={2}>
                        Subtotal {bt.branch_name} ({bt.counted}/{bt.total})
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[10px] font-semibold text-gray-600 dark:text-gray-400">{fmt(bt.system)}</td>
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5 text-right font-mono text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                        {bt.counted > 0 ? fmt(bt.physical) : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[10px] font-semibold whitespace-nowrap">
                        {bt.counted > 0 ? (
                          <span className={bt.diff > 0 ? 'text-blue-600' : bt.diff < 0 ? 'text-red-600' : 'text-green-600'}>
                            {bt.diff > 0 ? '+' : ''}{fmt(bt.diff)}
                          </span>
                        ) : ''}
                      </td>
                      <td className="px-3 py-1.5" colSpan={2} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && rows.length === 0 && paymentMethodId > 0 && (
        <div className="py-12 text-center text-gray-400 text-xs">Tidak ada data cash untuk periode dan payment method ini</div>
      )}
      {!paymentMethodId && (
        <div className="py-12 text-center text-gray-400 text-xs">Pilih payment method lalu klik Tampilkan</div>
      )}

      {selectedDetail && (
        <CashCountDetailPanel
          item={selectedDetail} isOpen={showDetail} onClose={() => setShowDetail(false)}
          onCount={handleCount} onDeposit={handleDeposit} onCloseCount={handleClose}
          employees={employees} bankAccounts={bankAccounts} isLoading={isMutating}
        />
      )}
    </div>
  )
}
