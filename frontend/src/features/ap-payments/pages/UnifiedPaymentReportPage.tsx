import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileSpreadsheet, Search, X, Filter, AlertCircle,
  Loader2, Download, ArrowLeft,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Pagination } from '@/components/ui/Pagination'
import { useBranches } from '@/features/branches/api/branches.api'
import { useSuppliers } from '@/features/suppliers/api/suppliers.api'
import {
  useGeneralPayments,
  useVendors,
  type GeneralInvoicePayment,
} from '@/features/general-invoices/api/generalApi.api'
import {
  useCombinedInvoicePayments,
  type CombinedInvoicePaymentRow,
} from '../api/apPayments.api'
import { useMarketplaceSessions } from '@/features/marketplace-po/api/marketplacePo.api'
import type { MarketplaceCheckoutSession } from '@/features/marketplace-po/types/marketplacePo.types'
import {
  AP_PAYMENT_METHOD_LABELS,
  AP_STATUS_CONFIG,
  AP_PAYMENTS_LIST_PATH,
} from '../constants'
import { isDateRangeInvalid } from '../utils/apPaymentFilters.url'
import { ApPaymentsShell } from '../components/ApPaymentsShell'
import { apTheme } from '../ap-payments.theme'
import {
  PAYMENT_STATUS_OPTIONS as GEN_PAYMENT_STATUS_OPTIONS,
  PAYMENT_STATUS_LABELS as GENERAL_STATUS_LABELS,
} from '@/features/general-invoices/constants'
import type { GeneralPaymentStatus } from '@/features/general-invoices/api/generalApi.api'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 25

const GENERAL_PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFER: 'Transfer',
  CASH: 'Cash',
  CC_OWNER: 'Credit Card',
}

// ─── Unified row type ─────────────────────────────────────────────────────────

type RowType = 'PURCHASE' | 'GENERAL' | 'MARKETPLACE'

interface UnifiedRow {
  _type: RowType
  _id: string
  invoice_number: string
  vendor_name: string
  branch_name: string
  payment_number: string | null
  payment_method: string | null
  rekening: string | null
  payment_date: string | null
  nominal_bayar: number | null
  invoice_total: number | null
  invoice_remaining: number | null
  invoice_due_date: string | null
  invoice_status: string | null
  payment_status: string | null
  // Bank source (company)
  source_bank_name: string | null
  source_account_number: string | null
  source_account_name: string | null
  // Bank destination (vendor/supplier)
  dest_bank_name: string | null
  dest_account_number: string | null
  dest_account_name: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
    : '—'

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

/** Raw YYYY-MM-DD for Excel sortability */
const rawDate = (d: string | null | undefined): string =>
  d ? d.slice(0, 10) : ''

function fromCombinedRow(row: CombinedInvoicePaymentRow, idx: number): UnifiedRow {
  return {
    _type: 'PURCHASE',
    _id: `purchase-${row.invoice_id}-${row.payment_id ?? idx}`,
    invoice_number: row.invoice_number,
    vendor_name: row.supplier_name,
    branch_name: row.branch_name,
    payment_number: row.payment_number,
    payment_method: row.payment_method,
    rekening: row.source_bank_name
      ? `${row.source_bank_name}${row.source_account_number ? ' · ' + row.source_account_number : ''}`
      : null,
    payment_date: row.paid_at ?? row.payment_date,
    nominal_bayar: row.payment_amount,
    invoice_total: row.invoice_total_amount,
    invoice_remaining: row.invoice_remaining_amount,
    invoice_due_date: row.invoice_due_date,
    invoice_status: row.invoice_status,
    payment_status: row.payment_status,
    source_bank_name: row.source_bank_name ?? null,
    source_account_number: row.source_account_number ?? null,
    source_account_name: row.source_account_name ?? null,
    dest_bank_name: row.dest_bank_name ?? null,
    dest_account_number: row.dest_account_number ?? null,
    dest_account_name: row.dest_account_name ?? null,
  }
}

function fromGeneralPayment(pay: GeneralInvoicePayment): UnifiedRow {
  const isCcOwner = pay.payment_method === 'CC_OWNER'
  return {
    _type: 'GENERAL',
    _id: `general-${pay.id}`,
    invoice_number: pay.invoice_number,
    vendor_name: pay.vendor_name,
    branch_name: pay.branch_name,
    payment_number: pay.payment_number,
    payment_method: pay.payment_method,
    rekening: isCcOwner
      ? (pay.owner_credit_card_label ?? null)
      : pay.bank_name
        ? `${pay.bank_name}${pay.bank_account_number ? ' · ' + pay.bank_account_number : ''}`
        : null,
    payment_date: pay.paid_at ?? pay.payment_date,
    nominal_bayar: pay.total_amount,
    invoice_total: pay.invoice_total_amount,
    invoice_remaining: ['PAID', 'RECONCILED'].includes(pay.status) ? 0 : pay.invoice_total_amount,
    invoice_due_date: pay.invoice_due_date,
    invoice_status: pay.invoice_status,
    payment_status: pay.status,
    source_bank_name: isCcOwner ? null : (pay.bank_name ?? null),
    source_account_number: isCcOwner ? null : (pay.bank_account_number ?? null),
    source_account_name: isCcOwner
      ? (pay.owner_credit_card_label ?? null)
      : (pay.bank_account_name ?? null),
    dest_bank_name: pay.vendor_bank_name ?? null,
    dest_account_number: pay.vendor_bank_account_number ?? null,
    dest_account_name: pay.vendor_bank_account_name ?? null,
  }
}

function fromMarketplaceSession(session: MarketplaceCheckoutSession): UnifiedRow {
  const ccLabel = session.cc_label ?? session.card_label ?? null
  const bankName = session.bank_name ?? null
  const last4 = session.last4 ?? null
  const rekeningDisplay = ccLabel
    ? `${ccLabel}${last4 ? ' ···' + last4 : ''}`
    : bankName
      ? `${bankName}${last4 ? ' ···' + last4 : ''}`
      : null
  const isSettled = session.status === 'SETTLED'
  return {
    _type: 'MARKETPLACE',
    _id: `marketplace-${session.id}`,
    invoice_number: session.session_number,
    vendor_name: `${session.platform}${ccLabel ? ' · ' + ccLabel : ''}`,
    branch_name: session.branch_name ?? '—',
    payment_number: session.session_number,
    payment_method: 'CC_OWNER',
    rekening: rekeningDisplay,
    payment_date: session.checkout_date,
    nominal_bayar: Number(session.total_amount),
    invoice_total: Number(session.total_amount),
    invoice_remaining: isSettled ? 0 : Number(session.total_amount),
    invoice_due_date: null,
    invoice_status: session.status,
    payment_status: session.status,
    source_bank_name: bankName,
    source_account_number: last4,
    source_account_name: ccLabel,
    dest_bank_name: null,
    dest_account_number: null,
    dest_account_name: null,
  }
}

function sortByDate(rows: UnifiedRow[]): UnifiedRow[] {
  return [...rows].sort((a, b) => {
    const da = a.payment_date ? new Date(a.payment_date).getTime() : 0
    const db = b.payment_date ? new Date(b.payment_date).getTime() : 0
    return db - da
  })
}

function getPurchaseInvoiceStatusLabel(status: string | null): string {
  if (status === 'APPROVED') return 'Approved'
  if (status === 'POSTED') return 'Posted'
  if (status === 'DRAFT') return 'Draft'
  if (status === 'CANCELLED') return 'Cancelled'
  return status ?? ''
}

function getInvoiceStatusLabel(status: string | null, type: RowType): string {
  if (!status) return ''
  if (type === 'MARKETPLACE') return MARKETPLACE_STATUS_LABELS[status] ?? status
  return getPurchaseInvoiceStatusLabel(status)
}

function getPaymentMethodLabel(method: string | null, type: RowType): string {
  if (!method) return '—'
  if (type === 'PURCHASE')
    return AP_PAYMENT_METHOD_LABELS[method as keyof typeof AP_PAYMENT_METHOD_LABELS] ?? method
  if (type === 'MARKETPLACE') return 'CC Owner'
  return GENERAL_PAYMENT_METHOD_LABELS[method] ?? method
}

const MARKETPLACE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ORDERED: 'Ordered',
  SHIPPED: 'Shipped',
  RECEIVED: 'Received',
  SETTLED: 'Settled',
  CANCELLED: 'Cancelled',
}

function getPaymentStatusLabel(status: string | null, type: RowType): string {
  if (!status) return ''
  if (type === 'GENERAL') return GENERAL_STATUS_LABELS[status as GeneralPaymentStatus] ?? status
  if (type === 'MARKETPLACE') return MARKETPLACE_STATUS_LABELS[status] ?? status
  return AP_STATUS_CONFIG[status as keyof typeof AP_STATUS_CONFIG]?.label ?? status
}

// ─── Filter state ─────────────────────────────────────────────────────────────

interface Filters {
  search: string
  branchId: string
  rowType: '' | 'PURCHASE' | 'GENERAL' | 'MARKETPLACE'
  // Shared date (payment date)
  dateFrom: string
  dateTo: string
  // Purchase-only
  supplierId: string
  receivedDateFrom: string
  receivedDateTo: string
  dueDateFrom: string
  dueDateTo: string
  // General-only
  vendorId: string
  generalStatus: GeneralPaymentStatus | ''
}

const EMPTY_FILTERS: Filters = {
  search: '',
  branchId: '',
  rowType: '',
  dateFrom: '',
  dateTo: '',
  supplierId: '',
  receivedDateFrom: '',
  receivedDateTo: '',
  dueDateFrom: '',
  dueDateTo: '',
  vendorId: '',
  generalStatus: '',
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UnifiedPaymentReportPage() {
  const toast = useToast()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [hasApplied, setHasApplied] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [isExporting, setIsExporting] = useState(false)

  const { data: branchesData } = useBranches({ limit: 100 })
  const { data: suppliersData } = useSuppliers({ limit: 100, is_active: true })
  const { data: vendorsData } = useVendors({ limit: 200, is_active: true })

  const isDirty = JSON.stringify(draft) !== JSON.stringify(filters)

  const hasActiveFilter = Object.entries(filters).some(([k, v]) => k !== 'rowType' && v !== '')
  const showPurchaseFilters = draft.rowType === '' || draft.rowType === 'PURCHASE'
  const showGeneralFilters  = draft.rowType === '' || draft.rowType === 'GENERAL'

  // ── AP combined query ──
  const apQuery = useMemo(() => ({
    page: 1,
    limit: -1, // no limit
    ...(filters.branchId    ? { branch_id:          filters.branchId }    : {}),
    ...(filters.supplierId  ? { supplier_id:         filters.supplierId }  : {}),
    ...(filters.search      ? { search:              filters.search }      : {}),
    ...(filters.receivedDateFrom ? { received_date_from: filters.receivedDateFrom } : {}),
    ...(filters.receivedDateTo   ? { received_date_to:   filters.receivedDateTo }   : {}),
    ...(filters.dueDateFrom ? { due_date_from:       filters.dueDateFrom } : {}),
    ...(filters.dueDateTo   ? { due_date_to:         filters.dueDateTo }   : {}),
    ...(filters.dateFrom    ? { date_from:            filters.dateFrom }    : {}),
    ...(filters.dateTo      ? { date_to:              filters.dateTo }      : {}),
  }), [filters])

  const enableAp = hasApplied && (filters.rowType === '' || filters.rowType === 'PURCHASE')
  const { data: apData, isLoading: apLoading, isError: apError } =
    useCombinedInvoicePayments(apQuery, { enabled: enableAp })

  // ── General payments query ──
  const generalQuery = useMemo(() => ({
    limit: -1, // no limit
    ...(filters.branchId      ? { branch_id:          filters.branchId }      : {}),
    ...(filters.vendorId      ? { vendor_id:           filters.vendorId }      : {}),
    ...(filters.search        ? { search:              filters.search }        : {}),
    ...(filters.generalStatus ? { status:              filters.generalStatus } : {}),
    ...(filters.dateFrom      ? { payment_date_from:   filters.dateFrom }      : {}),
    ...(filters.dateTo        ? { payment_date_to:     filters.dateTo }        : {}),
  }), [filters])

  const enableGeneral = hasApplied && (filters.rowType === '' || filters.rowType === 'GENERAL')
  const { data: generalData, isLoading: generalLoading, isError: generalError } =
    useGeneralPayments(generalQuery, { enabled: enableGeneral })

  // ── Marketplace sessions query ──
  const marketplaceQuery = useMemo(() => ({
    limit: -1, // no limit — fetch all for client-side merge
    page: 1,
    ...(filters.branchId ? { branch_id: filters.branchId } : {}),
    ...(filters.search   ? { search:    filters.search }   : {}),
    ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(filters.dateTo   ? { date_to:   filters.dateTo }   : {}),
  }), [filters])

  const enableMarketplace = hasApplied && (filters.rowType === '' || filters.rowType === 'MARKETPLACE')
  const { data: marketplaceData, isLoading: marketplaceLoading, isError: marketplaceError } =
    useMarketplaceSessions(marketplaceQuery, { enabled: enableMarketplace })

  // ── Merge + sort ──
  // When a type-specific filter is active, exclude other types that can't filter on it
  const hasSupplierFilter = !!filters.supplierId || !!filters.receivedDateFrom || !!filters.receivedDateTo || !!filters.dueDateFrom || !!filters.dueDateTo
  const hasVendorFilter = !!filters.vendorId || !!filters.generalStatus

  const allRows: UnifiedRow[] = useMemo(() => {
    if (!hasApplied) return []
    // If a purchase-specific filter is active, only show purchase rows
    // If a general-specific filter is active, only show general rows
    // Otherwise show all enabled types
    const showAp   = enableAp && !hasVendorFilter
    const showGen  = enableGeneral && !hasSupplierFilter
    const showMkt  = enableMarketplace && !hasSupplierFilter && !hasVendorFilter

    const apRows   = showAp  ? (apData?.data ?? []).map((r, i) => fromCombinedRow(r, i)) : []
    const genRows  = showGen ? (generalData?.data ?? []).map(fromGeneralPayment)         : []
    const mktRows  = showMkt
      ? (marketplaceData?.data ?? [])
          .filter((s) => s.status !== 'DRAFT' && s.status !== 'CANCELLED')
          .map(fromMarketplaceSession)
      : []
    return sortByDate([...apRows, ...genRows, ...mktRows])
  }, [hasApplied, apData, generalData, marketplaceData, enableAp, enableGeneral, enableMarketplace, hasSupplierFilter, hasVendorFilter])

  // ── Client-side pagination ──
  const totalRows = allRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / limit))
  const pagedRows = useMemo(() => {
    const start = (page - 1) * limit
    return allRows.slice(start, start + limit)
  }, [allRows, page, limit])

  const isLoading =
    (enableAp && apLoading) ||
    (enableGeneral && generalLoading) ||
    (enableMarketplace && marketplaceLoading)
  const isError = apError || generalError || marketplaceError

  // ── Handlers ──
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
    if (allRows.length === 0) {
      toast.warning('Tidak ada data untuk diekspor')
      return
    }
    setIsExporting(true)
    try {
      // Dynamically load XLSX
      const XLSX = await import('xlsx')

      // Reconstruct full detail from raw data — for Purchase rows we have more info
      const apRowsMap = new Map<string, CombinedInvoicePaymentRow>()
      ;(apData?.data ?? []).forEach((r, i) => {
        apRowsMap.set(`purchase-${r.invoice_id}-${r.payment_id ?? i}`, r)
      })

      const excelRows = allRows.map((r) => {
        const isPurchase = r._type === 'PURCHASE'
        const purchaseRow = isPurchase ? apRowsMap.get(r._id) : undefined
        const typeLabel = isPurchase ? 'Purchase' : r._type === 'MARKETPLACE' ? 'Marketplace' : 'General'

        return {
          Tipe: typeLabel,
          'No. Invoice': r.invoice_number,
          'Tgl Invoice': isPurchase ? rawDate(purchaseRow?.invoice_date) : '',
          'Tgl Terima': isPurchase ? rawDate(purchaseRow?.earliest_received_date) : '',
          'Jatuh Tempo': rawDate(r.invoice_due_date),
          'Vendor / Supplier': r.vendor_name,
          Cabang: r.branch_name,
          'Status Invoice': getInvoiceStatusLabel(r.invoice_status, r._type),
          'Total Invoice': r.invoice_total ?? '',
          'Sisa Outstanding': r.invoice_remaining ?? '',
          'Aging (hari)': isPurchase ? (purchaseRow?.aging_days ?? '') : '',
          Overdue: isPurchase ? (purchaseRow?.is_overdue ? 'Ya' : 'Tidak') : '',
          'No. Pembayaran': r.payment_number ?? '',
          'Status Pembayaran': getPaymentStatusLabel(r.payment_status, r._type),
          'Metode Bayar': getPaymentMethodLabel(r.payment_method, r._type),
          'Tgl Bayar': rawDate(r.payment_date),
          'Nominal Bayar': r.nominal_bayar ?? '',
          Rekening: r.rekening ?? '',
          'Bank Sumber': r.source_bank_name ?? '',
          'No. Rek Sumber': r.source_account_number ?? '',
          'Nama Rek Sumber': r.source_account_name ?? '',
          'Bank Tujuan': r.dest_bank_name ?? '',
          'No. Rek Tujuan': r.dest_account_number ?? '',
          'Nama Rek Tujuan': r.dest_account_name ?? '',
        }
      })

      const ws = XLSX.utils.json_to_sheet(excelRows)

      // Auto-width columns
      const colWidths = Object.keys(excelRows[0]).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...excelRows.map((r) => String((r as Record<string, unknown>)[key] ?? '').length),
        )
        return { wch: Math.min(maxLen + 2, 40) }
      })
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Report Pengeluaran')

      const dateStr = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `pengeluaran-${dateStr}.xlsx`)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal mengekspor data'))
    } finally {
      setIsExporting(false)
    }
  }

  // ── Date validation on draft ──
  const receivedDateInvalid = isDateRangeInvalid(draft.receivedDateFrom, draft.receivedDateTo)
  const dueDateInvalid      = isDateRangeInvalid(draft.dueDateFrom, draft.dueDateTo)
  const payDateInvalid      = isDateRangeInvalid(draft.dateFrom, draft.dateTo)

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
              <h1 className={`text-lg sm:text-xl font-bold truncate ${apTheme.title}`}>
                Report Pengeluaran
              </h1>
              <p className={`text-xs sm:text-sm ${apTheme.subtitle}`}>
                Purchase + General + Marketplace · {totalRows} baris
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link to={AP_PAYMENTS_LIST_PATH} className={apTheme.btnSecondary}>
              <ArrowLeft className="w-4 h-4" /> AP Payments
            </Link>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || !hasApplied || totalRows === 0}
              className={apTheme.btnSecondary}
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? 'Mengekspor...' : 'Export Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${apTheme.header} px-4 sm:px-6 py-3 space-y-2`}>
        {/* Row 1: common filters */}
        <div className="flex flex-wrap gap-2 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari no. invoice / payment / vendor..."
              value={draft.search}
              onChange={(e) => setDraft((p) => ({ ...p, search: e.target.value }))}
              className={apTheme.inputSearch}
            />
            {draft.search && (
              <button
                type="button"
                onClick={() => setDraft((p) => ({ ...p, search: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Branch */}
          <select
            value={draft.branchId}
            onChange={(e) => setDraft((p) => ({ ...p, branchId: e.target.value }))}
            className={apTheme.select}
          >
            <option value="">Semua cabang</option>
            {(branchesData?.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.branch_name}</option>
            ))}
          </select>

          {/* Tipe */}
          <select
            value={draft.rowType}
            onChange={(e) => setDraft((p) => ({ ...p, rowType: e.target.value as Filters['rowType'] }))}
            className={apTheme.select}
          >
            <option value="">Semua tipe</option>
            <option value="PURCHASE">Purchase Invoice</option>
            <option value="GENERAL">General Invoice</option>
            <option value="MARKETPLACE">Marketplace</option>
          </select>

          {/* Purchase-specific: supplier */}
          {showPurchaseFilters && (
            <select
              value={draft.supplierId}
              onChange={(e) => setDraft((p) => ({ ...p, supplierId: e.target.value }))}
              className={apTheme.select}
            >
              <option value="">Semua supplier</option>
              {(suppliersData?.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.supplier_name}</option>
              ))}
            </select>
          )}

          {/* General-specific: vendor + status */}
          {showGeneralFilters && (
            <>
              <select
                value={draft.vendorId}
                onChange={(e) => setDraft((p) => ({ ...p, vendorId: e.target.value }))}
                className={apTheme.select}
              >
                <option value="">Semua vendor</option>
                {(vendorsData?.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.vendor_name}</option>
                ))}
              </select>
              <select
                value={draft.generalStatus}
                onChange={(e) => setDraft((p) => ({ ...p, generalStatus: e.target.value as GeneralPaymentStatus | '' }))}
                className={apTheme.select}
              >
                <option value="">Semua status</option>
                {GEN_PAYMENT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Row 2: date filters */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Purchase-only: Tgl Terima */}
          {showPurchaseFilters && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Tgl Terima:</span>
              <input
                type="date"
                value={draft.receivedDateFrom}
                onChange={(e) => setDraft((p) => ({ ...p, receivedDateFrom: e.target.value }))}
                className={`${apTheme.select} text-xs`}
              />
              <span className="text-xs text-gray-400">—</span>
              <input
                type="date"
                value={draft.receivedDateTo}
                onChange={(e) => setDraft((p) => ({ ...p, receivedDateTo: e.target.value }))}
                className={`${apTheme.select} text-xs`}
              />
            </div>
          )}

          {/* Purchase-only: Jatuh Tempo */}
          {showPurchaseFilters && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Jatuh Tempo:</span>
              <input
                type="date"
                value={draft.dueDateFrom}
                onChange={(e) => setDraft((p) => ({ ...p, dueDateFrom: e.target.value }))}
                className={`${apTheme.select} text-xs`}
              />
              <span className="text-xs text-gray-400">—</span>
              <input
                type="date"
                value={draft.dueDateTo}
                onChange={(e) => setDraft((p) => ({ ...p, dueDateTo: e.target.value }))}
                className={`${apTheme.select} text-xs`}
              />
            </div>
          )}

          {/* Shared: Tgl Bayar */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-rose-600/80 dark:text-gray-400 whitespace-nowrap">Tgl Bayar:</span>
            <input
              type="date"
              value={draft.dateFrom}
              onChange={(e) => setDraft((p) => ({ ...p, dateFrom: e.target.value }))}
              className={`${apTheme.select} text-xs`}
            />
            <span className="text-xs text-gray-400">—</span>
            <input
              type="date"
              value={draft.dateTo}
              onChange={(e) => setDraft((p) => ({ ...p, dateTo: e.target.value }))}
              className={`${apTheme.select} text-xs`}
            />
          </div>

          <button
            type="button"
            onClick={applyFilters}
            disabled={!isDirty}
            className={apTheme.btnPrimary}
          >
            <Filter className="w-4 h-4" /> Terapkan
          </button>

          {(hasActiveFilter || hasApplied) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-rose-600 dark:text-gray-400 hover:underline"
            >
              Reset filter
            </button>
          )}
        </div>

        {/* Validation messages */}
        {receivedDateInvalid && (
          <p className="text-xs text-red-600 dark:text-red-400">Tanggal terima awal harus sebelum tanggal akhir</p>
        )}
        {dueDateInvalid && (
          <p className="text-xs text-red-600 dark:text-red-400">Jatuh tempo awal harus sebelum tanggal akhir</p>
        )}
        {payDateInvalid && (
          <p className="text-xs text-red-600 dark:text-red-400">Tanggal bayar awal harus sebelum tanggal akhir</p>
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
            <p className={apTheme.muted}>
              Atur filter dan tekan "Terapkan" untuk menampilkan data pengeluaran.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-rose-400 dark:text-gray-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data...</p>
          </div>
        ) : allRows.length === 0 ? (
          <div className={`text-center py-16 ${apTheme.card} p-8`}>
            <FileSpreadsheet className="mx-auto w-12 h-12 text-rose-200 dark:text-gray-600 mb-4" />
            <p className={apTheme.muted}>Tidak ada data yang sesuai dengan filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rose-200/80 dark:border-gray-700">
                  <th className={thCls}>Tipe</th>
                  <th className={thCls}>No. Invoice</th>
                  <th className={thCls}>Vendor / Supplier</th>
                  <th className={thCls}>Cabang</th>
                  <th className={thCls}>No. Pembayaran</th>
                  <th className={thCls}>Metode</th>
                  <th className={thCls}>Rekening</th>
                  <th className={thCls}>Tgl Bayar</th>
                  <th className={thCls}>Nominal Bayar</th>
                  <th className={thCls}>Total Invoice</th>
                  <th className={thCls}>Sisa</th>
                  <th className={thCls}>Jatuh Tempo</th>
                  <th className={thCls}>Status Invoice</th>
                  <th className={thCls}>Status Bayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100 dark:divide-gray-700 whitespace-nowrap">
                {pagedRows.map((row) => (
                  <UnifiedTableRow key={row._id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {hasApplied && totalRows > 0 && (
        <div className={`border-t ${apTheme.divideBorder} bg-white/85 dark:bg-gray-800 backdrop-blur-md px-4 py-3`}>
          <Pagination
            pagination={{
              page,
              limit,
              total: totalRows,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1,
            }}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1) }}
            currentLength={pagedRows.length}
            loading={isLoading}
          />
        </div>
      )}
    </ApPaymentsShell>
  )
}

// ─── Table helpers ─────────────────────────────────────────────────────────────

const thCls = 'px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300 text-sm'

function TypeBadge({ type }: { type: RowType }) {
  if (type === 'PURCHASE') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200/80 dark:border-transparent">
        Purchase
      </span>
    )
  }
  if (type === 'MARKETPLACE') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/80 dark:border-transparent">
        Marketplace
      </span>
    )
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border border-sky-200/80 dark:border-transparent">
      General
    </span>
  )
}

function PaymentStatusBadge({ status, type }: { status: string | null; type: RowType }) {
  if (!status) return <span className="text-gray-400">—</span>
  if (type === 'GENERAL') {
    const colorMap: Record<string, string> = {
      DRAFT:     'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
      APPROVED:  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      REJECTED:  'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      PAID:      'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      RECONCILED:'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    }
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${colorMap[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {GENERAL_STATUS_LABELS[status as GeneralPaymentStatus] ?? status}
      </span>
    )
  }
  if (type === 'MARKETPLACE') {
    const colorMap: Record<string, string> = {
      ORDERED:   'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      SHIPPED:   'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      RECEIVED:  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      SETTLED:   'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    }
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${colorMap[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {MARKETPLACE_STATUS_LABELS[status] ?? status}
      </span>
    )
  }
  const config = AP_STATUS_CONFIG[status as keyof typeof AP_STATUS_CONFIG]
  if (!config) return <span className="text-gray-500 dark:text-gray-400 text-xs">{status}</span>
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

function InvoiceStatusBadge({ status, type }: { status: string | null; type: RowType }) {
  if (!status) return <span className="text-gray-400">—</span>
  if (type === 'MARKETPLACE') {
    const colorMap: Record<string, string> = {
      DRAFT:     'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
      ORDERED:   'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      SHIPPED:   'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      RECEIVED:  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      SETTLED:   'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      CANCELLED: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    }
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${colorMap[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {MARKETPLACE_STATUS_LABELS[status] ?? status}
      </span>
    )
  }
  const colorMap: Record<string, string> = {
    DRAFT:     'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-gray-700 dark:text-gray-300 dark:border-transparent',
    APPROVED:  'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    POSTED:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    CANCELLED: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }
  const labelMap: Record<string, string> = {
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    POSTED: 'Posted',
    CANCELLED: 'Cancelled',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${colorMap[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labelMap[status] ?? status}
    </span>
  )
}

function UnifiedTableRow({ row }: { row: UnifiedRow }) {
  return (
    <tr className={apTheme.hoverRow}>
      <td className="px-3 py-3"><TypeBadge type={row._type} /></td>
      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{row.invoice_number}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.vendor_name}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.branch_name}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.payment_number ?? '—'}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{getPaymentMethodLabel(row.payment_method, row._type)}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.rekening ?? '—'}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{fmtDate(row.payment_date)}</td>
      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{fmtCurrency(row.nominal_bayar)}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{fmtCurrency(row.invoice_total)}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{fmtCurrency(row.invoice_remaining)}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{fmtDate(row.invoice_due_date)}</td>
      <td className="px-3 py-3"><InvoiceStatusBadge status={row.invoice_status} type={row._type} /></td>
      <td className="px-3 py-3"><PaymentStatusBadge status={row.payment_status} type={row._type} /></td>
    </tr>
  )
}