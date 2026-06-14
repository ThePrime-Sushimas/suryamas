import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, Search, X, Download, Loader2, Filter, ArrowLeft, AlertCircle, ShoppingCart, Receipt } from 'lucide-react'
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
import {
  useGeneralPayments,
  useVendors,
  type GeneralInvoicePayment,
  type GeneralPaymentStatus,
} from '@/features/general-invoices/api/generalApi.api'
import {
  PAYMENT_STATUS_LABELS as GEN_PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS as GEN_PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_OPTIONS as GEN_PAYMENT_STATUS_OPTIONS,
  formatRupiah as genFormatRupiah,
  formatDate as genFormatDate,
} from '@/features/general-invoices/constants'
import { AP_PAYMENT_METHOD_LABELS, AP_STATUS_CONFIG, AP_PAYMENTS_LIST_PATH } from '../constants'
import { isDateRangeInvalid } from '../utils/apPaymentFilters.url'
import { AgingBadge } from '../components/AgingBadge'
import { ApPaymentsShell } from '../components/ApPaymentsShell'
import { apTheme } from '../ap-payments.theme'
import { exportCombinedExcel } from '../utils/apPaymentsCombinedExport'

// ─── Types ────────────────────────────────────────────────────

type ActiveTab = 'PURCHASE' | 'GENERAL'

const DEFAULT_PAGE_SIZE = 25

const fmtCurrency = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
    : '—'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ─── Purchase Invoice Filters ─────────────────────────────────

interface PurchaseFilters {
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

const EMPTY_PURCHASE_FILTERS: PurchaseFilters = {
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

// ─── General Payment Filters ──────────────────────────────────

interface GeneralFilters {
  search: string
  vendorId: string
  branchId: string
  status: GeneralPaymentStatus | ''
  dateFrom: string
  dateTo: string
}

const EMPTY_GENERAL_FILTERS: GeneralFilters = {
  search: '',
  vendorId: '',
  branchId: '',
  status: '',
  dateFrom: '',
  dateTo: '',
}

// ─── Component ────────────────────────────────────────────────

export default function ApPaymentReportPage() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<ActiveTab>('PURCHASE')

  // ── Purchase tab state ──
  const [purchaseFilters, setPurchaseFilters] = useState<PurchaseFilters>(EMPTY_PURCHASE_FILTERS)
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseFilters>(EMPTY_PURCHASE_FILTERS)
  const [purchasePage, setPurchasePage] = useState(1)
  const [purchaseLimit, setPurchaseLimit] = useState(DEFAULT_PAGE_SIZE)
  const [purchaseApplied, setPurchaseApplied] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // ── General tab state ──
  const [generalFilters, setGeneralFilters] = useState<GeneralFilters>(EMPTY_GENERAL_FILTERS)
  const [generalDraft, setGeneralDraft] = useState<GeneralFilters>(EMPTY_GENERAL_FILTERS)
  const [generalPage, setGeneralPage] = useState(1)
  const [generalLimit, setGeneralLimit] = useState(DEFAULT_PAGE_SIZE)
  const [generalApplied, setGeneralApplied] = useState(false)

  // ── Shared data ──
  const { data: suppliersData } = useSuppliers({ limit: 100, is_active: true })
  const { data: branchesData } = useBranches({ limit: 100 })
  const { data: vendorsData } = useVendors({ limit: 200, is_active: true })

  // ── Purchase tab dirty / date checks ──
  const purchaseIsDirty = JSON.stringify(purchaseDraft) !== JSON.stringify(purchaseFilters)
  const purchaseHasAnyDateFilter = !!(
    purchaseFilters.receivedDateFrom || purchaseFilters.receivedDateTo ||
    purchaseFilters.dueDateFrom || purchaseFilters.dueDateTo ||
    purchaseFilters.dateFrom || purchaseFilters.dateTo
  )

  // ── General tab dirty ──
  const generalIsDirty = JSON.stringify(generalDraft) !== JSON.stringify(generalFilters)

  // ── Purchase query ──
  const purchaseQuery: CombinedInvoicePaymentQuery = useMemo(
    () => ({
      page: purchasePage,
      limit: purchaseLimit,
      ...(purchaseFilters.supplierId ? { supplier_id: purchaseFilters.supplierId } : {}),
      ...(purchaseFilters.branchId ? { branch_id: purchaseFilters.branchId } : {}),
      ...(purchaseFilters.search ? { search: purchaseFilters.search } : {}),
      ...(purchaseFilters.receivedDateFrom ? { received_date_from: purchaseFilters.receivedDateFrom } : {}),
      ...(purchaseFilters.receivedDateTo ? { received_date_to: purchaseFilters.receivedDateTo } : {}),
      ...(purchaseFilters.dueDateFrom ? { due_date_from: purchaseFilters.dueDateFrom } : {}),
      ...(purchaseFilters.dueDateTo ? { due_date_to: purchaseFilters.dueDateTo } : {}),
      ...(purchaseFilters.dateFrom ? { date_from: purchaseFilters.dateFrom } : {}),
      ...(purchaseFilters.dateTo ? { date_to: purchaseFilters.dateTo } : {}),
    }),
    [purchasePage, purchaseLimit, purchaseFilters],
  )

  const { data: purchaseData, isLoading: purchaseLoading, isError: purchaseError } =
    useCombinedInvoicePayments(purchaseQuery, { enabled: purchaseApplied })

  const purchaseRows = purchaseData?.data ?? []
  const purchasePagination = purchaseData?.pagination

  // ── General query ──
  const generalQuery = useMemo(
    () => ({
      page: generalPage,
      limit: generalLimit,
      ...(generalFilters.vendorId ? { vendor_id: generalFilters.vendorId } : {}),
      ...(generalFilters.branchId ? { branch_id: generalFilters.branchId } : {}),
      ...(generalFilters.search ? { search: generalFilters.search } : {}),
      ...(generalFilters.status ? { status: generalFilters.status } : {}),
      ...(generalFilters.dateFrom ? { payment_date_from: generalFilters.dateFrom } : {}),
      ...(generalFilters.dateTo ? { payment_date_to: generalFilters.dateTo } : {}),
    }),
    [generalPage, generalLimit, generalFilters],
  )

  const { data: generalData, isLoading: generalLoading, isError: generalError } =
    useGeneralPayments(generalQuery, { enabled: generalApplied })

  const generalRows = generalData?.data ?? []
  const generalPagination = generalData?.pagination

  // ── Handlers: Purchase ──
  const applyPurchaseFilters = useCallback(() => {
    setPurchaseFilters({ ...purchaseDraft })
    setPurchasePage(1)
    setPurchaseApplied(true)
  }, [purchaseDraft])

  const resetPurchaseFilters = useCallback(() => {
    setPurchaseDraft(EMPTY_PURCHASE_FILTERS)
    setPurchaseFilters(EMPTY_PURCHASE_FILTERS)
    setPurchasePage(1)
    setPurchaseApplied(false)
  }, [])

  // ── Handlers: General ──
  const applyGeneralFilters = useCallback(() => {
    setGeneralFilters({ ...generalDraft })
    setGeneralPage(1)
    setGeneralApplied(true)
  }, [generalDraft])

  const resetGeneralFilters = useCallback(() => {
    setGeneralDraft(EMPTY_GENERAL_FILTERS)
    setGeneralFilters(EMPTY_GENERAL_FILTERS)
    setGeneralPage(1)
    setGeneralApplied(false)
  }, [])

  // ── Export ──
  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportCombinedExcel({
        ...(purchaseFilters.supplierId ? { supplier_id: purchaseFilters.supplierId } : {}),
        ...(purchaseFilters.branchId ? { branch_id: purchaseFilters.branchId } : {}),
        ...(purchaseFilters.search ? { search: purchaseFilters.search } : {}),
        ...(purchaseFilters.receivedDateFrom ? { received_date_from: purchaseFilters.receivedDateFrom } : {}),
        ...(purchaseFilters.receivedDateTo ? { received_date_to: purchaseFilters.receivedDateTo } : {}),
        ...(purchaseFilters.dueDateFrom ? { due_date_from: purchaseFilters.dueDateFrom } : {}),
        ...(purchaseFilters.dueDateTo ? { due_date_to: purchaseFilters.dueDateTo } : {}),
        ...(purchaseFilters.dateFrom ? { date_from: purchaseFilters.dateFrom } : {}),
        ...(purchaseFilters.dateTo ? { date_to: purchaseFilters.dateTo } : {}),
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

  // ── Active row / pagination counts ──
  const activeTotal = activeTab === 'PURCHASE'
    ? (purchasePagination?.total ?? 0)
    : (generalPagination?.total ?? 0)

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
              <p className={`text-xs sm:text-sm ${apTheme.subtitle}`}>
                {activeTab === 'PURCHASE' ? 'Invoice + Payment' : 'General Payments'} · {activeTotal} baris
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link to={AP_PAYMENTS_LIST_PATH} className={apTheme.btnSecondary}>
              <ArrowLeft className="w-4 h-4" /> AP Payments
            </Link>
            {activeTab === 'PURCHASE' && (
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || !purchaseHasAnyDateFilter}
                className={apTheme.btnSecondary}
                title={!purchaseHasAnyDateFilter ? 'Pilih minimal 1 rentang tanggal untuk export' : undefined}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting ? 'Mengekspor...' : 'Export Excel'}
              </button>
            )}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mt-3 border-b border-rose-200/60 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab('PURCHASE')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'PURCHASE'
                ? 'border-rose-500 text-rose-700 dark:text-rose-300 dark:border-rose-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Purchase Invoice
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('GENERAL')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'GENERAL'
                ? 'border-rose-500 text-rose-700 dark:text-rose-300 dark:border-rose-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            General Payments
          </button>
        </div>
      </div>

      {/* ── PURCHASE FILTERS ─────────────────────────────────── */}
      {activeTab === 'PURCHASE' && (
        <div className={`${apTheme.header} px-4 sm:px-6 py-3`}>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari invoice / supplier / no. pembayaran..."
                value={purchaseDraft.search}
                onChange={(e) => setPurchaseDraft((p) => ({ ...p, search: e.target.value }))}
                className={apTheme.inputSearch}
              />
              {purchaseDraft.search && (
                <button type="button" onClick={() => setPurchaseDraft((p) => ({ ...p, search: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select value={purchaseDraft.supplierId} onChange={(e) => setPurchaseDraft((p) => ({ ...p, supplierId: e.target.value }))} className={apTheme.select}>
              <option value="">Semua supplier</option>
              {(suppliersData?.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.supplier_name}</option>
              ))}
            </select>
            <select value={purchaseDraft.branchId} onChange={(e) => setPurchaseDraft((p) => ({ ...p, branchId: e.target.value }))} className={apTheme.select}>
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
              <input type="date" value={purchaseDraft.receivedDateFrom} onChange={(e) => setPurchaseDraft((p) => ({ ...p, receivedDateFrom: e.target.value }))} className={`${apTheme.select} text-xs`} />
              <span className="text-xs text-gray-400">—</span>
              <input type="date" value={purchaseDraft.receivedDateTo} onChange={(e) => setPurchaseDraft((p) => ({ ...p, receivedDateTo: e.target.value }))} className={`${apTheme.select} text-xs`} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Jatuh Tempo:</span>
              <input type="date" value={purchaseDraft.dueDateFrom} onChange={(e) => setPurchaseDraft((p) => ({ ...p, dueDateFrom: e.target.value }))} className={`${apTheme.select} text-xs`} />
              <span className="text-xs text-gray-400">—</span>
              <input type="date" value={purchaseDraft.dueDateTo} onChange={(e) => setPurchaseDraft((p) => ({ ...p, dueDateTo: e.target.value }))} className={`${apTheme.select} text-xs`} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Tgl Bayar:</span>
              <input type="date" value={purchaseDraft.dateFrom} onChange={(e) => setPurchaseDraft((p) => ({ ...p, dateFrom: e.target.value }))} className={`${apTheme.select} text-xs`} />
              <span className="text-xs text-gray-400">—</span>
              <input type="date" value={purchaseDraft.dateTo} onChange={(e) => setPurchaseDraft((p) => ({ ...p, dateTo: e.target.value }))} className={`${apTheme.select} text-xs`} />
            </div>

            <button type="button" onClick={applyPurchaseFilters} disabled={!purchaseIsDirty} className={apTheme.btnPrimary}>
              <Filter className="w-4 h-4" /> Terapkan
            </button>
            {(purchaseFilters.search || purchaseFilters.supplierId || purchaseFilters.branchId ||
              purchaseFilters.receivedDateFrom || purchaseFilters.receivedDateTo ||
              purchaseFilters.dueDateFrom || purchaseFilters.dueDateTo ||
              purchaseFilters.dateFrom || purchaseFilters.dateTo) && (
              <button type="button" onClick={resetPurchaseFilters} className="text-xs text-rose-600 dark:text-gray-400 hover:underline">
                Reset filter
              </button>
            )}
          </div>

          {/* Validation */}
          {isDateRangeInvalid(purchaseDraft.receivedDateFrom, purchaseDraft.receivedDateTo) && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Tanggal terima awal harus sebelum tanggal akhir</p>
          )}
          {isDateRangeInvalid(purchaseDraft.dueDateFrom, purchaseDraft.dueDateTo) && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Jatuh tempo awal harus sebelum tanggal akhir</p>
          )}
          {isDateRangeInvalid(purchaseDraft.dateFrom, purchaseDraft.dateTo) && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Tanggal bayar awal harus sebelum tanggal akhir</p>
          )}
        </div>
      )}

      {/* ── GENERAL FILTERS ──────────────────────────────────── */}
      {activeTab === 'GENERAL' && (
        <div className={`${apTheme.header} px-4 sm:px-6 py-3`}>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari no. payment, invoice, atau vendor..."
                value={generalDraft.search}
                onChange={(e) => setGeneralDraft((p) => ({ ...p, search: e.target.value }))}
                className={apTheme.inputSearch}
              />
              {generalDraft.search && (
                <button type="button" onClick={() => setGeneralDraft((p) => ({ ...p, search: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select value={generalDraft.vendorId} onChange={(e) => setGeneralDraft((p) => ({ ...p, vendorId: e.target.value }))} className={apTheme.select}>
              <option value="">Semua vendor</option>
              {(vendorsData?.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.vendor_name}</option>
              ))}
            </select>
            <select value={generalDraft.branchId} onChange={(e) => setGeneralDraft((p) => ({ ...p, branchId: e.target.value }))} className={apTheme.select}>
              <option value="">Semua cabang</option>
              {(branchesData?.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </select>
            <select
              value={generalDraft.status}
              onChange={(e) => setGeneralDraft((p) => ({ ...p, status: e.target.value as GeneralPaymentStatus | '' }))}
              className={apTheme.select}
            >
              <option value="">Semua status</option>
              {GEN_PAYMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Date filter */}
          <div className="flex flex-wrap gap-3 mt-2 items-end">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Tgl Bayar:</span>
              <input
                type="date"
                value={generalDraft.dateFrom}
                onChange={(e) => setGeneralDraft((p) => ({ ...p, dateFrom: e.target.value }))}
                className={`${apTheme.select} text-xs`}
              />
              <span className="text-xs text-gray-400">—</span>
              <input
                type="date"
                value={generalDraft.dateTo}
                onChange={(e) => setGeneralDraft((p) => ({ ...p, dateTo: e.target.value }))}
                className={`${apTheme.select} text-xs`}
              />
            </div>

            <button type="button" onClick={applyGeneralFilters} disabled={!generalIsDirty} className={apTheme.btnPrimary}>
              <Filter className="w-4 h-4" /> Terapkan
            </button>
            {(generalFilters.search || generalFilters.vendorId || generalFilters.branchId ||
              generalFilters.status || generalFilters.dateFrom || generalFilters.dateTo) && (
              <button type="button" onClick={resetGeneralFilters} className="text-xs text-rose-600 dark:text-gray-400 hover:underline">
                Reset filter
              </button>
            )}
          </div>

          {isDateRangeInvalid(generalDraft.dateFrom, generalDraft.dateTo) && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Tanggal bayar awal harus sebelum tanggal akhir</p>
          )}
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">

        {/* Purchase Invoice Tab Content */}
        {activeTab === 'PURCHASE' && (
          <>
            {purchaseError ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Gagal memuat data</p>
              </div>
            ) : !purchaseApplied ? (
              <div className={`text-center py-16 ${apTheme.card} p-8`}>
                <Filter className="mx-auto w-12 h-12 text-rose-200 dark:text-gray-600 mb-4" />
                <p className={apTheme.muted}>Silakan atur filter dan tekan "Terapkan" untuk menampilkan data.</p>
              </div>
            ) : purchaseLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={apTheme.skeleton} />
                ))}
              </div>
            ) : purchaseRows.length === 0 ? (
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
                    {purchaseRows.map((row, idx) => (
                      <PurchaseReportRow key={`${row.invoice_id}-${row.payment_id ?? idx}`} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* General Payments Tab Content */}
        {activeTab === 'GENERAL' && (
          <>
            {generalError ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Gagal memuat data</p>
              </div>
            ) : !generalApplied ? (
              <div className={`text-center py-16 ${apTheme.card} p-8`}>
                <Filter className="mx-auto w-12 h-12 text-rose-200 dark:text-gray-600 mb-4" />
                <p className={apTheme.muted}>Silakan atur filter dan tekan "Terapkan" untuk menampilkan data.</p>
              </div>
            ) : generalLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={apTheme.skeleton} />
                ))}
              </div>
            ) : generalRows.length === 0 ? (
              <div className={`text-center py-16 ${apTheme.card} p-8`}>
                <Receipt className="mx-auto w-12 h-12 text-rose-200 dark:text-gray-600 mb-4" />
                <p className={apTheme.muted}>Tidak ada data yang sesuai dengan filter Anda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rose-200/80 dark:border-gray-700">
                      <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">No. Payment</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Vendor</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Cabang</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">No. Invoice</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Metode</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Rekening</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Tgl Bayar</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Nominal</th>
                      <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 dark:divide-gray-700 whitespace-nowrap">
                    {generalRows.map((row) => (
                      <GeneralPaymentRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── PAGINATION ───────────────────────────────────────── */}
      {activeTab === 'PURCHASE' && purchasePagination && purchasePagination.total > 0 && (
        <div className={`border-t ${apTheme.divideBorder} bg-white/85 dark:bg-gray-800 backdrop-blur-md px-4 py-3`}>
          <Pagination
            pagination={{ ...purchasePagination, hasNext: purchasePage < purchasePagination.totalPages, hasPrev: purchasePage > 1 }}
            onPageChange={setPurchasePage}
            onLimitChange={(l) => { setPurchaseLimit(l); setPurchasePage(1) }}
            currentLength={purchaseRows.length}
            loading={purchaseLoading}
          />
        </div>
      )}
      {activeTab === 'GENERAL' && generalPagination && generalPagination.total > 0 && (
        <div className={`border-t ${apTheme.divideBorder} bg-white/85 dark:bg-gray-800 backdrop-blur-md px-4 py-3`}>
          <Pagination
            pagination={{ ...generalPagination, hasNext: generalPage < generalPagination.totalPages, hasPrev: generalPage > 1 }}
            onPageChange={setGeneralPage}
            onLimitChange={(l) => { setGeneralLimit(l); setGeneralPage(1) }}
            currentLength={generalRows.length}
            loading={generalLoading}
          />
        </div>
      )}
    </ApPaymentsShell>
  )
}

// ─── Purchase Invoice Row ─────────────────────────────────────

function PurchaseReportRow({ row }: { row: CombinedInvoicePaymentRow }) {
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

// ─── General Payment Row ──────────────────────────────────────

function GeneralPaymentRow({ row }: { row: GeneralInvoicePayment }) {
  const statusConfig = AP_STATUS_CONFIG[row.status as keyof typeof AP_STATUS_CONFIG]
  const statusLabel = statusConfig?.label ?? row.status
  const statusColor = statusConfig?.color ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'

  const methodMap: Record<string, string> = {
    TRANSFER: 'Transfer',
    CASH: 'Tunai',
    CC_OWNER: 'Credit Card',
  }
  const methodLabel = methodMap[row.payment_method] ?? row.payment_method

  return (
    <tr className={apTheme.hoverRow}>
      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{row.payment_number}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.vendor_name}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.branch_name}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.invoice_number}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{methodLabel}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 text-xs">
        {row.bank_account_name ?? row.owner_credit_card_label ?? '—'}
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
        {genFormatDate(row.paid_at ?? row.payment_date)}
      </td>
      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
        {genFormatRupiah(row.total_amount)}
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </td>
    </tr>
  )
}
