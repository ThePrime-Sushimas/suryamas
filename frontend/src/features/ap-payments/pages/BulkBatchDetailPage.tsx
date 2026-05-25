import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Upload } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import {
  useApPaymentBatch,
  useUploadApPaymentProof,
  type ApPayment,
  type ApPaymentInvoiceLine,
} from '../api/apPayments.api'
import { BatchProofUpload } from '../components/BatchProofUpload'
import { BulkBadge } from '../components/BulkBadge'
import { AP_PAYMENTS_LIST_PATH, AP_STATUS_CONFIG } from '../constants'
import { apTheme } from '../ap-payments.theme'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v)

export default function BulkBatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const canUpdate = usePermissionStore((s) => s.hasPermission('ap_payments', 'update'))

  const { data, isLoading, isError } = useApPaymentBatch(batchId ?? '')
  const uploadProof = useUploadApPaymentProof()

  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [batchUploadError, setBatchUploadError] = useState<string | null>(null)
  const [isApplyingBatchProof, setIsApplyingBatchProof] = useState(false)

  const payments = data?.payments ?? []
  const allLines = useMemo(
    () =>
      payments.flatMap((p) =>
        (p.lines ?? []).map((line) => ({ ...line, payment: p })),
      ),
    [payments],
  )

  const grandTotal = useMemo(
    () => allLines.reduce((sum, row) => sum + Number(row.amount_paid), 0),
    [allLines],
  )

  const needsProof = useMemo(
    () => payments.filter((p) => p.status === 'DRAFT' && !p.proof_url),
    [payments],
  )

  const handleApplyBatchProof = async () => {
    if (!batchFile || needsProof.length === 0) return
    setBatchUploadError(null)
    setIsApplyingBatchProof(true)
    try {
      for (const payment of needsProof) {
        await uploadProof.mutateAsync({ id: payment.id, file: batchFile })
      }
      toast.success(`Bukti transfer diterapkan ke ${needsProof.length} pembayaran`)
      setBatchFile(null)
    } catch (err: unknown) {
      const message = parseApiError(err, 'Gagal mengunggah bukti')
      setBatchUploadError(message)
      toast.error(message)
    } finally {
      setIsApplyingBatchProof(false)
    }
  }

  if (!batchId) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${apTheme.page}`}>
        <p className={apTheme.muted}>Batch tidak valid</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${apTheme.page}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${apTheme.spinner}`} />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${apTheme.page}`}>
        <p className={apTheme.muted}>Batch pembayaran tidak ditemukan</p>
        <Link to={AP_PAYMENTS_LIST_PATH} className={apTheme.btnSecondary}>
          Kembali ke AP Payments
        </Link>
      </div>
    )
  }

  const { batch } = data

  return (
    <div className={apTheme.page}>
      <div className={`${apTheme.header} ${apTheme.headerSticky}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(AP_PAYMENTS_LIST_PATH)}
              className={apTheme.btnGhost}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-lg font-bold truncate ${apTheme.title}`}>Kelola Batch</h1>
                <BulkBadge batchId={batch.id} />
              </div>
              <p className={`text-xs mt-0.5 ${apTheme.muted}`}>
                {batch.total_payments} pembayaran · {allLines.length} invoice ·{' '}
                {fmtCurrency(grandTotal)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {canUpdate && needsProof.length > 0 && (
          <section className={apTheme.card}>
            <div className={`px-5 py-4 border-b ${apTheme.divideBorder}`}>
              <h2 className={apTheme.sectionTitle}>Bukti transfer (semua pembayaran)</h2>
              <p className={`text-xs mt-1 ${apTheme.muted}`}>
                Unggah satu file untuk diterapkan ke {needsProof.length} pembayaran draft yang belum
                punya bukti. Setelah itu Anda bisa lanjut ke detail per pembayaran untuk mark PAID.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <BatchProofUpload
                file={batchFile}
                onFileChange={setBatchFile}
                error={batchUploadError}
              />
              <button
                type="button"
                disabled={!batchFile || isApplyingBatchProof}
                onClick={() => void handleApplyBatchProof()}
                className={apTheme.btnPrimary}
              >
                {isApplyingBatchProof ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Terapkan ke semua ({needsProof.length})
              </button>
            </div>
          </section>
        )}

        <section className={apTheme.cardOverflow}>
          <div className={`px-5 py-4 border-b ${apTheme.divideBorder}`}>
            <h2 className={apTheme.sectionTitle}>Semua invoice dalam batch</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${apTheme.divideBorder}`}>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    No. Invoice
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    No. Pembayaran
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                    Dibayar
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Bukti
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${apTheme.divideBorder}`}>
                {allLines.map((row) => (
                  <InvoiceBatchRow key={row.id} line={row} payment={row.payment} />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-rose-50/50 dark:bg-gray-800/50">
                  <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {fmtCurrency(grandTotal)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className={apTheme.sectionTitle}>Pembayaran dalam batch</h2>
          {payments.map((payment) => (
            <PaymentBatchCard key={payment.id} payment={payment} />
          ))}
        </section>
      </div>
    </div>
  )
}

function InvoiceBatchRow({
  line,
  payment,
}: {
  line: ApPaymentInvoiceLine
  payment: ApPayment
}) {
  const st = AP_STATUS_CONFIG[payment.status]

  return (
    <tr className={apTheme.hoverRow}>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
        {line.invoice_number}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {line.supplier_name}
      </td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {payment.payment_number}
      </td>
      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
        {fmtCurrency(Number(line.amount_paid))}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${st.color}`}>
          {st.label}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {payment.proof_url ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ada
          </span>
        ) : (
          <span className="text-xs text-amber-700 dark:text-amber-400">Belum</span>
        )}
      </td>
    </tr>
  )
}

function PaymentBatchCard({ payment }: { payment: ApPayment }) {
  const st = AP_STATUS_CONFIG[payment.status]
  const lineCount = payment.lines?.length ?? payment.invoice_count ?? 0

  return (
    <div className={`${apTheme.card} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white">{payment.payment_number}</p>
        <p className={`text-sm ${apTheme.muted}`}>
          {payment.supplier_name} · {lineCount} invoice · {fmtCurrency(Number(payment.total_amount))}
        </p>
        <span className={`inline-flex mt-2 px-2 py-0.5 rounded-lg text-xs font-medium ${st.color}`}>
          {st.label}
        </span>
      </div>
      <Link
        to={`${AP_PAYMENTS_LIST_PATH}/${payment.id}`}
        className={`${apTheme.btnSecondary} shrink-0`}
      >
        <ExternalLink className="w-4 h-4" />
        Detail pembayaran
      </Link>
    </div>
  )
}
