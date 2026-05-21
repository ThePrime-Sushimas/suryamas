import { useState, useEffect } from 'react'
import api from '@/lib/axios'
import { useNavigate, useParams } from 'react-router-dom'
import { useListNavigation } from '@/lib/urlFilters'
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  XCircle,
  Banknote,
  Upload,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import {
  useApPayment,
  useSubmitApPayment,
  useApproveApPayment,
  useRejectApPayment,
  useUploadApPaymentProof,
  useMarkApPaymentPaid,
  useReconcileApPayment,
  useDeleteApPayment,
} from '../api/apPayments.api'
import {
  AP_PAYMENTS_LIST_PATH,
  AP_PAYMENT_METHOD_LABELS,
  AP_STATUS_CONFIG,
} from '../constants'
import { ApPaymentProofModal } from '../components/ApPaymentProofModal'
import { ApPaymentRejectModal } from '../components/ApPaymentRejectModal'

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

const fmtDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

export default function ApPaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { backToList } = useListNavigation(AP_PAYMENTS_LIST_PATH)
  const toast = useToast()
  const hasPermission = usePermissionStore((s) => s.hasPermission)

  const canUpdate = hasPermission('ap_payments', 'update')
  const canApprove = hasPermission('ap_payments', 'approve')
  const canDelete = hasPermission('ap_payments', 'delete')

  const { data: payment, isLoading } = useApPayment(id ?? '')
  const submit = useSubmitApPayment()
  const approve = useApproveApPayment()
  const reject = useRejectApPayment()
  const uploadProof = useUploadApPaymentProof()
  const markPaid = useMarkApPaymentPaid()
  const reconcile = useReconcileApPayment()
  const deletePayment = useDeleteApPayment()

  const [showReject, setShowReject] = useState(false)
  const [showProof, setShowProof] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [bankStatementId, setBankStatementId] = useState('')
  const [showReconcile, setShowReconcile] = useState(false)
  const [proofViewUrl, setProofViewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!payment?.proof_url) {
      setProofViewUrl(null)
      return
    }
    const raw = payment.proof_url
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      setProofViewUrl(raw)
      return
    }
    let cancelled = false
    api
      .get('/storage/signed-url', { params: { path: raw, bucket: 'buktisetoran' } })
      .then((res) => {
        if (!cancelled) setProofViewUrl(res.data?.data?.url ?? null)
      })
      .catch(() => {
        if (!cancelled) setProofViewUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [payment?.proof_url])

  if (isLoading || !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        {isLoading ? (
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        ) : (
          <p className="text-gray-500">Pembayaran tidak ditemukan</p>
        )}
      </div>
    )
  }

  const st = AP_STATUS_CONFIG[payment.status]
  const allLinesPosted = (payment.lines ?? []).every(
    (l) => l.invoice_status === 'POSTED',
  )
  const canMarkPaid = payment.status === 'APPROVED' && payment.proof_url && allLinesPosted

  const handleSubmit = async () => {
    if (!id) return
    try {
      await submit.mutateAsync(id)
      toast.success('Diajukan untuk approval')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal submit'))
    }
  }

  const handleApprove = async () => {
    if (!id) return
    try {
      await approve.mutateAsync(id)
      toast.success('Pembayaran disetujui')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal approve'))
    }
  }

  const handleReject = async (reason: string) => {
    if (!id) return
    try {
      await reject.mutateAsync({ id, rejection_reason: reason })
      toast.success('Pembayaran ditolak')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal reject'))
      throw err
    }
  }

  const handleProof = async (file: File) => {
    if (!id) return
    try {
      await uploadProof.mutateAsync({ id, file })
      toast.success('Bukti bayar disimpan')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal upload bukti'))
      throw err
    }
  }

  const handleMarkPaid = async () => {
    if (!id) return
    try {
      await markPaid.mutateAsync({ id, payment_date: new Date().toISOString().slice(0, 10) })
      toast.success('Status: sudah dibayar')
      setShowPayConfirm(false)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menandai lunas'))
    }
  }

  const handleReconcile = async () => {
    if (!id || !bankStatementId.trim()) return
    try {
      await reconcile.mutateAsync({
        id,
        bank_statement_id: Number(bankStatementId),
      })
      toast.success('Reconciled')
      setShowReconcile(false)
      setBankStatementId('')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal reconcile'))
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      await deletePayment.mutateAsync(id)
      toast.success('Pembayaran dihapus')
      backToList()
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menghapus'))
    } finally {
      setShowDelete(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={backToList}
              className="p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {payment.payment_number}
                </h1>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${st.color}`}>
                  {st.label}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate">{payment.supplier_name}</p>
            </div>
          </div>
          {payment.status === 'DRAFT' && canUpdate && (
            <button
              type="button"
              onClick={() => navigate(`${AP_PAYMENTS_LIST_PATH}/${payment.id}/edit`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-gray-200 dark:border-gray-600 text-sm font-medium shrink-0"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total bayar</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {fmtCurrency(Number(payment.total_amount))}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Metode / Bank</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {AP_PAYMENT_METHOD_LABELS[payment.payment_method]}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {payment.bank_account_name} · {payment.bank_account_number}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Cabang</p>
            <p className="text-sm text-gray-900 dark:text-white">{payment.branch_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tanggal bayar</p>
            <p className="text-sm text-gray-900 dark:text-white">
              {fmtDate(payment.payment_date)}
            </p>
          </div>
          {payment.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500">Catatan</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{payment.notes}</p>
            </div>
          )}
          {payment.rejection_reason && (
            <div className="sm:col-span-2 p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
              <p className="text-xs text-red-600 font-medium">Alasan ditolak</p>
              <p className="text-sm text-red-800 dark:text-red-200">{payment.rejection_reason}</p>
            </div>
          )}
          {payment.proof_url && (
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 mb-1">Bukti bayar</p>
              {proofViewUrl ? (
                <div className="space-y-2">
                  {/\.(jpe?g|png|webp|heic|heif)(\?|$)/i.test(proofViewUrl) && (
                    <img
                      src={proofViewUrl}
                      alt="Bukti bayar"
                      className="max-h-40 rounded-2xl border border-gray-200 dark:border-gray-600 object-cover"
                    />
                  )}
                  <a
                    href={proofViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Lihat bukti
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Memuat bukti…</p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Invoice ({payment.lines?.length ?? 0})
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {(payment.lines ?? []).map((line) => (
              <div key={line.id} className="px-5 py-4 flex justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {line.invoice_number}
                  </p>
                  <p className="text-xs text-gray-500">
                    {fmtDate(line.invoice_date)} · PI {line.invoice_status ?? '—'} · Total{' '}
                    {fmtCurrency(Number(line.invoice_total_amount))}
                  </p>
                  {line.invoice_status && line.invoice_status !== 'POSTED' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      Menunggu posting PI / konfirmasi gudang
                    </p>
                  )}
                </div>
                <p className="font-semibold text-gray-900 dark:text-white shrink-0">
                  {fmtCurrency(Number(line.amount_paid))}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Timeline</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Dibuat</dt>
              <dd className="text-gray-900 dark:text-white">{fmtDateTime(payment.created_at)}</dd>
            </div>
            {payment.requested_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Diajukan</dt>
                <dd>{fmtDateTime(payment.requested_at)}</dd>
              </div>
            )}
            {payment.approved_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Disetujui</dt>
                <dd>{fmtDateTime(payment.approved_at)}</dd>
              </div>
            )}
            {payment.paid_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Dibayar</dt>
                <dd>{fmtDateTime(payment.paid_at)}</dd>
              </div>
            )}
            {payment.reconciled_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Reconciled</dt>
                <dd>{fmtDateTime(payment.reconciled_at)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="flex flex-wrap gap-2">
          {payment.status === 'DRAFT' && canUpdate && (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submit.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-medium"
            >
              <Send className="w-4 h-4" />
              Ajukan approval
            </button>
          )}
          {payment.status === 'PENDING_APPROVAL' && canApprove && (
            <>
              <button
                type="button"
                onClick={() => void handleApprove()}
                disabled={approve.isPending}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                Setujui
              </button>
              <button
                type="button"
                onClick={() => setShowReject(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-red-200 text-red-600 text-sm font-medium"
              >
                <XCircle className="w-4 h-4" />
                Tolak
              </button>
            </>
          )}
          {['APPROVED', 'PAID'].includes(payment.status) && canUpdate && (
            <button
              type="button"
              onClick={() => setShowProof(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              {payment.proof_url ? 'Update bukti' : 'Upload bukti'}
            </button>
          )}
          {payment.status === 'APPROVED' && canUpdate && (
            <>
              {!allLinesPosted && (
                <p className="w-full text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3">
                  Pembayaran baru bisa ditandai lunas setelah semua invoice PI berstatus POSTED
                  (jurnal hutang sudah terbentuk).
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowPayConfirm(true)}
                disabled={!canMarkPaid}
                title={
                  !payment.proof_url
                    ? 'Upload bukti bayar terlebih dahulu'
                    : !allLinesPosted
                      ? 'Tunggu PI POSTED'
                      : undefined
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
              >
                <Banknote className="w-4 h-4" />
                Tandai sudah dibayar
              </button>
            </>
          )}
          {payment.status === 'PAID' && canUpdate && (
            <button
              type="button"
              onClick={() => setShowReconcile(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-green-600 text-white text-sm font-medium"
            >
              Reconcile
            </button>
          )}
          {payment.status === 'DRAFT' && canDelete && (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-red-600 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </button>
          )}
        </section>
      </div>

      <ApPaymentRejectModal
        isOpen={showReject}
        onClose={() => setShowReject(false)}
        onSubmit={handleReject}
        isLoading={reject.isPending}
      />
      <ApPaymentProofModal
        isOpen={showProof}
        onClose={() => setShowProof(false)}
        onSubmit={handleProof}
        isLoading={uploadProof.isPending}
      />
      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => void handleDelete()}
        title="Hapus pembayaran?"
        message="Draft akan dihapus permanen."
        confirmText="Hapus"
        variant="danger"
        isLoading={deletePayment.isPending}
      />
      <ConfirmModal
        isOpen={showPayConfirm}
        onClose={() => setShowPayConfirm(false)}
        onConfirm={() => void handleMarkPaid()}
        title="Tandai sudah dibayar?"
        message="Pastikan dana sudah keluar dari rekening. Status akan berubah ke PAID."
        confirmText="Konfirmasi"
        variant="success"
        isLoading={markPaid.isPending}
      />

      {showReconcile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowReconcile(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Link bank statement
            </h3>
            {/* TODO(Sprint 4): replace with bank_statements picker (search by date/amount), not raw ID */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Sementara: masukkan ID baris mutasi bank dari modul rekonsiliasi.
            </p>
            <input
              type="number"
              value={bankStatementId}
              onChange={(e) => setBankStatementId(e.target.value)}
              placeholder="Bank statement ID"
              className="w-full px-3 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReconcile(false)}
                className="px-4 py-2 rounded-2xl text-sm border"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleReconcile()}
                disabled={reconcile.isPending || !bankStatementId.trim()}
                className="px-4 py-2 rounded-2xl text-sm bg-green-600 text-white disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
