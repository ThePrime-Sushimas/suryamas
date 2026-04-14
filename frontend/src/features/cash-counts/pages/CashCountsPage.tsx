import { useState, useCallback, useEffect, useMemo } from 'react'
import { Coins, Search, RefreshCw, Loader2, AlertTriangle, Check, X, ChevronDown, ChevronUp, Building } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { cashCountsApi, type CashCountPreviewRow } from '../api/cashCounts.api'
import { CashCountStatusBadge } from '../components/CashCountStatusBadge'
import { CashCountDetailPanel } from '../components/CashCountDetailPanel'
import type { CashCount, CashCountStatus, UpdatePhysicalCountDto, DepositDto } from '../types'
import api from '@/lib/axios'

const fmt = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })

function getYesterday(): string {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]
}
function getMonthStart(): string {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function CashCountsPage() {
  const toast = useToast()

  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getYesterday())
  const [paymentMethodId, setPaymentMethodId] = useState(0)
  const [rows, setRows] = useState<CashCountPreviewRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set())

  const [selectedDetail, setSelectedDetail] = useState<CashCount | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const [paymentMethods, setPaymentMethods] = useState<{ id: number; name: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [bankAccounts, setBankAccounts] = useState<{ id: number; account_name: string; bank_name: string }[]>([])

  const [editKey, setEditKey] = useState<string | null>(null)
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
      setCollapsedBranches(new Set())
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat data') }
    finally { setIsLoading(false) }
  }, [startDate, endDate, paymentMethodId, toast])

  const rk = (r: CashCountPreviewRow) => `${r.branch_name}|${r.transaction_date}`

  // Group by branch
  const branchGroups = useMemo(() => {
    const map = new Map<string, CashCountPreviewRow[]>()
    for (const r of rows) {
      if (!map.has(r.branch_name)) map.set(r.branch_name, [])
      map.get(r.branch_name)!.push(r)
    }
    return [...map.entries()].map(([name, items]) => ({
      name,
      items,
      system: items.reduce((s, r) => s + r.system_balance, 0),
      physical: items.reduce((s, r) => s + (r.physical_count ?? 0), 0),
      diff: items.reduce((s, r) => s + (r.difference ?? 0), 0),
      counted: items.filter((r) => r.physical_count !== null).length,
    }))
  }, [rows])

  const toggleBranch = (name: string) => {
    setCollapsedBranches((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const handleSaveCount = useCallback(async (row: CashCountPreviewRow) => {
    const physical = Number(editPhysical)
    if (isNaN(physical) || physical < 0) return
    const diff = physical - row.system_balance
    if (diff < 0 && !editEmployeeId) { toast.error('Deficit wajib mengisi PIC'); return }

    setIsMutating(true)
    try {
      if (row.cash_count_id) {
        await cashCountsApi.updatePhysicalCount(row.cash_count_id, {
          physical_count: physical, responsible_employee_id: diff < 0 ? editEmployeeId : undefined,
        })
      } else {
        const created = await cashCountsApi.create({
          start_date: row.transaction_date, end_date: row.transaction_date,
          branch_name: row.branch_name, payment_method_id: paymentMethodId,
        })
        await cashCountsApi.updatePhysicalCount(created.id, {
          physical_count: physical, responsible_employee_id: diff < 0 ? editEmployeeId : undefined,
        })
      }
      toast.success(`${row.branch_name} · ${fmtDate(row.transaction_date)} disimpan`)
      setEditKey(null)
      await handlePreview()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal simpan') }
    finally { setIsMutating(false) }
  }, [editPhysical, editEmployeeId, paymentMethodId, toast, handlePreview])

  const handleOpenDetail = useCallback(async (row: CashCountPreviewRow) => {
    if (!row.cash_count_id) return
    try {
      const detail = await cashCountsApi.getById(row.cash_count_id)
      setSelectedDetail(detail); setShowDetail(true)
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

      {/* Grand Summary */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
            <p className="text-[10px] text-gray-400">Total System</p>
            <p className="text-sm font-semibold font-mono text-gray-900 dark:text-white">{fmt(grandSystem)}</p>
          </div>
          {grandCounted > 0 && (
            <>
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                <p className="text-[10px] text-gray-400">Total Fisik</p>
                <p className="text-sm font-semibold font-mono text-gray-900 dark:text-white">{fmt(grandPhysical)}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                <p className="text-[10px] text-gray-400">Total Selisih</p>
                <p className={`text-sm font-semibold font-mono ${grandDiff > 0 ? 'text-blue-600' : grandDiff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {grandDiff > 0 ? '+' : ''}{fmt(grandDiff)}
                </p>
              </div>
            </>
          )}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
            <p className="text-[10px] text-gray-400">Progress</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{grandCounted}/{rows.length}</p>
          </div>
        </div>
      )}

      {/* Branch Groups */}
      {branchGroups.map((group) => {
        const isCollapsed = collapsedBranches.has(group.name)
        return (
          <div key={group.name} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Branch Header — clickable to collapse */}
            <button onClick={() => toggleBranch(group.name)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-2.5">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">{group.name}</span>
                <span className="text-[10px] text-gray-400">{group.counted}/{group.items.length} dihitung</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="text-gray-500">Sys: {fmt(group.system)}</span>
                  {group.counted > 0 && (
                    <>
                      <span className="text-gray-500">Fisik: {fmt(group.physical)}</span>
                      <span className={group.diff > 0 ? 'text-blue-600' : group.diff < 0 ? 'text-red-600' : 'text-green-600'}>
                        {group.diff > 0 ? '+' : ''}{fmt(group.diff)}
                      </span>
                    </>
                  )}
                </div>
                {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronUp className="w-3.5 h-3.5 text-gray-400" />}
              </div>
            </button>

            {/* Day Cards Grid */}
            {!isCollapsed && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {group.items.map((row) => {
                  const k = rk(row)
                  const isEditing = editKey === k
                  const diff = row.difference ?? 0
                  const canEdit = !row.status || row.status === 'OPEN'
                  const hasDetail = !!row.cash_count_id && row.status && row.status !== 'OPEN'

                  return (
                    <div key={k}
                      className={`rounded-lg border p-3 transition-all ${
                        row.physical_count !== null
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30'
                          : 'border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                      } ${hasDetail ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-700' : ''}`}
                      onClick={() => hasDetail && handleOpenDetail(row)}>

                      {/* Date + Status */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{fmtDate(row.transaction_date)}</span>
                        {row.status ? <CashCountStatusBadge status={row.status as CashCountStatus} /> : null}
                      </div>

                      {/* System balance */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-gray-400">System</span>
                        <span className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300">{fmt(row.system_balance)}</span>
                      </div>

                      {/* Physical count */}
                      <div className="flex items-center justify-between mb-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-gray-400">Fisik</span>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input type="number" value={editPhysical} onChange={(e) => setEditPhysical(e.target.value)} min={0} autoFocus
                              className="w-24 px-2 py-1 border border-amber-300 dark:border-amber-600 rounded text-xs text-right font-mono focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCount(row); if (e.key === 'Escape') setEditKey(null) }} />
                            <button onClick={() => handleSaveCount(row)} disabled={isMutating}
                              className="p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 rounded disabled:opacity-50">
                              {isMutating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            </button>
                            <button onClick={() => setEditKey(null)} className="p-0.5 text-gray-400 hover:text-gray-600 rounded">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : row.physical_count !== null ? (
                          <span className="text-xs font-mono font-medium text-gray-900 dark:text-white">{fmt(row.physical_count)}</span>
                        ) : canEdit ? (
                          <button onClick={() => { setEditKey(k); setEditPhysical(''); setEditEmployeeId('') }}
                            className="text-[10px] text-amber-600 hover:text-amber-700 font-medium px-2 py-0.5 rounded hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors">
                            Input
                          </button>
                        ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                      </div>

                      {/* Selisih */}
                      {row.physical_count !== null && (
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-gray-400">Selisih</span>
                          <span className={`text-xs font-mono font-medium ${diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {diff > 0 ? '+' : ''}{fmt(diff)}
                          </span>
                        </div>
                      )}

                      {/* PIC for deficit — inline when editing */}
                      {isEditing && editPhysical && Number(editPhysical) < row.system_balance && (
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
                          <label className="text-[10px] text-red-500 flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3" />PIC Deficit *</label>
                          <select value={editEmployeeId} onChange={(e) => setEditEmployeeId(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-[10px] bg-white dark:bg-gray-700 dark:text-white">
                            <option value="">Pilih</option>
                            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                          </select>
                        </div>
                      )}

                      {/* PIC display for existing deficit */}
                      {!isEditing && row.responsible_employee_id && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-500">
                          <AlertTriangle className="w-3 h-3" />
                          {employees.find((e) => e.id === row.responsible_employee_id)?.full_name || 'Employee'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Empty states */}
      {!isLoading && rows.length === 0 && paymentMethodId > 0 && (
        <div className="py-12 text-center text-gray-400 text-xs">Tidak ada data cash untuk periode dan payment method ini</div>
      )}
      {!paymentMethodId && (
        <div className="py-12 text-center text-gray-400 text-xs">Pilih payment method lalu klik Tampilkan</div>
      )}

      {/* Detail Panel */}
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
