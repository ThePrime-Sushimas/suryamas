import { useState, useCallback, useEffect, useMemo } from 'react'
import { Coins, Search, RefreshCw, Loader2, AlertTriangle, Check, X, ChevronDown, ChevronUp, Building, Banknote, Trash2, Upload, RotateCcw } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { cashCountsApi, type CashCountPreviewRow } from '../api/cashCounts.api'
import { CashCountStatusBadge } from '../components/CashCountStatusBadge'
import { CashCountDetailPanel } from '../components/CashCountDetailPanel'
import { DepositModal } from '../components/DepositModal'
import { ConfirmDepositModal } from '../components/ConfirmDepositModal'
import type { CashCount, CashCountStatus, UpdatePhysicalCountDto, CashDeposit } from '../types'
import { useCashCountsStore } from '../store/cashCounts.store'
import api from '@/lib/axios'

const fmt = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

function CapitalReportTab() {
  const {
    reportStartDate: startDate, setReportStartDate: setStartDate,
    reportEndDate: endDate, setReportEndDate: setEndDate,
  } = useCashCountsStore()
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const data = await cashCountsApi.getCapitalReport(startDate, endDate)
      setReport(data)
    } catch { setReport(null) }
    finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { fetchReport() }, [fetchReport])

  // Flatten all deposits for single table view
  const allDeposits = useMemo(() => {
    if (!report) return []
    return report.by_branch.flatMap((b: any) =>
      b.deposits.map((d: any) => ({ ...d, branch_name: b.branch_name }))
    ).sort((a: any, b: any) => b.deposit_date.localeCompare(a.deposit_date))
  }, [report])

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white min-w-0" />
        <span className="text-gray-400">—</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white min-w-0" />
        <button onClick={fetchReport} disabled={loading}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Muat
        </button>
      </div>

      {report && (
        <>
          {/* Table */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-2.5 text-left">Cabang</th>
                  <th className="px-4 py-2.5 text-left">Tgl Deposit</th>
                  <th className="px-4 py-2.5 text-left">Tgl Setor</th>
                  <th className="px-4 py-2.5 text-right">Total Setor</th>
                  <th className="px-4 py-2.5 text-right">Pecahan Besar</th>
                  <th className="px-4 py-2.5 text-right">Tambahan Modal</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {allDeposits.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">Tidak ada data tambahan modal untuk periode ini</td></tr>
                ) : allDeposits.map((dep: any) => (
                  <tr key={dep.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium truncate max-w-[180px]" title={dep.branch_name}>{dep.branch_name}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{fmtDate(dep.deposit_date)}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{dep.deposited_at ? fmtDate(dep.deposited_at) : '-'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-900 dark:text-white">{fmt(Number(dep.deposit_amount))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400">{fmt(Number(dep.large_amount || 0))}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-orange-600 dark:text-orange-400">{fmt(Number(dep.owner_top_up))}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        dep.status === 'RECONCILED' ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
                        : dep.status === 'DEPOSITED' ? 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
                        : 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          dep.status === 'RECONCILED' ? 'bg-green-500' : dep.status === 'DEPOSITED' ? 'bg-blue-500' : 'bg-amber-500'
                        }`} />
                        {dep.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {allDeposits.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 font-semibold text-sm">
                    <td colSpan={3} className="px-4 py-2.5 text-gray-500">Total</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-900 dark:text-white">{fmt(allDeposits.reduce((s: number, d: any) => s + Number(d.deposit_amount), 0))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-gray-400">{fmt(allDeposits.reduce((s: number, d: any) => s + Number(d.large_amount || 0), 0))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-orange-600 dark:text-orange-400">{fmt(report.grand_total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function CashCountsManagementPage() {
  const toast = useToast()
  const {
    activeTab, setActiveTab,
    startDate, setStartDate,
    endDate, setEndDate,
    paymentMethodId, setPaymentMethodId,
    depositsPage, setDepositsPage,
  } = useCashCountsStore()

  // ========== TAB: CASH COUNTS ==========
  const [rows, setRows] = useState<CashCountPreviewRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set())

  const [selectedDetail, setSelectedDetail] = useState<CashCount | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedForDeposit, setSelectedForDeposit] = useState<Set<string>>(new Set())
  const [showDepositModal, setShowDepositModal] = useState(false)

  // ========== TAB: DEPOSITS ==========
  const [deposits, setDeposits] = useState<CashDeposit[]>([])
  const [depositsLoading, setDepositsLoading] = useState(false)
  const [depositsTotal, setDepositsTotal] = useState(0)
  const depositsLimit = 20

  const [expandedDepositId, setExpandedDepositId] = useState<string | null>(null)
  const [expandedDepositDetail, setExpandedDepositDetail] = useState<CashDeposit | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CashDeposit | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<CashDeposit | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [revertTarget, setRevertTarget] = useState<CashDeposit | null>(null)

  // ========== Reference Data ==========
  const [paymentMethods, setPaymentMethods] = useState<{ id: number; name: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [bankAccounts, setBankAccounts] = useState<{ id: number; account_name: string; account_number: string; bank_name: string; bank_code: string }[]>([])

  // ========== Inline Edit ==========
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editLarge, setEditLarge] = useState('')
  const [editSmall, setEditSmall] = useState('')
  const [editEmployeeId, setEditEmployeeId] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)

  useEffect(() => {
    api.get('/payment-methods/options').then((r) => {
      const list = (r.data.data || []).map((pm: any) => ({ id: pm.id, name: pm.name }))
      setPaymentMethods(list)
      const cash = list.find((pm: any) => pm.name.toLowerCase().includes('cash'))
      if (cash && !paymentMethodId) setPaymentMethodId(cash.id)
    }).catch(() => {})
    api.get('/employees', { params: { limit: 500 } }).then((r) => setEmployees(r.data.data || [])).catch(() => {})
    api.get('/bank-accounts').then((r) => setBankAccounts(
      (r.data.data || []).map((a: any) => ({ id: a.id, account_name: a.account_name, account_number: a.account_number || '', bank_name: a.bank_name || '', bank_code: a.bank_code || '' }))
    )).catch(() => {})
  }, [])

  // ========== CASH COUNTS LOGIC ==========
  const handlePreview = useCallback(async () => {
    if (!startDate || !endDate || !paymentMethodId) return
    setIsLoading(true)
    try {
      setRows(await cashCountsApi.preview(startDate, endDate, paymentMethodId))
      setCollapsedBranches(new Set())
      setSelectedForDeposit(new Set())
    }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat data') }
    finally { setIsLoading(false) }
  }, [startDate, endDate, paymentMethodId, toast])

  const rk = (r: CashCountPreviewRow) => `${r.branch_name}|${r.transaction_date}`

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees
    const q = employeeSearch.toLowerCase()
    return employees.filter(e => e.full_name.toLowerCase().includes(q))
  }, [employees, employeeSearch])

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
    if (diff < 0 && !editEmployeeId) { toast.error('Minus wajib mengisi nama karyawan'); return }

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

  const handleCreateDeposit = useCallback(async (depositDate: string, bankAccountId: number, reference: string, notes: string, depositAmount?: number) => {
    const ids = selectedDepositRows.map((r) => r.cash_count_id!).filter(Boolean)
    if (ids.length === 0) return
    setIsMutating(true)
    try {
      await cashCountsApi.createDeposit({ cash_count_ids: ids, deposit_date: depositDate, bank_account_id: bankAccountId, deposit_amount: depositAmount, reference: reference || undefined, notes: notes || undefined })
      toast.success(`Setoran ${selectedDepositRows.length} item berhasil dibuat`)
      setShowDepositModal(false)
      setSelectedForDeposit(new Set())
      await handlePreview()
      setActiveTab('deposits')
      await fetchDeposits()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal buat setoran') }
    finally { setIsMutating(false) }
  }, [selectedDepositRows, toast, handlePreview])

  // ========== DEPOSITS LOGIC ==========
  const fetchDeposits = useCallback(async () => {
    setDepositsLoading(true)
    try {
      const res = await cashCountsApi.listDeposits(depositsPage, depositsLimit)
      setDeposits(res.data)
      setDepositsTotal(res.pagination?.total || 0)
    } catch (e) {
      toast.error('Gagal memuat data setoran')
    } finally {
      setDepositsLoading(false)
    }
  }, [depositsPage, toast])

  useEffect(() => { fetchDeposits() }, [fetchDeposits])

  const handleExpandDeposit = useCallback(async (dep: CashDeposit) => {
    if (expandedDepositId === dep.id) {
      setExpandedDepositId(null)
      setExpandedDepositDetail(null)
      return
    }
    try {
      const detail = await cashCountsApi.getDeposit(dep.id)
      setExpandedDepositDetail(detail)
      setExpandedDepositId(dep.id)
    } catch {
      toast.error('Gagal memuat detail')
    }
  }, [expandedDepositId, toast])

  const handleDeleteDeposit = useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await cashCountsApi.deleteDeposit(deleteTarget.id)
      toast.success('Setoran berhasil dihapus')
      setDeleteTarget(null)
      fetchDeposits()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal hapus setoran')
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, toast, fetchDeposits])

  const handleConfirmDeposit = useCallback(async () => {
    toast.success('Setoran berhasil dikonfirmasi')
    setConfirmTarget(null)
    fetchDeposits()
  }, [toast, fetchDeposits])

  const totalDepositsPages = Math.ceil(depositsTotal / depositsLimit)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-amber-600 rounded-xl"><Coins className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Cash Count Management</h1>
          <p className="text-xs text-gray-400">Kelola hitung fisik kas dan setoran ke bank</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('counts')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'counts'
              ? 'text-amber-600 border-amber-600'
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Cash Counts
          </div>
        </button>
        <button
          onClick={() => setActiveTab('deposits')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'deposits'
              ? 'text-purple-600 border-purple-600'
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4" />
            Deposits
          </div>
        </button>
        <button
          onClick={() => setActiveTab('capital_report')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'capital_report'
              ? 'text-orange-600 border-orange-600'
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Laporan Modal
          </div>
        </button>
      </div>

      {/* ========== TAB: CASH COUNTS ========== */}
      {activeTab === 'counts' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Dari</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Sampai</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Payment Method *</label>
                <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value={0}>Pilih payment method</option>
                  {paymentMethods.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                </select>
              </div>
              <button onClick={handlePreview} disabled={isLoading || !paymentMethodId}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Tampilkan
              </button>
            </div>
          </div>

          {/* Summary */}
          {branchGroups.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ringkasan</span>
                <span className="text-[10px] text-gray-400">{fmtDate(startDate)} — {fmtDate(endDate)}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {branchGroups.map((g) => (
                  <div key={g.name} className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-[10px] text-gray-500 truncate">{g.name}</p>
                    <p className="text-base font-mono font-semibold text-gray-900 dark:text-white">{fmt(g.system)}</p>
                    {g.counted > 0 && (
                      <p className={`text-xs font-mono ${g.diff > 0 ? 'text-blue-600' : g.diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Selisih: {g.diff > 0 ? '+' : ''}{fmt(g.diff)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Grand Total</span>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                    {fmt(branchGroups.reduce((s, g) => s + g.system, 0))}
                  </span>
                  {branchGroups.some((g) => g.counted > 0) && (() => {
                    const totalDiff = branchGroups.reduce((s, g) => s + g.diff, 0)
                    return (
                      <span className={`text-sm font-mono font-medium ${totalDiff > 0 ? 'text-blue-600' : totalDiff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Selisih: {totalDiff > 0 ? '+' : ''}{fmt(totalDiff)}
                      </span>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Deposit Action Bar */}
          {selectedForDeposit.size > 0 && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <Banknote className="w-4 h-4 text-purple-600 hidden sm:block" />
                <span className="text-purple-700 dark:text-purple-300 font-medium">{selectedForDeposit.size} item dipilih</span>
                <span className="text-purple-500">Besar: {fmt(selectedDepositRows.reduce((s, r) => s + (r.large_denomination || 0), 0))}</span>
                {selectedDepositRows.some(r => r.small_denomination) && (
                  <span className="text-orange-500">Top Up: {fmt(selectedDepositRows.reduce((s, r) => s + (r.small_denomination || 0), 0))}</span>
                )}
                <span className="text-purple-700 dark:text-purple-300 font-semibold">
                  Total: {fmt(selectedDepositRows.reduce((s, r) => s + (r.large_denomination || 0) + (r.small_denomination || 0), 0))}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
                  className="w-full px-3 sm:px-4 py-2.5 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{group.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{group.counted}/{group.items.length}</span>
                    {countedInGroup.length > 0 && (
                      <>
                        <span className="text-xs text-purple-500 font-medium">{countedInGroup.length} siap setor</span>
                        <span onClick={(e) => {
                          e.stopPropagation()
                          const selectableKeys = countedInGroup.map((r) => rk(r))
                          const allSelected = selectableKeys.every((k) => selectedForDeposit.has(k))
                          setSelectedForDeposit((prev) => {
                            const next = new Set(prev)
                            selectableKeys.forEach((k) => allSelected ? next.delete(k) : next.add(k))
                            return next
                          })
                        }}>
                          <input type="checkbox" readOnly
                            checked={countedInGroup.length > 0 && countedInGroup.every((r) => selectedForDeposit.has(rk(r)))}
                            className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer" />
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-gray-500">{fmt(group.system)}</span>
                    {group.counted > 0 && (
                      <span className={`text-sm font-mono font-medium ${group.diff > 0 ? 'text-blue-600' : group.diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {group.diff > 0 ? '+' : ''}{fmt(group.diff)}
                      </span>
                    )}
                    {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronUp className="w-3.5 h-3.5 text-gray-400" />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
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
                        <th className="px-3 py-2 text-left font-semibold">Nama Staff</th>
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
                            isSelected ? 'bg-purple-50/50 dark:bg-purple-900/10' : 'hover:bg-gray-50/70 dark:hover:bg-gray-800/40'
                          } ${!isEditing ? 'cursor-pointer' : ''}`}
                            onClick={() => {
                              if (isEditing) return
                              if (hasDetail) { handleOpenDetail(row); return }
                              if (canEdit) { setEditKey(k); setEditLarge(''); setEditSmall(''); setEditEmployeeId('') }
                            }}>

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

                            <td className="px-3 py-2 text-right" onClick={(e) => { if (isEditing) e.stopPropagation() }}>
                              {isEditing ? (
                                <input type="number" value={editLarge} onChange={(e) => setEditLarge(e.target.value)} min={0} autoFocus placeholder="0"
                                  className="w-28 px-2 py-1 border border-amber-300 dark:border-amber-600 rounded text-sm text-right font-mono focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCount(row); if (e.key === 'Escape') setEditKey(null) }} />
                              ) : row.large_denomination != null ? (
                                <span className="font-mono text-gray-600 dark:text-gray-400">{fmt(row.large_denomination)}</span>
                              ) : null}
                            </td>

                            <td className="px-3 py-2 text-right" onClick={(e) => { if (isEditing) e.stopPropagation() }}>
                              {isEditing ? (
                                <input type="number" value={editSmall} onChange={(e) => setEditSmall(e.target.value)} min={0} placeholder="0"
                                  className="w-28 px-2 py-1 border border-amber-300 dark:border-amber-600 rounded text-sm text-right font-mono focus:ring-1 focus:ring-amber-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCount(row); if (e.key === 'Escape') setEditKey(null) }} />
                              ) : row.small_denomination != null ? (
                                <span className="font-mono text-gray-600 dark:text-gray-400">{fmt(row.small_denomination)}</span>
                              ) : null}
                            </td>

                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                              {isEditing ? (
                                <span className="font-medium text-amber-600">{fmt(editTotal)}</span>
                              ) : row.physical_count !== null ? (
                                <span className="font-medium text-gray-900 dark:text-white">{fmt(row.physical_count)}</span>
                              ) : canEdit ? (
                                <button onClick={(e) => { e.stopPropagation(); setEditKey(k); setEditLarge(''); setEditSmall(''); setEditEmployeeId('') }}
                                  className="text-sm text-amber-600 hover:text-amber-700 font-medium">Input</button>
                              ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                            </td>

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

                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              {isEditing && editTotal < row.system_balance ? (
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={editEmployeeId ? (employees.find(e => e.id === editEmployeeId)?.full_name || employeeSearch) : employeeSearch}
                                    onChange={(e) => { setEmployeeSearch(e.target.value); setEditEmployeeId(''); setShowEmployeeDropdown(true) }}
                                    onFocus={() => setShowEmployeeDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowEmployeeDropdown(false), 200)}
                                    placeholder="Cari staff..."
                                    className="w-full px-2 py-1 border border-red-300 dark:border-red-600 rounded text-xs bg-white dark:bg-gray-700 dark:text-white focus:ring-1 focus:ring-red-500 outline-none"
                                  />
                                  {showEmployeeDropdown && filteredEmployees.length > 0 && (
                                    <div className="absolute z-50 mt-1 w-48 max-h-40 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                                      {filteredEmployees.slice(0, 20).map(emp => (
                                        <button key={emp.id} type="button"
                                          onMouseDown={(e) => { e.preventDefault(); setEditEmployeeId(emp.id); setEmployeeSearch(''); setShowEmployeeDropdown(false) }}
                                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                                            editEmployeeId === emp.id ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                                          }`}>
                                          {emp.full_name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : row.responsible_employee_id ? (
                                <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {employees.find((e) => e.id === row.responsible_employee_id)?.full_name || '-'}
                                </span>
                              ) : null}
                            </td>

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
                  </div>
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
        </div>
      )}

      {/* ========== TAB: DEPOSITS ========== */}
      {activeTab === 'deposits' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {depositsTotal > 0 && <span>Total {depositsTotal} setoran</span>}
            </div>
            <button onClick={fetchDeposits} disabled={depositsLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <RefreshCw className={`w-3.5 h-3.5 ${depositsLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    <th className="px-3 py-2.5 text-left font-semibold">Tanggal Setor</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Cabang</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Periode</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Jumlah</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Bank</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Referensi</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Items</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                    <th className="px-3 py-2.5 text-center font-semibold w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {depositsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-3 py-2.5"><div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} /></td>
                      ))}</tr>
                    ))
                  ) : deposits.length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-12 text-center text-gray-400 text-sm">Belum ada setoran</td></tr>
                  ) : (
                    deposits.map((dep) => {
                      const isExpanded = expandedDepositId === dep.id
                      const fmtDateFull = fmtDate
                      return (
                        <tr key={dep.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td colSpan={9} className="p-0">
                            <div className="grid grid-cols-[minmax(80px,1fr)_minmax(80px,1fr)_minmax(100px,1fr)_auto_minmax(80px,1fr)_minmax(70px,1fr)_auto_auto_auto] items-center cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                              onClick={() => handleExpandDeposit(dep)}>
                              <div className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{fmtDateFull(dep.deposit_date)}</div>
                              <div className="px-3 py-2.5 text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{dep.branch_name || '-'}</div>
                              <div className="px-3 py-2.5 text-gray-500 text-xs">
                                {dep.period_start && dep.period_end ? `${fmtDateFull(dep.period_start)} — ${fmtDateFull(dep.period_end)}` : '-'}
                              </div>
                              <div className="px-3 py-2.5 text-right font-mono font-medium text-gray-900 dark:text-white">{fmt(dep.deposit_amount)}</div>
                              <div className="px-3 py-2.5 text-gray-500 truncate">{dep.bank_account_name || `Bank #${dep.bank_account_id}`}</div>
                              <div className="px-3 py-2.5 text-gray-500 truncate">{dep.reference || '-'}</div>
                              <div className="px-3 py-2.5 text-center text-gray-500">{dep.item_count}</div>
                              <div className="px-3 py-2.5 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  dep.status === 'RECONCILED'
                                    ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
                                    : dep.status === 'DEPOSITED'
                                    ? 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
                                    : 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${dep.status === 'RECONCILED' ? 'bg-green-500' : dep.status === 'DEPOSITED' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                                  {dep.status}
                                </span>
                              </div>
                              <div className="px-3 py-2.5 text-center flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleExpandDeposit(dep)} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                {dep.status === 'PENDING' && (
                                  <>
                                    <button onClick={() => setConfirmTarget(dep)} className="p-1 text-gray-400 hover:text-green-600 rounded" title="Konfirmasi Setoran">
                                      <Upload className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setDeleteTarget(dep)} className="p-1 text-gray-400 hover:text-red-600 rounded">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {dep.status === 'DEPOSITED' && (
                                  <button
                                    onClick={() => setRevertTarget(dep)}
                                    className="p-1 text-gray-400 hover:text-amber-600 rounded"
                                    title="Batalkan Konfirmasi"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {isExpanded && expandedDepositDetail && (
                              <div className="px-4 pb-4 bg-gray-50/50 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-800">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-3 text-xs">
                                  <div>
                                    <span className="text-sm text-gray-400 uppercase">Tanggal Setor</span>
                                    <p className="font-medium text-gray-900 dark:text-white">{fmtDateFull(expandedDepositDetail.deposit_date)}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-400 uppercase">Pecahan Besar</span>
                                    <p className="font-mono font-semibold text-gray-700 dark:text-gray-300">{fmt(expandedDepositDetail.large_amount ?? expandedDepositDetail.deposit_amount)}</p>
                                  </div>
                                  {(expandedDepositDetail.owner_top_up ?? 0) > 0 && (
                                    <div>
                                      <span className="text-sm text-gray-400 uppercase">Top Up Modal</span>
                                      <p className="font-mono font-semibold text-orange-600 dark:text-orange-400">{fmt(expandedDepositDetail.owner_top_up!)}</p>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-sm text-gray-400 uppercase">Total Setor ke Bank</span>
                                    <p className="font-mono font-semibold text-purple-700 dark:text-purple-300">{fmt(expandedDepositDetail.deposit_amount)}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-400 uppercase">Bank</span>
                                    <p className="text-gray-900 dark:text-white">{expandedDepositDetail.bank_account_name || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-400 uppercase">Bank Statement</span>
                                    <p className="text-gray-900 dark:text-white">
                                      {expandedDepositDetail.bank_statement_id ? `#${String(expandedDepositDetail.bank_statement_id).slice(0, 8)}…` : <span className="text-gray-400">Belum match</span>}
                                    </p>
                                  </div>
                                </div>

                                {expandedDepositDetail.proof_url && (
                                  <div className="mb-3">
                                    <span className="text-xs text-gray-400 uppercase">Bukti Setoran</span>
                                    <a href={expandedDepositDetail.proof_url} target="_blank" rel="noopener noreferrer"
                                      className="mt-1 block w-fit">
                                      <img src={expandedDepositDetail.proof_url} alt="Bukti setoran" className="h-24 rounded-lg border border-gray-200 dark:border-gray-700 object-cover hover:opacity-80 transition-opacity" />
                                    </a>
                                  </div>
                                )}

                                {expandedDepositDetail.notes && (
                                  <p className="text-[10px] text-gray-500 mb-3">Catatan: {expandedDepositDetail.notes}</p>
                                )}

                                {expandedDepositDetail.items && expandedDepositDetail.items.length > 0 && (
                                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead><tr className="bg-gray-100 dark:bg-gray-800 text-gray-400">
                                        <th className="px-2 py-1.5 text-left">Cabang</th>
                                        <th className="px-2 py-1.5 text-left">Tanggal</th>
                                        <th className="px-2 py-1.5 text-right">System</th>
                                        <th className="px-2 py-1.5 text-right">Besar</th>
                                        <th className="px-2 py-1.5 text-right">Kecil</th>
                                        <th className="px-2 py-1.5 text-right">Total</th>
                                        <th className="px-2 py-1.5 text-right">Selisih</th>
                                      </tr></thead>
                                      <tbody>
                                        {expandedDepositDetail.items.map((item) => (
                                          <tr key={item.id} className="border-t border-gray-100 dark:border-gray-800">
                                            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{item.branch_name || '-'}</td>
                                            <td className="px-2 py-1.5 text-gray-500">{fmtDateFull(item.start_date)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-gray-600">{fmt(item.system_balance)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-gray-600">{fmt(item.large_denomination || 0)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono text-gray-500">{fmt(item.small_denomination || 0)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono font-medium text-gray-900 dark:text-white">{fmt(item.physical_count || 0)}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">
                                              <span className={(item.difference || 0) > 0 ? 'text-blue-600' : (item.difference || 0) < 0 ? 'text-red-600' : 'text-green-600'}>
                                                {(item.difference || 0) > 0 ? '+' : ''}{fmt(item.difference || 0)}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                        <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 font-semibold">
                                          <td className="px-2 py-1.5 text-gray-500" colSpan={3}>Total</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-purple-700 dark:text-purple-300">
                                            {fmt(expandedDepositDetail.items.reduce((s, i) => s + (i.large_denomination || 0), 0))}
                                          </td>
                                          <td className="px-2 py-1.5 text-right font-mono text-gray-500">
                                            {fmt(expandedDepositDetail.items.reduce((s, i) => s + (i.small_denomination || 0), 0))}
                                          </td>
                                          <td className="px-2 py-1.5 text-right font-mono text-gray-900 dark:text-white">
                                            {fmt(expandedDepositDetail.items.reduce((s, i) => s + (i.physical_count || 0), 0))}
                                          </td>
                                          <td className="px-2 py-1.5 text-right font-mono">
                                            {(() => {
                                              const totalDiff = expandedDepositDetail.items.reduce((s, i) => s + (i.difference || 0), 0)
                                              return <span className={totalDiff > 0 ? 'text-blue-600' : totalDiff < 0 ? 'text-red-600' : 'text-green-600'}>
                                                {totalDiff > 0 ? '+' : ''}{fmt(totalDiff)}
                                              </span>
                                            })()}
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {depositsTotal > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <Pagination
                  pagination={{ page: depositsPage, limit: depositsLimit, total: depositsTotal, totalPages: totalDepositsPages, hasNext: depositsPage < totalDepositsPages, hasPrev: depositsPage > 1 }}
                  onPageChange={setDepositsPage}
                  currentLength={deposits.length}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedDetail && (
        <CashCountDetailPanel
          key={selectedDetail.id} item={selectedDetail} isOpen={showDetail} onClose={() => setShowDetail(false)}
          onCount={handleCount} onCloseCount={handleClose}
          employees={employees} bankAccounts={bankAccounts} isLoading={isMutating}
        />
      )}

      {/* ========== TAB: LAPORAN MODAL ========== */}
      {activeTab === 'capital_report' && (
        <CapitalReportTab />
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

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteDeposit}
        title="Hapus Setoran"
        message="Setoran akan dihapus dan cash count yang terkait akan kembali ke status COUNTED. Lanjutkan?"
        confirmText="Hapus"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Revert Deposit Confirm */}
      <ConfirmModal
        isOpen={!!revertTarget}
        onClose={() => setRevertTarget(null)}
        onConfirm={async () => {
          if (!revertTarget) return
          try {
            await cashCountsApi.revertDeposit(revertTarget.id)
            toast.success('Setoran berhasil dibatalkan')
            fetchDeposits()
          } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Gagal membatalkan')
          } finally {
            setRevertTarget(null)
          }
        }}
        title="Batalkan Konfirmasi Setoran"
        message="Hapus setoran ini? Cash counts akan kembali ke status COUNTED."
        confirmText="Batalkan"
        variant="warning"
      />

      {/* Confirm Deposit */}
      <ConfirmDepositModal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDeposit}
        deposit={confirmTarget}
        isLoading={isMutating}
      />
    </div>
  )
}
