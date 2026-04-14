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

function getYesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] }
function getMonthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }

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

  // Inline edit
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editLarge, setEditLarge] = useState('')
  const [editSmall, setEditSmall] = useState('')
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
    try { setRows(await cashCountsApi.preview(startDate, endDate, paymentMethodId)); setCollapsedBranches(new Set()) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat data') }
    finally { setIsLoading(false) }
  }, [startDate, endDate, paymentMethodId, toast])

  const rk = (r: CashCountPreviewRow) => `${r.branch_name}|${r.transaction_date}`

  const branchGroups = useMemo(() => {
    const map = new Map<string, CashCountPreviewRow[]>()
    for (const r of rows) { if (!map.has(r.branch_name)) map.set(r.branch_name, []); map.get(r.branch_name)!.push(r) }
    return [...map.entries()].map(([name, items]) => ({
      name, items,
      system: items.reduce((s, r) => s + r.system_balance, 0),
      physical: items.reduce((s, r) => s + (r.physical_count ?? 0), 0),
      diff: items.reduce((s, r) => s + (r.difference ?? 0), 0),
      counted: items.filter((r) => r.physical_count !== null).length,
    }))
  }, [rows])

  const toggleBranch = (name: string) => setCollapsedBranches((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })

  const editTotal = (Number(editLarge) || 0) + (Number(editSmall) || 0)

  const handleSaveCount = useCallback(async (row: CashCountPreviewRow) => {
    const large = Number(editLarge) || 0
    const small = Number(editSmall) || 0
    const total = large + small
    if (total <= 0) { toast.error('Total harus > 0'); return }
    const diff = total - row.system_balance
    if (diff < 0 && !editEmployeeId) { toast.error('Deficit wajib mengisi PIC'); return }

    setIsMutating(true)
    try {
      let ccId = row.cash_count_id
      if (!ccId) {
        const created = await cashCountsApi.create({ start_date: row.transaction_date, end_date: row.transaction_date, branch_name: row.branch_name, payment_method_id: paymentMethodId })
        ccId = created.id
      }
      await cashCountsApi.updatePhysicalCount(ccId, { large_denomination: large, small_denomination: small, responsible_employee_id: diff < 0 ? editEmployeeId : undefined })
      toast.success(`${row.branch_name} · ${fmtDate(row.transaction_date)} disimpan`)
      setEditKey(null)
      await handlePreview()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal simpan') }
    finally { setIsMutating(false) }
  }, [editLarge, editSmall, editEmployeeId, paymentMethodId, toast, handlePreview])

  const handleOpenDetail = useCallback(async (row: CashCountPreviewRow) => {
    if (!row.cash_count_id) return
    try { setSelectedDetail(await cashCountsApi.getById(row.cash_count_id)); setShowDetail(true) }
    catch { toast.error('Gagal memuat detail') }
  }, [toast])

  const handleCount = useCallback(async (id: string, dto: UpdatePhysicalCountDto) => { await cashCountsApi.updatePhysicalCount(id, dto); toast.success('Disimpan'); handlePreview() }, [toast, handlePreview])
  const handleDeposit = useCallback(async (id: string, dto: DepositDto) => { await cashCountsApi.deposit(id, dto); toast.success('Setoran dicatat'); handlePreview() }, [toast, handlePreview])
  const handleClose = useCallback(async (id: string) => { await cashCountsApi.close(id); toast.success('Ditutup'); handlePreview() }, [toast, handlePreview])

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

      {/* Branch Groups */}
      {branchGroups.map((group) => {
        const isCollapsed = collapsedBranches.has(group.name)
        return (
          <div key={group.name} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Branch Header */}
            <button onClick={() => toggleBranch(group.name)}
              className="w-full px-4 py-2.5 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">{group.name}</span>
                <span className="text-[10px] text-gray-400">{group.counted}/{group.items.length}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-mono text-gray-500">{fmt(group.system)}</span>
                {group.counted > 0 && (
                  <span className={`text-[10px] font-mono font-medium ${group.diff > 0 ? 'text-blue-600' : group.diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {group.diff > 0 ? '+' : ''}{fmt(group.diff)}
                  </span>
                )}
                {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronUp className="w-3.5 h-3.5 text-gray-400" />}
              </div>
            </button>

            {/* Rows */}
            {!isCollapsed && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-3 py-2 text-left font-semibold">Tanggal</th>
                    <th className="px-3 py-2 text-right font-semibold">System</th>
                    <th className="px-3 py-2 text-right font-semibold">Besar</th>
                    <th className="px-3 py-2 text-right font-semibold">Kecil</th>
                    <th className="px-3 py-2 text-right font-semibold">Total Fisik</th>
                    <th className="px-3 py-2 text-right font-semibold">Selisih</th>
                    <th className="px-3 py-2 text-center font-semibold">Status</th>
                    <th className="px-3 py-2 text-left font-semibold">PIC</th>
                    <th className="px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((row) => {
                    const k = rk(row)
                    const isEditing = editKey === k
                    const diff = row.difference ?? 0
                    const canEdit = !row.status || row.status === 'OPEN'
                    const hasDetail = !!row.cash_count_id && row.status && row.status !== 'OPEN'

                    return (
                      <tr key={k} className={`border-b border-gray-100 dark:border-gray-800 transition-colors ${hasDetail ? 'cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/40' : ''}`}
                        onClick={() => hasDetail && handleOpenDetail(row)}>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(row.transaction_date)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">{fmt(row.system_balance)}</td>

                        {/* Pecahan Besar */}
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <input type="number" value={editLarge} onChange={(e) => setEditLarge(e.target.value)} min={0} autoFocus placeholder="0"
                              className="w-24 px-2 py-1 border border-amber-300 dark:border-amber-600 rounded text-xs text-right font-mono focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCount(row); if (e.key === 'Escape') setEditKey(null) }} />
                          ) : row.physical_count !== null ? (
                            <span className="font-mono text-gray-600 dark:text-gray-400">{fmt(row.large_denomination ?? 0)}</span>
                          ) : null}
                        </td>

                        {/* Pecahan Kecil */}
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <input type="number" value={editSmall} onChange={(e) => setEditSmall(e.target.value)} min={0} placeholder="0"
                              className="w-24 px-2 py-1 border border-amber-300 dark:border-amber-600 rounded text-xs text-right font-mono focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCount(row); if (e.key === 'Escape') setEditKey(null) }} />
                          ) : row.physical_count !== null ? (
                            <span className="font-mono text-gray-600 dark:text-gray-400">{fmt(row.small_denomination ?? 0)}</span>
                          ) : null}
                        </td>

                        {/* Total Fisik */}
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                          {isEditing ? (
                            <span className="font-medium text-amber-600">{fmt(editTotal)}</span>
                          ) : row.physical_count !== null ? (
                            <span className="font-medium text-gray-900 dark:text-white">{fmt(row.physical_count)}</span>
                          ) : canEdit ? (
                            <button onClick={(e) => { e.stopPropagation(); setEditKey(k); setEditLarge(''); setEditSmall(''); setEditEmployeeId('') }}
                              className="text-[10px] text-amber-600 hover:text-amber-700 font-medium">Input</button>
                          ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>

                        {/* Selisih */}
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                          {isEditing ? (
                            <span className={`font-medium ${editTotal - row.system_balance > 0 ? 'text-blue-600' : editTotal - row.system_balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {editTotal - row.system_balance > 0 ? '+' : ''}{fmt(editTotal - row.system_balance)}
                            </span>
                          ) : row.physical_count !== null ? (
                            <span className={diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-green-600'}>
                              {diff > 0 ? '+' : ''}{fmt(diff)}
                            </span>
                          ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>

                        <td className="px-3 py-2 text-center">
                          {row.status ? <CashCountStatusBadge status={row.status as CashCountStatus} /> : null}
                        </td>

                        {/* PIC */}
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          {isEditing && editTotal < row.system_balance ? (
                            <select value={editEmployeeId} onChange={(e) => setEditEmployeeId(e.target.value)}
                              className="w-full px-2 py-1 border border-red-300 dark:border-red-600 rounded text-[10px] bg-white dark:bg-gray-700 dark:text-white">
                              <option value="">PIC *</option>
                              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                            </select>
                          ) : row.responsible_employee_id ? (
                            <span className="text-[10px] text-red-600 dark:text-red-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {employees.find((e) => e.id === row.responsible_employee_id)?.full_name || '-'}
                            </span>
                          ) : null}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {isEditing && (
                            <div className="flex items-center gap-1 justify-center">
                              <button onClick={() => handleSaveCount(row)} disabled={isMutating}
                                className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 rounded disabled:opacity-50">
                                {isMutating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => setEditKey(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

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
