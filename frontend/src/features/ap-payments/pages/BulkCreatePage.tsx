import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import api from '@/lib/axios'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useBulkCreateState } from '../hooks/useBulkCreateState'
import { useCompanyBankAccounts } from '../hooks/useCompanyBankAccounts'
import { SupplierGroupCard } from '../components/SupplierGroupCard'
import { BulkSummaryPanel, type BankAccountUsageItem } from '../components/BulkSummaryPanel'
import { useCreateBulkPaymentV2 } from '../api/apPayments.api'
import { getStoredSessionPayload } from '../utils/sessionPayload.utils'
import type { SessionPayloadItem } from '../types/sessionPayload.types'
import type { OutstandingInvoiceRow, BulkCreateApPaymentDto } from '../api/apPayments.api'
import { apPaymentBatchPath } from '../constants'

const SESSION_KEY = 'bulk_selected_invoices'

export default function BulkCreatePage() {
  const navigate = useNavigate()
  const toast = useToast()

  // Read session payload from sessionStorage on mount (V2 format with bank account assignments)
  const [sessionPayload] = useState<SessionPayloadItem[] | null>(() => getStoredSessionPayload())

  // Extract invoice IDs from session payload for backward compatibility with existing query logic
  const invoiceIds = useMemo(
    () => sessionPayload?.map((item) => item.invoiceId) ?? null,
    [sessionPayload],
  )

  // Validation and submission state
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set())
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  // Ref for scrolling to first error
  const containerRef = useRef<HTMLDivElement>(null)

  // Redirect if no payload (absent, empty, or unparseable)
  useEffect(() => {
    if (!sessionPayload) {
      navigate('/finance/ap-payments', { replace: true })
    }
  }, [sessionPayload, navigate])

  // Fetch invoice data by IDs (fast endpoint — direct PK lookup, no full scan)
  const {
    data: invoiceData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ap-payments', 'bulk-invoices', invoiceIds],
    queryFn: async () => {
      const { data } = await api.post('/ap-payments/outstanding-invoices/by-ids', {
        invoice_ids: invoiceIds,
      })
      return (data.data ?? []) as OutstandingInvoiceRow[]
    },
    enabled: !!invoiceIds && invoiceIds.length > 0,
    staleTime: 0,
    retry: 1,
  })

  // Fetch company bank accounts
  const {
    data: companyBankAccounts = [],
    isLoading: bankAccountsLoading,
    isError: bankAccountsError,
  } = useCompanyBankAccounts()

  // Build initial bank account assignments from session payload
  const initialAssignments = useMemo(() => {
    const map = new Map<string, number | null>()
    if (!sessionPayload) return map
    for (const item of sessionPayload) {
      map.set(item.invoiceId, item.bankAccountId)
    }
    return map
  }, [sessionPayload])

  // Build set of valid (active) bank account IDs for validation
  const validBankAccountIds = useMemo(
    () => new Set(companyBankAccounts.map((a) => a.id)),
    [companyBankAccounts],
  )

  // Initialize bulk create state from fetched invoices with pre-filled bank account assignments
  const bulkState = useBulkCreateState(invoiceData ?? [], initialAssignments, validBankAccountIds)

  // Bulk create mutation (V2 — multipart/form-data, creates DRAFT payments)
  const bulkCreateMutation = useCreateBulkPaymentV2()

  // Build a map of supplier bank accounts from the original invoice data
  const supplierBankAccountsMap = useMemo(() => {
    const map = new Map<
      string,
      Array<{ id: number; bank_name: string; account_number: string; account_name: string }>
    >()
    if (!invoiceData) return map
    for (const inv of invoiceData) {
      if (!map.has(inv.supplier_id) && inv.supplier_bank_accounts?.length > 0) {
        map.set(inv.supplier_id, inv.supplier_bank_accounts)
      }
    }
    return map
  }, [invoiceData])

  // Currency formatter for confirmation dialog
  const fmtCurrency = useCallback(
    (v: number) =>
      new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v),
    [],
  )

  // --- Submission flow ---

  const handleSubmitClick = useCallback(() => {
    // Clear previous errors
    setValidationErrors(new Set())
    setSubmissionError(null)

    const checked = bulkState.checkedInvoices

    // 1. Validate all checked invoices have a bank account assigned
    const missingBankAccount = checked.filter((inv) => inv.bankAccountId == null)
    if (missingBankAccount.length > 0) {
      const errorIds = new Set(missingBankAccount.map((inv) => inv.invoiceId))
      setValidationErrors(errorIds)

      // Scroll to first error row
      requestAnimationFrame(() => {
        const firstErrorEl = containerRef.current?.querySelector('[data-validation-error="true"]')
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
      return
    }

    // 2. Show confirmation dialog
    setShowConfirmModal(true)
  }, [bulkState.checkedInvoices])

  const handleConfirmSubmit = useCallback(() => {
    setShowConfirmModal(false)

    // Build payload grouped by (supplier, rek sumber, rek tujuan, metode bayar)
    const groupMap = new Map<
      string,
      {
        supplier_id: string
        bank_account_id: number
        supplier_bank_account_id: number | null
        payment_method: string
        invoice_lines: Array<{ purchase_invoice_id: string; amount_paid: number }>
        notes: string | null
      }
    >()

    for (const invoice of bulkState.checkedInvoices) {
      if (invoice.bankAccountId == null) continue

      const paymentMethod = bulkState.groupPaymentMethods.get(invoice.supplierId) ?? 'TRANSFER'
      const key = `${invoice.supplierId}:${invoice.bankAccountId}:${invoice.supplierBankAccountId ?? ''}:${paymentMethod}`
      const existing = groupMap.get(key)

      if (existing) {
        existing.invoice_lines.push({
          purchase_invoice_id: invoice.invoiceId,
          amount_paid: invoice.amountPaid,
        })
      } else {
        const notes = bulkState.groupNotes.get(invoice.supplierId) || null

        groupMap.set(key, {
          supplier_id: invoice.supplierId,
          bank_account_id: invoice.bankAccountId,
          supplier_bank_account_id: invoice.supplierBankAccountId,
          payment_method: paymentMethod,
          invoice_lines: [
            {
              purchase_invoice_id: invoice.invoiceId,
              amount_paid: invoice.amountPaid,
            },
          ],
          notes,
        })
      }
    }

    const payload: BulkCreateApPaymentDto = {
      batch_notes: null,
      payments: Array.from(groupMap.values()).map((group) => ({
        supplier_id: group.supplier_id,
        bank_account_id: group.bank_account_id,
        supplier_bank_account_id: group.supplier_bank_account_id,
        payment_method: group.payment_method as 'TRANSFER' | 'CASH' | 'CHECK' | 'GIRO',
        invoice_lines: group.invoice_lines,
        notes: group.notes,
      })),
    }

    // Build FormData with JSON payload only (no proof files — uploaded later on detail page)
    const formData = new FormData()
    formData.append('payload', JSON.stringify(payload))

    // POST to /ap-payments/bulk (multipart/form-data)
    bulkCreateMutation.mutate(formData, {
      onSuccess: (data) => {
        // Clear sessionStorage
        sessionStorage.removeItem(SESSION_KEY)

        navigate(apPaymentBatchPath(data.batch_id))

        const batchPrefix = data.batch_id.substring(0, 4)
        toast.success(
          `${data.total_payments} pembayaran dibuat (Batch #${batchPrefix}). Unggah bukti di halaman batch.`,
        )
      },
      onError: (err) => {
        if (axios.isAxiosError(err) && err.response?.status === 400) {
          // Backend validation error - display error message, retain form state
          const errorMessage =
            err.response?.data?.error ||
            err.response?.data?.message ||
            'Terjadi kesalahan validasi. Periksa kembali data invoice.'
          setSubmissionError(errorMessage)
        } else if (
          axios.isAxiosError(err) &&
          (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || !err.response)
        ) {
          // Network error or timeout (30s) - error toast, retain form state
          toast.error('Koneksi gagal')
        } else {
          // Other server error - show error toast, retain form state
          toast.error('Gagal membuat pembayaran. Silakan coba lagi.')
        }
      },
    })
  }, [bulkState.checkedInvoices, bulkState.groupNotes, bulkState.groupPaymentMethods, bulkCreateMutation, navigate, toast])

  // Don't render if redirecting
  if (!sessionPayload) return null

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="flex flex-col md:flex-row gap-6 mt-6">
            <div className="flex-1 space-y-4">
              <div className="h-48 bg-gray-200 rounded" />
              <div className="h-48 bg-gray-200 rounded" />
            </div>
            <div className="w-full md:w-80">
              <div className="h-64 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Gagal memuat data invoice
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {error instanceof Error ? error.message : 'Terjadi kesalahan saat mengambil data.'}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review & Bayar</h1>
        <button
          onClick={() => navigate('/finance/ap-payments')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Batal
        </button>
      </div>

      {/* Backend validation error banner */}
      {submissionError && (
        <div className="mb-4 flex items-start gap-3 p-4 rounded-2xl border border-red-200 bg-red-50/70 dark:border-red-800 dark:bg-red-900/20">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Gagal membuat pembayaran
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {submissionError}
            </p>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left column - Supplier groups */}
        <div className="flex-1 space-y-4">
          {/* Bank accounts API error */}
          {bankAccountsError && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-200 bg-red-50/70 dark:border-red-800 dark:bg-red-900/20">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">
                Gagal memuat data rekening bank. Semua pemilihan rekening dinonaktifkan.
              </p>
            </div>
          )}

          {/* Bank accounts loading indicator */}
          {bankAccountsLoading && (
            <div className="text-sm text-gray-500">Memuat data rekening bank...</div>
          )}

          {/* Supplier group cards */}
          {bulkState.supplierGroups.map((group) => (
            <SupplierGroupCard
              key={group.supplierId}
              supplier={{
                id: group.supplierId,
                name: group.supplierName,
                bankAccounts: supplierBankAccountsMap.get(group.supplierId) ?? [],
              }}
              invoices={group.invoices}
              companyBankAccounts={bankAccountsError ? [] : companyBankAccounts}
              groupNotes={bulkState.groupNotes.get(group.supplierId) ?? ''}
              paymentMethod={bulkState.groupPaymentMethods.get(group.supplierId) ?? 'TRANSFER'}
              onGroupNotesChange={(notes) =>
                bulkState.setGroupNotes(group.supplierId, notes)
              }
              onPaymentMethodChange={(method) =>
                bulkState.setGroupPaymentMethod(group.supplierId, method)
              }
              onInvoiceToggle={(invoiceId, checked) =>
                bulkState.toggleInvoice(invoiceId, checked)
              }
              onBankAccountChange={(invoiceId, bankAccountId) => {
                bulkState.setBankAccount(invoiceId, bankAccountId)
                if (bankAccountId != null && validationErrors.has(invoiceId)) {
                  setValidationErrors((prev) => {
                    const next = new Set(prev)
                    next.delete(invoiceId)
                    return next
                  })
                }
              }}
              onSupplierBankAccountChange={(invoiceId, supplierBankAccountId) =>
                bulkState.setSupplierBankAccount(invoiceId, supplierBankAccountId)
              }
              onAmountPaidChange={(invoiceId, amount) =>
                bulkState.setAmountPaid(invoiceId, amount)
              }
              validationErrors={validationErrors}
            />
          ))}

        </div>

        {/* Right column - Summary panel */}
        <div className="w-full md:w-80">
          <BulkSummaryPanel
            supplierCount={
              new Set(bulkState.checkedInvoices.map((inv) => inv.supplierId)).size
            }
            invoiceCount={bulkState.checkedInvoices.length}
            grandTotal={bulkState.grandTotal}
            paymentCount={bulkState.paymentCount}
            bankAccountUsage={bulkState.bankAccountUsage.map(
              (usage): BankAccountUsageItem => {
                const account = companyBankAccounts.find(
                  (a) => a.id === usage.bankAccountId,
                )
                return {
                  bankAccountId: usage.bankAccountId,
                  bankName: account?.bank_name ?? '—',
                  accountNumber: account?.account_number ?? '—',
                  usedAmount: usage.usedAmount,
                }
              },
            )}
            canViewBalance={false}
            hasInsufficientBalance={false}
            onSubmit={handleSubmitClick}
            isSubmitting={bulkCreateMutation.isPending}
          />
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title="Konfirmasi Pembayaran Massal"
        message={`Anda akan membuat ${bulkState.paymentCount} pembayaran dengan total ${fmtCurrency(bulkState.grandTotal)}. Pembayaran akan dibuat sebagai DRAFT. Upload bukti transfer di halaman detail untuk mark as PAID.`}
        confirmText="Konfirmasi"
        cancelText="Batal"
        variant="info"
        isLoading={bulkCreateMutation.isPending}
      />
    </div>
  )
}
