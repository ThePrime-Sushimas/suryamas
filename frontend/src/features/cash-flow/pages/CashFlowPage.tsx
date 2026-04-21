import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  RefreshCw, AlertTriangle, Clock, CheckCircle2,
  ChevronRight, ChevronDown, ChevronLeft, Wallet, Filter,
  TrendingUp, TrendingDown, Settings2, Plus, Calendar, Loader2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useBankAccountsStore } from '@/features/bank-accounts/store/useBankAccounts'
import {
  useListPeriods,
  useSuggestOpeningBalance,
  useCreatePeriod,
  useUpdatePeriod,
  useDeletePeriod,
  useCashFlowDailyInfinite,
  useBranches,
} from '../api/useCashFlowApi'
import { CreatePeriodDialog, EditPeriodDialog } from '../components/PeriodBalanceForms'
import { useToast } from '@/contexts/ToastContext'
import type {
  RunningBalanceRow,
  CashFlowSummary,
  SalesGroup,
  AccountPeriodBalance,
  CreatePeriodFormData,
  UpdatePeriodFormData,
} from '../types/cash-flow.types'

// ============================================================
// Utils
// ============================================================
const fmt = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtDateInput = (d: Date | string) => {
  if (typeof d === 'string') return d.split('T')[0]
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ============================================================
// Period Navigator
// ============================================================
const PeriodNavigator = ({
  periods,
  selectedIndex,
  onSelect,
  onEdit,
  onCreate,
}: {
  periods: AccountPeriodBalance[]
  selectedIndex: number
  onSelect: (idx: number) => void
  onEdit: () => void
  onCreate: () => void
}) => {
  const current = periods[selectedIndex]
  const hasPrev = selectedIndex < periods.length - 1 // periods sorted DESC, so prev = older = higher index
  const hasNext = selectedIndex > 0

  return (
    <div className="flex items-center gap-3 mb-6 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      {/* Nav prev (older) */}
      <button
        onClick={() => hasPrev && onSelect(selectedIndex + 1)}
        disabled={!hasPrev}
        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-20 hover:bg-gray-50 transition-colors"
        title="Periode sebelumnya"
      >
        <ChevronLeft className="w-4 h-4 text-gray-600" />
      </button>

      {/* Current period info */}
      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">
            {fmtDate(current.period_start)} — {fmtDate(current.period_end)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Saldo Awal:</span>
          <span className="text-sm font-semibold text-gray-800">{fmt(current.opening_balance)}</span>
        </div>
      </div>

      {/* Nav next (newer) */}
      <button
        onClick={() => hasNext && onSelect(selectedIndex - 1)}
        disabled={!hasNext}
        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-20 hover:bg-gray-50 transition-colors"
        title="Periode berikutnya"
      >
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1.5 ml-2 border-l border-gray-100 pl-3">
        <button
          onClick={onEdit}
          className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
        >
          Edit
        </button>
        <button
          onClick={onCreate}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 whitespace-nowrap"
        >
          <Plus className="w-3 h-3" /> Baru
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Summary Cards
// ============================================================
const SummaryCards = ({ summary }: { summary: CashFlowSummary }) => {
  const cards = [
    { label: 'Saldo Awal', value: summary.opening_balance, color: 'text-gray-700', bg: 'bg-gray-50' },
    { label: 'Total Masuk', value: summary.total_income, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: TrendingUp },
    { label: 'Total Keluar', value: summary.total_expense, color: 'text-rose-700', bg: 'bg-rose-50', icon: TrendingDown },
    { label: 'Saldo Akhir', value: summary.closing_balance, color: 'text-blue-700', bg: 'bg-blue-50' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map((c, i) => (
        <div key={i} className={`${c.bg} rounded-xl p-4 border border-white/60`}>
          <div className="flex items-center gap-1.5 mb-1">
            {c.icon && <c.icon className={`w-3.5 h-3.5 ${c.color}`} />}
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.label}</p>
          </div>
          <p className={`text-lg font-bold ${c.color}`}>{fmt(c.value)}</p>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Sales Group Accordion
// ============================================================
const SalesGroupSection = ({ groups }: { groups: SalesGroup[] }) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const toggle = (id: string | null) => {
    const key = id || 'ungrouped'
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (groups.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Rekap Penjualan</h3>
        <span className="text-xs text-gray-400">Terrekonsiliasi</span>
      </div>

      {groups.map(group => {
        const key = group.group_id || 'ungrouped'
        const isOpen = openGroups.has(key)

        return (
          <div key={key} className="border-b border-gray-50 last:border-0">
            <button
              onClick={() => toggle(group.group_id)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.group_color }} />
              <span className="flex-1 text-sm font-semibold text-gray-800">{group.group_name}</span>
              <span className="text-xs text-gray-400 mr-2">{group.transaction_count} transaksi</span>
              <span className="text-sm font-bold text-emerald-700">{fmt(group.subtotal)}</span>
              {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 ml-2" /> : <ChevronRight className="w-4 h-4 text-gray-400 ml-2" />}
            </button>

            {isOpen && (
              <div className="px-5 pb-3 space-y-1">
                {group.items.map(item => (
                  <div key={item.payment_method_name} className="flex items-center gap-2 py-1.5 pl-6">
                    <span className="flex-1 text-sm text-gray-600">{item.payment_method_name}</span>
                    <span className="text-xs text-gray-400">{item.transaction_count} trx</span>
                    <span className="text-sm font-medium text-gray-800 w-32 text-right">{fmt(item.total_amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="px-5 py-3 bg-emerald-50 flex items-center justify-between">
        <span className="text-sm font-bold text-emerald-800">Total Penjualan</span>
        <span className="text-base font-bold text-emerald-800">
          {fmt(groups.reduce((s, g) => s + g.subtotal, 0))}
        </span>
      </div>
    </div>
  )
}

// ============================================================
// Warnings Bar
// ============================================================
const WarningsBar = ({ summary }: { summary: CashFlowSummary }) => {
  const hasWarnings = summary.pending_count > 0 || summary.unreconciled_count > 0
  if (!hasWarnings) return null

  return (
    <div className="flex flex-wrap gap-3 mb-5">
      {summary.pending_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <Clock className="w-3.5 h-3.5" />
          <span><strong>{summary.pending_count}</strong> transaksi pending — masuk: {fmt(summary.pending_income_estimate)}{summary.pending_expense_estimate > 0 ? ` · keluar: ${fmt(summary.pending_expense_estimate)}` : ''}</span>
        </div>
      )}
      {summary.unreconciled_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>
            <strong>{summary.unreconciled_count}</strong> belum direkonsiliasi
            {summary.unreconciled_credit_count > 0 && <> — <strong>{summary.unreconciled_credit_count}</strong> kredit ({fmt(summary.unreconciled_credit_amount)})</>}
            {summary.unreconciled_debit_count > 0 && <> · <strong>{summary.unreconciled_debit_count}</strong> debit ({fmt(summary.unreconciled_debit_amount)})</>}
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Running Balance Table — Grouped by Date (expandable)
// ============================================================
const RunningBalanceTable = ({ rows, isLoading }: { rows: RunningBalanceRow[]; isLoading: boolean }) => {
  const [openDates, setOpenDates] = useState<Set<string>>(new Set())

  // Group rows by transaction_date
  const dateGroups = useMemo(() => {
    const map = new Map<string, { rows: RunningBalanceRow[]; totalCredit: number; totalDebit: number; lastBalance: number }>()
    for (const row of rows) {
      const d = row.transaction_date
      if (!map.has(d)) map.set(d, { rows: [], totalCredit: 0, totalDebit: 0, lastBalance: 0 })
      const g = map.get(d)!
      g.rows.push(row)
      g.totalCredit += row.credit_amount
      g.totalDebit += row.debit_amount
      g.lastBalance = row.running_balance
    }
    return [...map.entries()]
  }, [rows])

  const toggleDate = (d: string) => {
    setOpenDates(prev => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  }

  const expandAll = () => setOpenDates(new Set(dateGroups.map(([d]) => d)))
  const collapseAll = () => setOpenDates(new Set())

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Mutasi Harian</h3>
        {dateGroups.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="text-xs text-indigo-600 hover:underline">Buka Semua</button>
            <span className="text-gray-300">|</span>
            <button onClick={collapseAll} className="text-xs text-indigo-600 hover:underline">Tutup Semua</button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}
        </div>
      ) : dateGroups.length === 0 ? (
        <div className="px-5 py-16 text-center text-gray-400 text-sm italic">Tidak ada transaksi untuk periode ini.</div>
      ) : (
        <div>
          {dateGroups.map(([date, group]) => {
            const isOpen = openDates.has(date)
            return (
              <div key={date} className="border-b border-gray-50 last:border-0">
                {/* Date header row */}
                <button
                  onClick={() => toggleDate(date)}
                  className="w-full flex items-center px-5 py-3 hover:bg-gray-50/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                    <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{fmtDate(date)}</span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{group.rows.length} trx</span>
                  </div>
                  <div className="flex-1" />
                  <span className={`text-sm font-semibold text-right w-32 shrink-0 ${group.totalCredit > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                    {group.totalCredit > 0 ? fmt(group.totalCredit) : '—'}
                  </span>
                  <span className={`text-sm font-semibold text-right w-32 shrink-0 ${group.totalDebit > 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                    {group.totalDebit > 0 ? fmt(group.totalDebit) : '—'}
                  </span>
                  <span className="text-sm font-bold text-gray-900 text-right w-36 shrink-0">
                    {fmt(group.lastBalance)}
                  </span>
                </button>

                {/* Expanded rows */}
                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <tbody className="divide-y divide-gray-50">
                        {group.rows.map(row => (
                          <tr key={row.id} className={`hover:bg-gray-50/50 transition-colors ${row.is_pending ? 'bg-amber-50/30' : ''}`}>
                            <td className="pl-12 pr-2 py-2.5 w-28" />
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                {row.group_color && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.group_color }} />}
                                <div>
                                  <p className="text-sm text-gray-800 font-medium leading-tight">{row.description}</p>
                                  {row.group_name && <p className="text-xs text-gray-400 mt-0.5">{row.group_name}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-sm font-semibold text-emerald-600 text-right whitespace-nowrap w-32">
                              {row.credit_amount > 0 ? fmt(row.credit_amount) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-sm font-semibold text-rose-500 text-right whitespace-nowrap w-32">
                              {row.debit_amount > 0 ? fmt(row.debit_amount) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-sm font-bold text-gray-900 text-right whitespace-nowrap w-36">
                              {fmt(row.running_balance)}
                            </td>
                            <td className="px-3 py-2.5 text-center w-16">
                              <div className="flex justify-center gap-1.5">
                                {row.is_pending && <span title="Pending" className="text-amber-400"><Clock className="w-3.5 h-3.5" /></span>}
                                {row.is_reconciled
                                  ? <span title="Terrekonsiliasi" className="text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" /></span>
                                  : <span title="Belum Rekonsiliasi" className="text-gray-300"><AlertTriangle className="w-3.5 h-3.5" /></span>
                                }
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}



// ============================================================
// Main Page
// ============================================================
export const CashFlowPage = () => {
  const toast = useToast()
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  const { accounts, fetchByOwner } = useBankAccountsStore()

  const [selectedBankId, setSelectedBankId] = useState<number | null>(null)
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0)
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  // Fetch accounts
  useEffect(() => {
    if (currentBranch?.company_id) fetchByOwner('company', currentBranch.company_id)
  }, [currentBranch?.company_id])

  useEffect(() => {
    if (accounts.length > 0 && !selectedBankId) setSelectedBankId(accounts[0].id)
  }, [accounts])

  // Periods (sorted DESC by period_start from backend)
  const { data: periods, refetch: refetchPeriods } = useListPeriods(selectedBankId || 0)

  // Reset period index when bank changes or periods reload
  useEffect(() => { setSelectedPeriodIndex(0) }, [selectedBankId, periods?.length])

  const selectedPeriod = periods?.[selectedPeriodIndex] || null

  // Derive dates from selected period
  const startDate = selectedPeriod ? fmtDateInput(selectedPeriod.period_start) : ''
  const endDate = selectedPeriod ? fmtDateInput(selectedPeriod.period_end) : ''

  // Branches
  const { data: branches } = useBranches()

  // Suggestion for new period
  const { data: suggestion } = useSuggestOpeningBalance(
    selectedBankId || 0,
    fmtDateInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1))
  )

  // Cash flow daily data (infinite scroll)
  const {
    data: cashFlowPages,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useCashFlowDailyInfinite({
    bank_account_id: selectedBankId || 0,
    date_from: startDate,
    date_to: endDate,
    branch_id: selectedBranchId || undefined,
    limit: 100,
  })

  // Merge all pages
  const cashFlow = useMemo(() => {
    if (!cashFlowPages?.pages?.length) return null
    const first = cashFlowPages.pages[0]
    const allRows = cashFlowPages.pages.flatMap(p => p.rows)
    return { ...first, rows: allRows }
  }, [cashFlowPages])

  // Infinite scroll observer
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )
  useEffect(() => {
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleObserver])

  // Mutations
  const createMutation = useCreatePeriod()
  const updateMutation = useUpdatePeriod(selectedPeriod?.id || '')
  const deleteMutation = useDeletePeriod(selectedPeriod?.id || '', selectedBankId || 0)

  const handleCreatePeriod = async (data: CreatePeriodFormData) => {
    try {
      await createMutation.mutateAsync(data)
      toast.success('Periode berhasil dibuat')
      setIsCreateOpen(false)
      await refetchPeriods()
      setSelectedPeriodIndex(0) // newest period
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Gagal membuat periode')
    }
  }

  const handleUpdatePeriod = async (data: UpdatePeriodFormData) => {
    try {
      await updateMutation.mutateAsync({ ...data, bank_account_id: selectedBankId || 0 })
      toast.success('Periode berhasil diperbarui')
      setIsEditOpen(false)
      await refetchPeriods()
      refetch()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Gagal memperbarui periode')
    }
  }

  const handleDeletePeriod = async () => {
    try {
      await deleteMutation.mutateAsync()
      toast.success('Periode berhasil dihapus')
      setIsEditOpen(false)
      await refetchPeriods()
      setSelectedPeriodIndex(0)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Gagal menghapus periode')
    }
  }

  const noPeriods = periods && periods.length === 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cash Flow</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pergerakan kas harian per rekening bank</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/cash-flow/settings" className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Settings2 className="w-4 h-4" /> Konfigurasi
          </Link>
          <button onClick={() => refetch()} disabled={isFetching} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Bank account tabs ── */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {accounts.map(acc => (
          <button
            key={acc.id}
            onClick={() => { setSelectedBankId(acc.id) }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedBankId === acc.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>{acc.bank_name}</span>
            <span className={`text-xs ${selectedBankId === acc.id ? 'text-indigo-200' : 'text-gray-400'}`}>{acc.account_number}</span>
          </button>
        ))}
      </div>

      {!selectedBankId ? (
        <div className="text-center py-20 text-gray-400">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Pilih rekening bank di atas</p>
        </div>
      ) : noPeriods ? (
        /* ── No period ── */
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Belum ada periode untuk rekening ini</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Buat periode dengan saldo awal terlebih dahulu untuk mulai tracking cash flow.
          </p>
          <button onClick={() => setIsCreateOpen(true)} className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Buat Periode
          </button>
        </div>
      ) : selectedPeriod ? (
        <>
          {/* ── Period navigator ── */}
          <PeriodNavigator
            periods={periods!}
            selectedIndex={selectedPeriodIndex}
            onSelect={(idx) => { setSelectedPeriodIndex(idx) }}
            onEdit={() => setIsEditOpen(true)}
            onCreate={() => setIsCreateOpen(true)}
          />

          {/* ── Branch filter ── */}
          {branches && branches.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={selectedBranchId}
                  onChange={e => { setSelectedBranchId(e.target.value) }}
                  className="text-sm text-gray-700 outline-none bg-transparent"
                >
                  <option value="">Semua Cabang</option>
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ── Summary cards ── */}
          {cashFlow?.summary && <SummaryCards summary={cashFlow.summary} />}

          {/* ── Warnings ── */}
          {cashFlow?.summary && <WarningsBar summary={cashFlow.summary} />}

          {/* ── Sales groups accordion ── */}
          {cashFlow?.summary?.income_by_group && (
            <SalesGroupSection groups={cashFlow.summary.income_by_group} />
          )}

          {/* ── Running balance table ── */}
          <RunningBalanceTable rows={cashFlow?.rows || []} isLoading={isLoading} />

          {/* ── Infinite scroll sentinel ── */}
          <div ref={loadMoreRef} className="py-4 flex justify-center">
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat lebih banyak...
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* ── Dialogs ── */}
      <CreatePeriodDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreatePeriod}
        isLoading={createMutation.isPending}
        bankAccountId={selectedBankId || 0}
        suggestion={suggestion}
      />
      <EditPeriodDialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleUpdatePeriod}
        onDelete={handleDeletePeriod}
        isLoading={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        period={selectedPeriod}
      />
    </div>
  )
}
