import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useListNavigation } from '@/lib/urlFilters'
import { Wallet, Search, X, LayoutDashboard, ShieldCheck, Send, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useSuppliers } from '@/features/suppliers/api/suppliers.api'
import { useBranches } from '@/features/branches/api/branches.api'
import {
  AP_PAYMENTS_LIST_PATH,
  AP_DASHBOARD_PATH,
  AP_STATUS_CONFIG,
  AP_JOURNAL_STATUS_LABELS,
} from '../constants'
import { isDateRangeInvalid } from '../utils/apPaymentFilters.url'
import { useApPayments, useDeleteApPayment, usePostApPaymentJournal, type ApPayment } from '../api/apPayments.api'
import { ApPaymentsShell } from '../components/ApPaymentsShell'
import { BulkBadge } from '../components/BulkBadge'
import { OutstandingInvoicesTab } from '../components/OutstandingInvoicesTab'
import { VerifyScreenshotModal } from '../components/VerifyScreenshotModal'
import { apTheme } from '../ap-payments.theme'

const PAYMENT_TABS = [
  { id: 'draft', label: 'Draft', status: 'DRAFT' },
  { id: 'pending', label: 'Menunggu Pembayaran', status: 'APPROVED' },
  { id: 'paid', label: 'Paid', status: 'PAID' },
  { id: 'all', label: 'Semua', status: '' },
] as const

type PaymentTabId = (typeof PAYMENT_TABS)[number]['id']

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function ApPaymentsPage() {
  const { openDetail } = useListNavigation(AP_PAYMENTS_LIST_PATH)
  const toast = useToast()
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canDelete = hasPermission('ap_payments', 'delete')
  const canUpdate = hasPermission('ap_payments', 'update')

  // ── Global filters (shared between panels) ──
  const [globalSearch, setGlobalSearch] = useState('')
  const [globalSupplierId, setGlobalSupplierId] = useState('')
  const [globalBranchId, setGlobalBranchId] = useState('')

  // ── Left panel (Outstanding) filters ──
  const [outReceivedFrom, setOutReceivedFrom] = useState('')
  const [outReceivedTo, setOutReceivedTo] = useState('')
  const [outDueFrom, setOutDueFrom] = useState('')
  const [outDueTo, setOutDueTo] = useState('')

  // ── Right panel (Payments) filters ──
  const [payTab, setPayTab] = useState<PaymentTabId>('all')
  const [payDateFrom, setPayDateFrom] = useState('')
  const [payDateTo, setPayDateTo] = useState('')
  const [payDueFrom, setPayDueFrom] = useState('')
  const [payDueTo, setPayDueTo] = useState('')
  const [payPage, setPayPage] = useState(1)
  const [payLimit, setPayLimit] = useState(20)

  const [deleteTarget, setDeleteTarget] = useState<ApPayment | null>(null)
  const [showVerify, setShowVerify] = useState(false)

  const { data: suppliersData } = useSuppliers({ limit: 100, is_active: true })
  const { data: branchesData } = useBranches({ limit: 100 })

  // ── Right panel query ──
  const payStatus = PAYMENT_TABS.find((t) => t.id === payTab)?.status ?? ''
  const { data: payData, isLoading: payLoading } = useApPayments({
    page: payPage,
    limit: payLimit,
    ...(globalSearch ? { search: globalSearch } : {}),
    ...(globalSupplierId ? { supplier_id: globalSupplierId } : {}),
    ...(globalBranchId ? { branch_id: globalBranchId } : {}),
    ...(payStatus ? { status: payStatus } : {}),
    ...(payDateFrom ? { date_from: payDateFrom } : {}),
    ...(payDateTo ? { date_to: payDateTo } : {}),
    ...(payDueFrom ? { due_date_from: payDueFrom } : {}),
    ...(payDueTo ? { due_date_to: payDueTo } : {}),
  })
  const deletePayment = useDeleteApPayment()
  const postJournal = usePostApPaymentJournal()

  const payments = payData?.data ?? []
  const payPagination = payData?.pagination
  const isPaidTab = payTab === 'paid'

  // ── Outstanding filters object (passed to OutstandingInvoicesTab) ──
  const outstandingFilters = {
    supplierId: globalSupplierId,
    branchId: globalBranchId,
    search: globalSearch,
    dateFrom: outReceivedFrom,
    dateTo: outReceivedTo,
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePayment.mutateAsync(deleteTarget.id)
      toast.success('Pembayaran dihapus')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menghapus'))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <ApPaymentsShell className="flex flex-col h-full">
      {/* Header */}
      <div className={`${apTheme.header} px-4 sm:px-6 py-4`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={apTheme.headerIcon}>
              <Wallet className="w-6 h-6 shrink-0" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-lg sm:text-xl font-bold truncate ${apTheme.title}`}>AP Payments</h1>
              <p className={`text-xs sm:text-sm ${apTheme.subtitle}`}>Pembayaran hutang dagang</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link to={AP_DASHBOARD_PATH} className={apTheme.btnSecondary}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
            <Link to="/finance/ap-payments/report" className={apTheme.btnSecondary}>
              <FileSpreadsheet className="w-4 h-4" /> Report
            </Link>
            <button type="button" onClick={() => setShowVerify(true)} className={apTheme.btnSecondary}>
              <ShieldCheck className="w-4 h-4" /> Verifikasi BCA
            </button>
          </div>
        </div>
      </div>

      {/* Global Filters */}
      <div className={`${apTheme.header} px-4 sm:px-6 py-3`}>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari invoice / pembayaran..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className={apTheme.inputSearch}
            />
            {globalSearch && (
              <button type="button" onClick={() => setGlobalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select value={globalSupplierId} onChange={(e) => setGlobalSupplierId(e.target.value)} className={apTheme.select}>
            <option value="">Semua supplier</option>
            {(suppliersData?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.supplier_name}</option>
            ))}
          </select>
          <select value={globalBranchId} onChange={(e) => setGlobalBranchId(e.target.value)} className={apTheme.select}>
            <option value="">Semua cabang</option>
            {(branchesData?.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.branch_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Split Panels */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 h-full">

          {/* ═══ LEFT PANEL: Invoice Outstanding ═══ */}
          <div className={`${apTheme.card} flex flex-col min-h-[500px] overflow-hidden lg:col-span-3`}>
            <div className="px-4 py-3 border-b border-rose-200/80 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Invoice Outstanding</h2>
              {/* Panel-specific date filters */}
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Tgl Terima:</span>
                  <input type="date" value={outReceivedFrom} onChange={(e) => setOutReceivedFrom(e.target.value)} className={`${apTheme.select} text-xs !py-1`} />
                  <span className="text-xs text-gray-400">—</span>
                  <input type="date" value={outReceivedTo} onChange={(e) => setOutReceivedTo(e.target.value)} className={`${apTheme.select} text-xs !py-1`} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Jatuh Tempo:</span>
                  <input type="date" value={outDueFrom} onChange={(e) => setOutDueFrom(e.target.value)} className={`${apTheme.select} text-xs !py-1`} />
                  <span className="text-xs text-gray-400">—</span>
                  <input type="date" value={outDueTo} onChange={(e) => setOutDueTo(e.target.value)} className={`${apTheme.select} text-xs !py-1`} />
                </div>
              </div>
              {isDateRangeInvalid(outReceivedFrom, outReceivedTo) && (
                <p className="mt-1 text-xs text-red-600">Tanggal terima awal harus sebelum akhir</p>
              )}
              {isDateRangeInvalid(outDueFrom, outDueTo) && (
                <p className="mt-1 text-xs text-red-600">Jatuh tempo awal harus sebelum akhir</p>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              <OutstandingInvoicesTab filters={outstandingFilters} />
            </div>
          </div>

          {/* ═══ RIGHT PANEL: Pembayaran ═══ */}
          <div className={`${apTheme.card} flex flex-col min-h-[500px] overflow-hidden lg:col-span-4`}>
            <div className="px-4 py-3 border-b border-rose-200/80 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Pembayaran</h2>
              </div>
              {/* Payment sub-tabs */}
              <div className="flex gap-1 mt-2 overflow-x-auto">
                {PAYMENT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { setPayTab(tab.id); setPayPage(1) }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      payTab === tab.id ? apTheme.listTabActive : apTheme.listTabInactive
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Panel-specific date filters */}
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Tgl Bayar:</span>
                  <input type="date" value={payDateFrom} onChange={(e) => setPayDateFrom(e.target.value)} className={`${apTheme.select} text-xs !py-1`} />
                  <span className="text-xs text-gray-400">—</span>
                  <input type="date" value={payDateTo} onChange={(e) => setPayDateTo(e.target.value)} className={`${apTheme.select} text-xs !py-1`} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Jatuh Tempo:</span>
                  <input type="date" value={payDueFrom} onChange={(e) => setPayDueFrom(e.target.value)} className={`${apTheme.select} text-xs !py-1`} />
                  <span className="text-xs text-gray-400">—</span>
                  <input type="date" value={payDueTo} onChange={(e) => setPayDueTo(e.target.value)} className={`${apTheme.select} text-xs !py-1`} />
                </div>
              </div>
              {isDateRangeInvalid(payDateFrom, payDateTo) && (
                <p className="mt-1 text-xs text-red-600">Tanggal bayar awal harus sebelum akhir</p>
              )}
              {isDateRangeInvalid(payDueFrom, payDueTo) && (
                <p className="mt-1 text-xs text-red-600">Jatuh tempo awal harus sebelum akhir</p>
              )}
            </div>

            {/* Payment table */}
            <div className="flex-1 overflow-auto">
              {payLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (<div key={i} className={apTheme.skeleton} />))}
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-12">
                  <p className={apTheme.muted}>Belum ada pembayaran</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-rose-200/80 dark:border-gray-700">
                        <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">No. Pembayaran</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Tgl Bayar</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Supplier</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Total</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                        {isPaidTab && canUpdate && (
                          <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Journal</th>
                        )}
                        {canDelete && <th className="px-2 py-2 w-8" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 dark:divide-gray-700">
                      {payments.map((p) => {
                        const st = AP_STATUS_CONFIG[p.status]
                        return (
                          <tr key={p.id} onClick={() => openDetail(`${AP_PAYMENTS_LIST_PATH}/${p.id}`)} className={`${apTheme.hoverRow} cursor-pointer`}>
                            <td className="px-2 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <span>{p.payment_number}</span>
                                {p.bulk_payment_batch_id && <BulkBadge batchId={p.bulk_payment_batch_id} />}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(p.paid_at)}</td>
                            <td className="px-2 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{p.supplier_name}</td>
                            <td className="px-2 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">{fmtCurrency(Number(p.total_amount))}</td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${st.color}`}>{st.label}</span>
                            </td>
                            {isPaidTab && canUpdate && (
                              <td className="px-2 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                {p.journal_id ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-gray-600 dark:text-gray-400">
                                      {p.journal_number ?? '—'}
                                      {p.journal_status && (
                                        <span className="ml-1 uppercase tracking-wide">
                                          ({AP_JOURNAL_STATUS_LABELS[p.journal_status] ?? p.journal_status})
                                        </span>
                                      )}
                                    </span>
                                    {p.journal_status !== 'POSTED' && (
                                      <button
                                        type="button"
                                        disabled={postJournal.isPending}
                                        onClick={async () => {
                                          try {
                                            await postJournal.mutateAsync(p.id)
                                            toast.success(`Journal ${p.payment_number} di-post`)
                                          } catch (err: unknown) {
                                            toast.error(parseApiError(err, 'Gagal post journal'))
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                                      >
                                        <Send className="w-3 h-3" /> Post
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                            )}
                            {canDelete && (
                              <td className="px-2 py-2">
                                {p.status === 'DRAFT' && (
                                  <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p) }} className="text-[10px] text-red-600 hover:underline">Hapus</button>
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment pagination */}
            {payPagination && payPagination.total > 0 && (
              <div className="border-t border-rose-200/80 dark:border-gray-700 px-3 py-2">
                <Pagination
                  pagination={payPagination}
                  onPageChange={setPayPage}
                  onLimitChange={(l) => { setPayLimit(l); setPayPage(1) }}
                  currentLength={payments.length}
                  loading={payLoading}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Hapus pembayaran?" message={`Draft ${deleteTarget?.payment_number} akan dihapus.`} confirmText="Hapus" variant="danger" isLoading={deletePayment.isPending} />
      {showVerify && <VerifyScreenshotModal onClose={() => setShowVerify(false)} />}
    </ApPaymentsShell>
  )
}
