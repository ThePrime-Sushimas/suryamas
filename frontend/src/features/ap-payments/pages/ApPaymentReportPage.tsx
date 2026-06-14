import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, Search, X, Download, Loader2, Filter, ArrowLeft, AlertCircle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Pagination } from '@/components/ui/Pagination'
import { useSuppliers } from '@/features/suppliers/api/suppliers.api'
import { useBranches } from '@/features/branches/api/branches.api'
import {
  useCombinedInvoicePayments,
  type CombinedInvoicePaymentQuery,
  type CombinedInvoicePaymentRow,
} from '../api/apPayments.api'
import { AP_PAYMENT_METHOD_LABELS, AP_STATUS_CONFIG, AP_PAYMENTS_LIST_PATH } from '../constants'
import { isDateRangeInvalid } from '../utils/apPaymentFilters.url'
import { AgingBadge } from '../components/AgingBadge'
import { ApPaymentsShell } from '../components/ApPaymentsShell'
import { apTheme } from '../ap-payments.theme'
import { exportCombinedExcel } from '../utils/apPaymentsCombinedExport'

const DEFAULT_PAGE_SIZE = 25

const fmtCurrency = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
    : '—'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

interface ReportFilters {
  search: string
  supplierId: string
  branchId: string
  receivedDateFrom: string
  receivedDateTo: string
  dueDateFrom: string
  dueDateTo: string
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: ReportFilters = {
  search: '',
  supplierId: '',
  branchId: '',
  receivedDateFrom: '',
  receivedDateTo: '',
  dueDateFrom: '',
  dueDateTo: '',
  dateFrom: '',
  dateTo: '',
}

export default function ApPaymentReportPage() {
  const toast = useToast()
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS)
  const [draft, setDraft] = useState<ReportFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [isExporting, setIsExporting] = useState(false)
  const [hasApplied, setHasApplied] = useState(false)

  const { data: suppliersData } = useSuppliers({ limit: 100, is_active: true })
  const { data: branchesData } = useBranches({ limit: 100 })

  const isDirty = JSON.stringify(draft) !== JSON.stringify(filters)

  const hasAnyDateFilter = !!(
    filters.receivedDateFrom || filters.receivedDateTo ||
    filters.dueDateFrom || filters.dueDateTo ||
    filters.dateFrom || filters.dateTo
  )

  const query: CombinedInvoicePaymentQuery = useMemo(
    () => ({
      page,
      limit,
      ...(filters.supplierId ? { supplier_id: filters.supplierId } : {}),
      ...(filters.branchId ? { branch_id: filters.branchId } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.receivedDateFrom ? { received_date_from: filters.receivedDateFrom } : {}),
      ...(filters.receivedDateTo ? { received_date_to: filters.receivedDateTo } : {}),
      ...(filters.dueDateFrom ? { due_date_from: filters.dueDateFrom } : {}),
      ...(filters.dueDateTo ? { due_date_to: filters.dueDateTo } : {}),
      ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
      ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
    }),
    [page, limit, filters],
  )

  const { data, isLoading, isError } = useCombinedInvoicePayments(query, { enabled: hasApplied })
  const rows = data?.data ?? []
  const pagination = data?.pagination

  const applyFilters = useCallback(() => {
    setFilters({ ...draft })
    setPage(1)
    setHasApplied(true)
  }, [draft])

  const resetFilters = useCallback(() => {
    setDraft(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setPage(1)
    setHasApplied(false)
  }, [])

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportCombinedExcel({
        ...(filters.supplierId ? { supplier_id: filters.supplierId } : {}),
        ...(filters.branchId ? { branch_id: filters.branchId } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.receivedDateFrom ? { received_date_from: filters.receivedDateFrom } : {}),
        ...(filters.receivedDateTo ? { received_date_to: filters.receivedDateTo } : {}),
        ...(filters.dueDateFrom ? { due_date_from: filters.dueDateFrom } : {}),
        ...(filters.dueDateTo ? { due_date_to: filters.dueDateTo } : {}),
        ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
        ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
      })
    } catch (err: unknown) {
      const message = err instanceof Error && err.message === 'NO_DATA'
        ? 'Tidak ada data untuk diekspor'
        : parseApiError(err, 'Gagal mengekspor data')
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <ApPaymentsShell fullHeight className="flex flex-col">
      {/* Header */}
      <div className={`${apTheme.header} px-4 sm:px-6 py-4`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={apTheme.headerIcon}>
              <FileSpreadsheet className="w-6 h-6 shrink-0" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-lg sm:text-xl font-bold truncate ${apTheme.title}`}>Report Gabungan</h1>
              <p className={`text-xs sm:text-sm ${apTheme.subtitle}`}>Invoice + Payment · {pagination?.total ?? 0} baris</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link to={AP_PAYMENTS_LIST_PATH} className={apTheme.btnSecondary}>
              <ArrowLeft className="w-4 h-4" /> AP Payments
            </Link>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || !hasAnyDateFilter}
              className={apTheme.btnSecondary}
              title={!hasAnyDateFilter ? 'Pilih minimal 1 rentang tanggal untuk export' : undefined}
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? 'Mengekspor...' : 'Export Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${apTheme.header} px-4 sm:px-6 py-3`}>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari invoice / supplier / no. pembayaran..."
              value={draft.search}
              onChange={(e) => setDraft((p) => ({ ...p, search: e.target.value }))}
              className={apTheme.inputSearch}
            />
            {draft.search && (
              <button type="button" onClick={() => setDraft((p) => ({ ...p, search: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select value={draft.supplierId} onChange={(e) => setDraft((p) => ({ ...p, supplierId: e.target.value }))} className={apTheme.select}>
            <option value="">Semua supplier</option>
            {(suppliersData?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.supplier_name}</option>
            ))}
          </select>
          <select value={draft.branchId} onChange={(e) => setDraft((p) => ({ ...p, branchId: e.target.value }))} className={apTheme.select}>
            <option value="">Semua cabang</option>
            {(branchesData?.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.branch_name}</option>
            ))}
          </select>
        </div>

        {/* Date filters */}
        <div className="flex flex-wrap gap-3 mt-2 items-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Tgl Terima:</span>
            <input type="date" value={draft.receivedDateFrom} onChange={(e) => setDraft((p) => ({ ...p, receivedDateFrom: e.target.value }))} className={`${apTheme.select} text-xs`} />
            <span className="text-xs text-gray-400">—</span>
            <input type="date" value={draft.receivedDateTo} onChange={(e) => setDraft((p) => ({ ...p, receivedDateTo: e.target.value }))} className={`${apTheme.select} text-xs`} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Jatuh Tempo:</span>
            <input type="date" value={draft.dueDateFrom} onChange={(e) => setDraft((p) => ({ ...p, dueDateFrom: e.target.value }))} className={`${apTheme.select} text-xs`} />
            <span className="text-xs text-gray-400">—</span>
            <input type="date" value={draft.dueDateTo} onChange={(e) => setDraft((p) => ({ ...p, dueDateTo: e.target.value }))} className={`${apTheme.select} text-xs`} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Tgl Bayar:</span>
            <input type="date" value={draft.dateFrom} onChange={(e) => setDraft((p) => ({ ...p, dateFrom: e.target.value }))} className={`${apTheme.select} text-xs`} />
            <span className="text-xs text-gray-400">—</span>
            <input type="date" value={draft.dateTo} onChange={(e) => setDraft((p) => ({ ...p, dateTo: e.target.value }))} className={`${apTheme.select} text-xs`} />
          </div>

          <button type="button" onClick={applyFilters} disabled={!isDirty} className={apTheme.btnPrimary}>
            <Filter className="w-4 h-4" /> Terapkan
          </button>
          {(filters.search || filters.supplierId || filters.branchId || filters.receivedDateFrom || filters.receivedDateTo || filters.dueDateFrom || filters.dueDateTo || filters.dateFrom || filters.dateTo) && (
            <button type="button" onClick={resetFilters} className="text-xs text-rose-600 dark:text-gray-400 hover:underline">
              Reset filter
            </button>
          )}
        </div>

        {/* Validation */}
        {isDateRangeInvalid(draft.receivedDateFrom, draft.receivedDateTo) && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Tanggal terima awal harus sebelum tanggal akhir</p>
        )}
        {isDateRangeInvalid(draft.dueDateFrom, draft.dueDateTo) && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Jatuh tempo awal harus sebelum tanggal akhir</p>
        )}
        {isDateRangeInvalid(draft.dateFrom, draft.dateTo) && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Tanggal bayar awal harus sebelum tanggal akhir</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Gagal memuat data</p>
          </div>
        ) : !hasApplied ? (
          <div className={`text-center py-16 ${apTheme.card} p-8`}>
            <Filter className="mx-auto w-12 h-12 text-rose-200 dark:text-gray-600 mb-4" />
            <p className={apTheme.muted}>Silakan atur filter dan tekan "Terapkan" untuk menampilkan data.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={apTheme.skeleton} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className={`text-center py-16 ${apTheme.card} p-8`}>
            <FileSpreadsheet className="mx-auto w-12 h-12 text-rose-200 dark:text-gray-600 mb-4" />
            <p className={apTheme.muted}>Tidak ada data yang sesuai dengan filter Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rose-200/80 dark:border-gray-700">
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">No. Invoice</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Supplier</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Cabang</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Total Invoice</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Sisa</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Tgl Terima</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Jatuh Tempo</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status Invoice</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">No. Pembayaran</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status Bayar</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Metode</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Tgl Bayar</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Nominal Bayar</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Rek. Sumber</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Rek. Tujuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100 dark:divide-gray-700 whitespace-nowrap">
                {rows.map((row, idx) => (
                  <ReportRow key={`${row.invoice_id}-${row.payment_id ?? idx}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className={`border-t ${apTheme.divideBorder} bg-white/85 dark:bg-gray-800 backdrop-blur-md px-4 py-3`}>
          <Pagination
            pagination={{ ...pagination, hasNext: page < pagination.totalPages, hasPrev: page > 1 }}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1) }}
            currentLength={rows.length}
            loading={isLoading}
          />
        </div>
      )}
    </ApPaymentsShell>
  )
}

function ReportRow({ row }: { row: CombinedInvoicePaymentRow }) {
  const invoiceStatusLabel = row.invoice_status === 'APPROVED' ? 'Approved' : 'Posted'
  const invoiceStatusColor = row.invoice_status === 'APPROVED'
    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'

  const paymentStatusLabel = row.payment_status
    ? AP_STATUS_CONFIG[row.payment_status as keyof typeof AP_STATUS_CONFIG]?.label ?? row.payment_status
    : '—'
  const paymentStatusColor = row.payment_status
    ? AP_STATUS_CONFIG[row.payment_status as keyof typeof AP_STATUS_CONFIG]?.color ?? ''
    : ''

  const methodLabel = row.payment_method
    ? AP_PAYMENT_METHOD_LABELS[row.payment_method as keyof typeof AP_PAYMENT_METHOD_LABELS] ?? row.payment_method
    : '—'

  return (
    <tr className={apTheme.hoverRow}>
      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{row.invoice_number}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.supplier_name}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.branch_name}</td>
      <td className="px-3 py-3 text-gray-900 dark:text-white">{fmtCurrency(row.invoice_total_amount)}</td>
      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{fmtCurrency(row.invoice_remaining_amount)}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{fmtDate(row.earliest_received_date)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-700 dark:text-gray-300">{fmtDate(row.invoice_due_date)}</span>
          {row.invoice_remaining_amount > 0 && <AgingBadge dueDate={row.invoice_due_date} />}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${invoiceStatusColor}`}>{invoiceStatusLabel}</span>
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.payment_number ?? '—'}</td>
      <td className="px-3 py-3">
        {row.payment_status ? (
          <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${paymentStatusColor}`}>{paymentStatusLabel}</span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{methodLabel}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{fmtDate(row.paid_at ?? row.payment_date)}</td>
      <td className="px-3 py-3 text-gray-900 dark:text-white">{fmtCurrency(row.payment_amount)}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
        {row.source_bank_name ? <span className="text-xs">{row.source_bank_name} · {row.source_account_number}</span> : '—'}
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
        {row.dest_bank_name ? <span className="text-xs">{row.dest_bank_name} · {row.dest_account_number}</span> : '—'}
      </td>
    </tr>
  )
}
