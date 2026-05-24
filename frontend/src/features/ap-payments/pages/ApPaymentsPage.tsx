import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useListNavigation } from '@/lib/urlFilters'
import { Wallet, Search, X, LayoutDashboard, Download, Loader2, Filter, ShieldCheck, Send } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useSuppliers } from '@/features/suppliers/api/suppliers.api'
import { useBranches } from '@/features/branches/api/branches.api'
import {
  AP_LIST_TABS,
  AP_PAYMENTS_LIST_PATH,
  AP_DASHBOARD_PATH,
  AP_PAYMENT_METHOD_LABELS,
  AP_STATUS_CONFIG,
  AP_JOURNAL_STATUS_LABELS,
} from '../constants'
import { isApListTabActive, isDateRangeInvalid } from '../utils/apPaymentFilters.url'
import { useApPayments, useDeleteApPayment, usePostApPaymentJournal, type ApPayment } from '../api/apPayments.api'
import { useApPaymentFilters } from '../hooks/useApPaymentFilters'
import { ApPaymentsShell } from '../components/ApPaymentsShell'
import { BulkBadge } from '../components/BulkBadge'
import { OutstandingInvoicesTab } from '../components/OutstandingInvoicesTab'
import { VerifyScreenshotModal } from '../components/VerifyScreenshotModal'
import { apTheme } from '../ap-payments.theme'
import { exportApPaymentsExcel } from '../utils/apPaymentsExport'
import type { ApPaymentStatus } from '../api/apPayments.api'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v)

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

export default function ApPaymentsPage() {
  const { openDetail } = useListNavigation(AP_PAYMENTS_LIST_PATH)
  const toast = useToast()
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canInsert = hasPermission('ap_payments', 'insert')
  const canDelete = hasPermission('ap_payments', 'delete')
  const canUpdate = hasPermission('ap_payments', 'update')

  const {
    filters,
    draft,
    setDraft,
    isDirty,
    applyFilters,
    setTab,
    resetFilters,
    apiQuery,
    setPage,
    setLimit,
  } = useApPaymentFilters()

  const [deleteTarget, setDeleteTarget] = useState<ApPayment | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [showVerify, setShowVerify] = useState(false)

  const { data: suppliersData } = useSuppliers({ limit: 100, is_active: true })
  const { data: branchesData } = useBranches({ limit: 100 })
  const { data, isLoading } = useApPayments(apiQuery)
  const deletePayment = useDeleteApPayment()
  const postJournal = usePostApPaymentJournal()

  const isPaidTab = filters.tab === 'paid'

  const payments = data?.data ?? []
  const pagination = data?.pagination

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportApPaymentsExcel(apiQuery)
    } catch (err: unknown) {
      const message = err instanceof Error && err.message === 'NO_DATA'
        ? 'Tidak ada data untuk diekspor'
        : parseApiError(err, 'Gagal mengekspor data')
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
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
    <ApPaymentsShell fullHeight className="flex flex-col">
      {/* Header */}
      <div className={`${apTheme.header} px-4 sm:px-6 py-4`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={apTheme.headerIcon}>
              <Wallet className="w-6 h-6 shrink-0" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-lg sm:text-xl font-bold truncate ${apTheme.title}`}>AP Payments</h1>
              <p className={`text-xs sm:text-sm ${apTheme.subtitle}`}>Pembayaran hutang dagang · {pagination?.total ?? 0} dokumen</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link to={AP_DASHBOARD_PATH} className={apTheme.btnSecondary}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
            <button type="button" onClick={handleExport} disabled={isExporting || isDirty || (!isLoading && payments.length === 0)} className={apTheme.btnSecondary} title={isDirty ? 'Terapkan filter dulu' : undefined}>
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? 'Mengekspor...' : 'Export'}
            </button>
            <button type="button" onClick={() => setShowVerify(true)} className={apTheme.btnSecondary}>
              <ShieldCheck className="w-4 h-4" /> Verifikasi BCA
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`${apTheme.header} px-4 sm:px-6`}>
        <div className="flex gap-1 overflow-x-auto py-2">
          {AP_LIST_TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setTab(tab.id)} className={`transition-colors ${isApListTabActive(tab.id, filters) ? apTheme.listTabActive : apTheme.listTabInactive}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className={`${apTheme.header} px-4 sm:px-6 py-3`}>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor pembayaran..."
              value={draft.search}
              onChange={(e) => setDraft({ search: e.target.value })}
              className={apTheme.inputSearch}
            />
            {draft.search && (
              <button type="button" onClick={() => setDraft({ search: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select value={draft.supplierId} onChange={(e) => setDraft({ supplierId: e.target.value })} className={apTheme.select}>
            <option value="">Semua supplier</option>
            {(suppliersData?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.supplier_name}</option>
            ))}
          </select>
          <select value={draft.branchId} onChange={(e) => setDraft({ branchId: e.target.value })} className={apTheme.select}>
            <option value="">Semua cabang</option>
            {(branchesData?.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.branch_name}</option>
            ))}
          </select>
          <select value={draft.status} onChange={(e) => setDraft({ status: (e.target.value || '') as ApPaymentStatus | '' })} className={apTheme.select}>
            <option value="">Semua status</option>
            {(Object.keys(AP_STATUS_CONFIG) as ApPaymentStatus[]).map((s) => (
              <option key={s} value={s}>{AP_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>

        {/* Date filters row */}
        <div className="flex flex-wrap gap-3 mt-2 items-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Tgl Bayar:</span>
            <input type="date" value={draft.dateFrom} onChange={(e) => setDraft({ dateFrom: e.target.value })} className={`${apTheme.select} text-xs`} />
            <span className="text-xs text-gray-400">—</span>
            <input type="date" value={draft.dateTo} onChange={(e) => setDraft({ dateTo: e.target.value })} className={`${apTheme.select} text-xs`} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Jatuh Tempo:</span>
            <input type="date" value={draft.dueDateFrom} onChange={(e) => setDraft({ dueDateFrom: e.target.value })} className={`${apTheme.select} text-xs`} />
            <span className="text-xs text-gray-400">—</span>
            <input type="date" value={draft.dueDateTo} onChange={(e) => setDraft({ dueDateTo: e.target.value })} className={`${apTheme.select} text-xs`} />
          </div>

          {/* Apply button */}
          <button type="button" onClick={applyFilters} disabled={!isDirty} className={apTheme.btnPrimary}>
            <Filter className="w-4 h-4" /> Terapkan
          </button>
          {(filters.search || filters.supplierId || filters.branchId || filters.status || filters.dateFrom || filters.dateTo || filters.dueDateFrom || filters.dueDateTo || draft.search || draft.supplierId || draft.branchId || draft.status || draft.dateFrom || draft.dateTo || draft.dueDateFrom || draft.dueDateTo) && (
            <button type="button" onClick={resetFilters} className="text-xs text-rose-600 dark:text-gray-400 hover:underline">
              Reset filter
            </button>
          )}
        </div>

        {/* Validation */}
        {isDateRangeInvalid(draft.dateFrom, draft.dateTo) && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Tanggal bayar awal harus sebelum tanggal akhir</p>
        )}
        {isDateRangeInvalid(draft.dueDateFrom, draft.dueDateTo) && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Jatuh tempo awal harus sebelum tanggal akhir</p>
        )}
      </div>

      {/* Content */}
      {filters.tab === 'outstanding' ? (
        <OutstandingInvoicesTab filters={filters} />
      ) : (
      <>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (<div key={i} className={apTheme.skeleton} />))}
          </div>
        ) : payments.length === 0 ? (
          <div className={`text-center py-16 ${apTheme.card} p-8`}>
            <Wallet className="mx-auto w-12 h-12 text-rose-200 dark:text-gray-600 mb-4" />
            <p className={apTheme.muted}>Belum ada pembayaran AP</p>
            {canInsert && (
              <button type="button" onClick={() => setTab('outstanding')} className={`inline-block mt-4 text-sm font-medium ${apTheme.link}`}>
                Buat pembayaran pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rose-200/80 dark:border-gray-700">
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">No. Pembayaran</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Tgl Dibuat</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Tgl Bayar</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Supplier</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Cabang</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Metode / Rek. Sumber</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Rek. Tujuan</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Total</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                  {isPaidTab && canUpdate && (
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Journal</th>
                  )}
                  {canDelete && <th className="px-3 py-3 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100 dark:divide-gray-700">
                {payments.map((p) => {
                  const st = AP_STATUS_CONFIG[p.status]
                  return (
                    <tr key={p.id} onClick={() => openDetail(`${AP_PAYMENTS_LIST_PATH}/${p.id}`)} className={`${apTheme.hoverRow} cursor-pointer`}>
                      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{p.payment_number}</span>
                          {p.bulk_payment_batch_id && <BulkBadge batchId={p.bulk_payment_batch_id} />}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(p.paid_at)}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{p.supplier_name}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{p.branch_name}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        <div>
                          <span>{AP_PAYMENT_METHOD_LABELS[p.payment_method]}</span>
                          {p.payment_method !== 'CASH' && p.bank_account_name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {[p.bank_name, p.bank_account_number, p.bank_account_name].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {p.supplier_bank_name || p.supplier_bank_account_number || p.supplier_bank_account_name ? (
                          <div>
                            {p.supplier_bank_name && (
                              <p className="font-medium text-gray-800 dark:text-gray-200">{p.supplier_bank_name}</p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {[p.supplier_bank_account_number, p.supplier_bank_account_name].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{fmtCurrency(Number(p.total_amount))}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      {isPaidTab && canUpdate && (
                        <td className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {p.journal_id ? (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {p.journal_number ?? '—'}
                                {p.journal_status && (
                                  <span className="ml-1.5 text-[10px] uppercase tracking-wide">
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                                >
                                  <Send className="w-3 h-3" />
                                  Post Journal
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      )}
                      {canDelete && (
                        <td className="px-3 py-3">
                          {p.status === 'DRAFT' && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p) }} className="text-xs text-red-600 hover:underline whitespace-nowrap">Hapus</button>
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

      {pagination && pagination.total > 0 && (
        <div className={`border-t ${apTheme.divideBorder} bg-white/85 dark:bg-gray-800 backdrop-blur-md px-4 py-3`}>
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={setLimit} currentLength={payments.length} loading={isLoading} />
        </div>
      )}
      </>
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Hapus pembayaran?" message={`Draft ${deleteTarget?.payment_number} akan dihapus.`} confirmText="Hapus" variant="danger" isLoading={deletePayment.isPending} />
      {showVerify && <VerifyScreenshotModal onClose={() => setShowVerify(false)} />}
    </ApPaymentsShell>
  )
}
