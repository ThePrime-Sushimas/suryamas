import { useState, useCallback, useEffect, useMemo } from 'react'
import { Coins, Search, RefreshCw, Loader2, AlertTriangle, Check, X, ChevronDown, ChevronUp, Building, Banknote } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { cashCountsApi, type CashCountPreviewRow } from '../api/cashCounts.api'
import { CashCountStatusBadge } from '../components/CashCountStatusBadge'
import { CashCountDetailPanel } from '../components/CashCountDetailPanel'
import { DepositModal } from '../components/DepositModal'
import type { CashCount, CashCountStatus, UpdatePhysicalCountDto } from '../types'
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

  // Detail panel
  const [selectedDetail, setSelectedDetail] = useState<CashCount | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  // Deposit selection
  const [selectedForDeposit, setSelectedForDeposit] = useState<Set<string>>(new Set()) // keys: "branch|date"
  const [showDepositModal, setShowDepositModal] = useState(false)

  // Reference data
  const [paymentMethods, setPaymentMethods] = useState<{ id: number; name: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [bankAccounts, setBankAccounts] = useState<{ id: number; account_name: string; account_number: string; bank_name: string; bank_code: string }[]>([])

  // Inline edit
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editLarge, setEditLarge] = useState('')
  const [editSmall, setEditSmall] = useState('')
  const [editEmployeeId, setEditEmployeeId] = useState('')

  useEffect(() => {
    api.get('/payment-methods/options').then((r) => setPaymentMethods((r.data.data || []).map((pm: any) => ({ id: pm.id, name: pm.name })))).catch(() => {})
    api.get('/employees', { params: { limit: 500 } }).then((r) => setEmployees(r.data.data || [])).catch(() => {})
    api.get('/bank-accounts').then((r) => setBankAccounts(
      (r.data.data || []).map((a: any) => ({ id: a.id, account_name: a.account_name, account_number: a.account_number || '', bank_name: a.bank_name || '', bank_code: a.bank_code || '' }))
    )).catch(() => {})
  }, [])

  const handlePreview = useCallback(async () => {
    if (!startDate || !endDate || !paymentMethodId) return
    setIsLoading(true)
    try { setRows(await cashCountsApi.preview(startDate, endDate, paymentMethodId)); setCollapsedBranches(new Set()); setSelectedForDeposit(new Set()) }
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

  // Deposit selection helpers
  const toggleDepositSelect = (key: string) => {
    setSelectedForDeposit((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  const selectedDepositRows = rows.filter((r) => selectedForDeposit.has(rk(r)))
  const canDeposit = selectedDepositRows.length > 0 && selectedDepositRows.every((r) => r.status === 'COUNTED' && r.cash_count_id)

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

  const handleCount = useCallback(async (id: string, dto: UpdatePhysicalCountDto) => { await cashCountsApi.updatePhysicalCount(id, dto); toast.success('Disimpan'); setShowDetail(false); handlePreview() }, [toast, handlePreview])
  const handleClose = useCallback(async (id: string) => { await cashCountsApi.close(id); toast.success('Ditutup'); setShowDetail(false); handlePreview() }, [toast, handlePreview])

  const handleCreateDeposit = useCallback(async (depositDate: string, bankAccountId: number, reference: string, notes: string) => {
    const ids = selectedDepositRows.map((r) => r.cash_count_id!).filter(Boolean)
    if (ids.length === 0) return
    setIsMutating(true)
    try {
      await cashCountsApi.createDeposit({ cash_count_ids: ids, deposit_date: depositDate, bank_account_id: bankAccountId, reference: reference || undefined, notes: notes || undefined })
      toast.success(`Setoran ${selectedDepositRows.length} item berhasil dibuat`)
      setShowDepositModal(false)
      setSelectedForDeposit(new Set())
      await handlePreview()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal buat setoran') }
    finally { setIsMutating(false) }
  }, [selectedDepositRows, toast, handlePreview])

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-amber-600 rounded-xl"><Coins className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Cash Count</h1>
          <p className="text-xs text-gray-400">Hitung fisik kas vs system balance POS — per cabang per hari</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-40">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Dari</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="w-40">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Sampai</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="w-52">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Payment Method *</label>
            <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={0}>Pilih payment method</option>
              {paymentMethods.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
            </select>
          </div>
          <button onClick={handlePreview} disabled={isLoading || !paymentMethodId}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Tampilkan
          </button>
        </div>
      </div>

      {/* Deposit Action Bar */}
      {selectedForDeposit.size > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <Banknote className="w-4 h-4 text-purple-600" />
            <span className="text-purple-700 dark:text-purple-300 font-medium">{selectedForDeposit.size} item dipilih</span>
            <span className="text-purple-500">· Besar: {fmt(selectedDepositRows.reduce((s, r) => s + (r.large_denomination || 0), 0))}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedForDeposit(new Set())}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              Batal
            </button>
            <button onClick={() => setShowDepositModal(true)} disabled={!canDeposit}
              className="px-4 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5" /> Setor
            </button>
          </div>
        </div>
      )}

      {/* Branch Groups */}
      {branchGroups.map((group) => {
        const isCollapsed = collapsedBranches.has(group.name)
        const countedInGroup = group.items.filter((r) => r.status === 'COUNTED' && r.cash_count_id && !r.cash_deposit_id)

        return (
          <div key={group.name} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Branch Header */}
            <button onClick={() => toggleBranch(group.name)}
              className="w-full px-4 py-2.5 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{group.name}</span>
                <span className="text-xs text-gray-400">{group.counted}/{group.items.length}</span>
                {countedInGroup.length > 0 && (
                  <span className="text-xs text-purple-500 font-medium">{countedInGroup.length} siap setor</span>
                )}
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

            {!isCollapsed && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-2 py-2 w-8"></th>
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
                    const canEdit = !row.status || row.status === 'OPEN' || row.status === 'COUNTED'
                    const hasDetail = !!row.cash_count_id
                    const canSelect = row.status === 'COUNTED' && row.cash_count_id && !row.cash_deposit_id
                    const isSelected = selectedForDeposit.has(k)

                    return (
                      <tr key={k} className={`border-b border-gray-100 dark:border-gray-800 transition-colors ${
                        isSelected ? 'bg-purple-50/50 dark:bg-purple-900/10' : hasDetail ? 'hover:bg-gray-50/70 dark:hover:bg-gray-800/40' : ''
                      } ${hasDetail && !isEditing ? 'cursor-pointer' : ''}`}
                        onClick={() => !isEditing && hasDetail && handleOpenDetail(row)}>

                        {/* Checkbox for deposit */}
                        <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {canSelect ? (
                            <input type="checkbox" checked={isSelected} onChange={() => toggleDepositSelect(k)}
                              className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer" />
                          ) : row.cash_deposit_id ? (
                            <span title="Sudah disetor"><Banknote className="w-3 h-3 text-purple-400 mx-auto" /></span>
                          ) : null}
                        </td>

                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(row.transaction_date)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">{fmt(row.system_balance)}</td>

                        {/* Besar */}
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <input type="number" value={editLarge} onChange={(e) => setEditLarge(e.target.value)} min={0} autoFocus placeholder="0"
                              className="w-24 px-2 py-1 border border-amber-300 dark:border-amber-600 rounded text-xs text-right font-mono focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCount(row); if (e.key === 'Escape') setEditKey(null) }} />
                          ) : row.large_denomination != null ? (
                            <span className="font-mono text-gray-600 dark:text-gray-400">{fmt(row.large_denomination)}</span>
                          ) : null}
                        </td>

                        {/* Kecil */}
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <input type="number" value={editSmall} onChange={(e) => setEditSmall(e.target.value)} min={0} placeholder="0"
                              className="w-24 px-2 py-1 border border-amber-300 dark:border-amber-600 rounded text-xs text-right font-mono focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCount(row); if (e.key === 'Escape') setEditKey(null) }} />
                          ) : row.small_denomination != null ? (
                            <span className="font-mono text-gray-600 dark:text-gray-400">{fmt(row.small_denomination)}</span>
                          ) : null}
                        </td>

                        {/* Total */}
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                          {isEditing ? (
                            <span className="font-medium text-amber-600">{fmt(editTotal)}</span>
                          ) : row.physical_count !== null ? (
                            <span className="font-medium text-gray-900 dark:text-white">{fmt(row.physical_count)}</span>
                          ) : canEdit ? (
                            <button onClick={(e) => { e.stopPropagation(); setEditKey(k); setEditLarge(''); setEditSmall(''); setEditEmployeeId('') }}
                              className="text-xs text-amber-600 hover:text-amber-700 font-medium">Input</button>
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
                            <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
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

      {/* Detail Panel */}
      {selectedDetail && (
        <CashCountDetailPanel
          item={selectedDetail} isOpen={showDetail} onClose={() => setShowDetail(false)}
          onCount={handleCount} onCloseCount={handleClose}
          employees={employees} bankAccounts={bankAccounts} isLoading={isMutating}
        />
      )}

      {/* Deposit Modal */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onConfirm={handleCreateDeposit}
        selectedRows={selectedDepositRows}
        bankAccounts={bankAccounts}
        isLoading={isMutating}
      />
    </div>
  )
}
