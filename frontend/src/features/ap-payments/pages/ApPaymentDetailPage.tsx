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
import { apTheme } from '../ap-payments.theme'

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
    if (!payment?.proof_url) { setProofViewUrl(null); return }
    const raw = payment.proof_url
    if (raw.startsWith('http://') || raw.startsWith('https://')) { setProofViewUrl(raw); return }
    let cancelled = false
    api.get('/storage/signed-url', { params: { path: raw, bucket: 'buktisetoran' } })
      .then((res) => { if (!cancelled) setProofViewUrl(res.data?.data?.url ?? null) })
      .catch(() => { if (!cancelled) setProofViewUrl(null) })
    return () => { cancelled = true }
  }, [payment?.proof_url])

  if (isLoading || !payment) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${apTheme.page}`}>
        {isLoading ? (
          <Loader2 className={`w-8 h-8 animate-spin ${apTheme.spinner}`} />
        ) : (
          <p className={apTheme.muted}>Pembayaran tidak ditemukan</p>
        )}
      </div>
    )
  }

  const st = AP_STATUS_CONFIG[payment.status]
  const allLinesPosted = (payment.lines ?? []).every((l) => l.invoice_status === 'POSTED')
  const canMarkPaid = payment.status === 'APPROVED' && payment.proof_url && allLinesPosted
  const totalAllocated = (payment.lines ?? []).reduce((s, l) => s + Number(l.amount_paid), 0)

  const handleSubmit = async () => { if (!id) return; try { await submit.mutateAsync(id); toast.success('Diajukan untuk approval') } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal submit')) } }
  const handleApprove = async () => { if (!id) return; try { await approve.mutateAsync(id); toast.success('Pembayaran disetujui') } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal approve')) } }
  const handleReject = async (reason: string) => { if (!id) return; try { await reject.mutateAsync({ id, rejection_reason: reason }); toast.success('Pembayaran ditolak') } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal reject')); throw err } }
  const handleProof = async (file: File) => { if (!id) return; try { await uploadProof.mutateAsync({ id, file }); toast.success('Bukti bayar disimpan') } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal upload bukti')); throw err } }
  const handleMarkPaid = async () => { if (!id) return; try { await markPaid.mutateAsync({ id, payment_date: new Date().toISOString().slice(0, 10) }); toast.success('Status: sudah dibayar'); setShowPayConfirm(false) } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menandai lunas')) } }
  const handleReconcile = async () => { if (!id || !bankStatementId.trim()) return; try { await reconcile.mutateAsync({ id, bank_statement_id: Number(bankStatementId) }); toast.success('Reconciled'); setShowReconcile(false); setBankStatementId('') } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal reconcile')) } }
  const handleDelete = async () => { if (!id) return; try { await deletePayment.mutateAsync(id); toast.success('Pembayaran dihapus'); backToList() } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus')) } finally { setShowDelete(false) } }

  // Timeline steps
  const timelineSteps = [
    { label: 'Dibuat', date: payment.created_at, name: payment.created_by_name, done: true },
    { label: 'Diajukan', date: payment.requested_at, name: payment.requested_by_name, done: !!payment.requested_at },
    ...(payment.rejected_at ? [{ label: 'Ditolak', date: payment.rejected_at, name: payment.rejected_by_name, done: true, isRejected: true }] : []),
    { label: 'Disetujui', date: payment.approved_at, name: payment.approved_by_name, done: !!payment.approved_at },
    { label: 'Dibayar', date: payment.paid_at, name: payment.paid_by_name, done: !!payment.paid_at },
    { label: 'Reconciled', date: payment.reconciled_at, name: null, done: !!payment.reconciled_at },
  ].filter(step => step.done || step.label === 'Diajukan' || step.label === 'Disetujui' || step.label === 'Dibayar')

  return (
    <div className={apTheme.page}>
      {/* Top Header */}
      <div className={`${apTheme.header} ${apTheme.headerSticky}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={backToList} className={apTheme.btnGhost}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className={`text-base font-semibold truncate ${apTheme.title}`}>{payment.payment_number}</h1>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-medium ${st.color}`}>{st.label}</span>
              </div>
              <p className={`text-xs mt-0.5 ${apTheme.muted}`}>{payment.supplier_name} · {payment.branch_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {payment.status === 'DRAFT' && canUpdate && (
              <button type="button" onClick={() => navigate(`${AP_PAYMENTS_LIST_PATH}/${payment.id}/edit`)} className={apTheme.btnSecondary}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {payment.status === 'DRAFT' && canDelete && (
              <button type="button" onClick={() => setShowDelete(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Hapus
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column — Main content */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Payment Information Card */}
            <section className={apTheme.card}>
              <div className={`px-5 py-3.5 border-b ${apTheme.divideBorder}`}>
                <h2 className={apTheme.sectionTitle}>Informasi Pembayaran</h2>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <InfoField label="No. Pembayaran" value={payment.payment_number} />
                <InfoField label="Tanggal Bayar" value={fmtDate(payment.payment_date)} />
                <InfoField label="Supplier" value={payment.supplier_name} />
                <InfoField label="Metode Bayar" value={AP_PAYMENT_METHOD_LABELS[payment.payment_method]} />
                <InfoField label="Rekening Sumber" value={`${payment.bank_account_name} · ${payment.bank_account_number}`} />
                <InfoField label="Cabang" value={payment.branch_name} />
                {payment.notes && <InfoField label="Catatan" value={payment.notes} className="sm:col-span-2 lg:col-span-3" />}
              </div>
              {payment.rejection_reason && (
                <div className="mx-5 mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">Alasan Ditolak</p>
                  <p className="text-sm text-red-800 dark:text-red-200 mt-0.5">{payment.rejection_reason}</p>
                </div>
              )}
            </section>

            {/* Payment Allocation Table */}
            <section className={apTheme.cardOverflow}>
              <div className={`px-5 py-3.5 border-b ${apTheme.divideBorder}`}>
                <h2 className={apTheme.sectionTitle}>
                  Alokasi Invoice ({payment.lines?.length ?? 0})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b border-gray-100 dark:border-gray-700 ${apTheme.surface}`}>
                      <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide text-rose-600/80 dark:text-gray-400">No. Invoice</th>
                      <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide text-rose-600/80 dark:text-gray-400">Tgl Invoice</th>
                      <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide text-rose-600/80 dark:text-gray-400">Jatuh Tempo</th>
                      <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide text-rose-600/80 dark:text-gray-400">GR</th>
                      <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide text-rose-600/80 dark:text-gray-400">Subtotal</th>
                      <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide text-rose-600/80 dark:text-gray-400">Pajak</th>
                      <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide text-rose-600/80 dark:text-gray-400">Total</th>
                      <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide text-rose-600/80 dark:text-gray-400">Dibayar</th>
                      <th className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide text-rose-600/80 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {(payment.lines ?? []).map((line) => {
                      const isOverdue = line.invoice_due_date && new Date(line.invoice_due_date) < new Date()
                      return (
                        <tr key={line.id} className={apTheme.hoverRow}>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{line.invoice_number}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmtDate(line.invoice_date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-gray-600 dark:text-gray-300">{fmtDate(line.invoice_due_date)}</span>
                            {isOverdue && line.invoice_status !== 'POSTED' && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Overdue</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{line.gr_numbers ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmtCurrency(Number(line.invoice_subtotal))}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmtCurrency(Number(line.invoice_tax))}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmtCurrency(Number(line.invoice_total_amount))}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{fmtCurrency(Number(line.amount_paid))}</td>
                          <td className="px-4 py-3">
                            {line.invoice_status === 'POSTED' ? (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Posted</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{line.invoice_status ?? '—'}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {(payment.lines ?? []).length > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/80">
                        <td colSpan={7} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Total Dibayar</td>
                        <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">{fmtCurrency(totalAllocated)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </section>

            {/* Attachments */}
            {payment.proof_url && (
              <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Bukti Pembayaran</h2>
                </div>
                <div className="p-5">
                  {proofViewUrl ? (
                    <div className="flex items-start gap-4">
                      {/\.(jpe?g|png|webp|heic|heif)$/i.test((payment.proof_url ?? '').split('?')[0]) && (
                        <img src={proofViewUrl} alt="Bukti bayar" className="max-h-32 rounded-lg border border-gray-200 dark:border-gray-600 object-cover" />
                      )}
                      <a href={proofViewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                        <ExternalLink className="w-4 h-4" /> Lihat file
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Memuat bukti…</p>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right Column — Summary + Timeline + Actions */}
          <div className="w-full lg:w-80 shrink-0 space-y-6">
            {/* Payment Summary */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ringkasan</h2>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Alokasi</span>
                  <span className="font-medium text-gray-900 dark:text-white">{fmtCurrency(totalAllocated)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Jumlah Invoice</span>
                  <span className="font-medium text-gray-900 dark:text-white">{payment.invoice_count}</span>
                </div>
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Total Pembayaran</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{fmtCurrency(Number(payment.total_amount))}</span>
                </div>
              </div>
            </section>

            {/* Timeline */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Riwayat</h2>
              </div>
              <div className="p-5">
                <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-4">
                  {timelineSteps.map((step, i) => {
                    const isRejected = 'isRejected' in step && step.isRejected
                    const dotColor = step.done
                      ? isRejected
                        ? 'bg-red-500'
                        : 'bg-emerald-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                    return (
                      <li key={i} className="ml-4">
                        <div className={`absolute -left-[5px] w-2.5 h-2.5 rounded-full ${dotColor}`} style={{ marginTop: '6px' }} />
                        <p className={`text-sm font-medium ${step.done ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                          {step.label}
                        </p>
                        {step.done && step.date && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {fmtDateTime(step.date)}
                            {step.name && <span> · {step.name}</span>}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>
            </section>

            {/* Actions */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-2.5">
              {payment.status === 'DRAFT' && canUpdate && (
                <button type="button" onClick={() => void handleSubmit()} disabled={submit.isPending} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  <Send className="w-4 h-4" /> Ajukan Approval
                </button>
              )}
              {payment.status === 'PENDING_APPROVAL' && canApprove && (
                <>
                  <button type="button" onClick={() => void handleApprove()} disabled={approve.isPending} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Setujui
                  </button>
                  <button type="button" onClick={() => setShowReject(true)} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <XCircle className="w-4 h-4" /> Tolak
                  </button>
                </>
              )}
              {['APPROVED', 'PAID'].includes(payment.status) && canUpdate && (
                <button type="button" onClick={() => setShowProof(true)} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <Upload className="w-4 h-4" /> {payment.proof_url ? 'Update Bukti' : 'Upload Bukti'}
                </button>
              )}

              {payment.status === 'APPROVED' && canUpdate && (
                <>
                  {!allLinesPosted && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      Semua PI harus POSTED sebelum bisa ditandai lunas.
                    </p>
                  )}
                  <button type="button" onClick={() => setShowPayConfirm(true)} disabled={!canMarkPaid} title={!payment.proof_url ? 'Upload bukti dulu' : !allLinesPosted ? 'Tunggu PI POSTED' : undefined} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
                    <Banknote className="w-4 h-4" /> Tandai Sudah Dibayar
                  </button>
                </>
              )}
              {payment.status === 'PAID' && canUpdate && (
                <button type="button" onClick={() => setShowReconcile(true)} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors">
                  Reconcile
                </button>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ApPaymentRejectModal isOpen={showReject} onClose={() => setShowReject(false)} onSubmit={handleReject} isLoading={reject.isPending} />
      <ApPaymentProofModal isOpen={showProof} onClose={() => setShowProof(false)} onSubmit={handleProof} isLoading={uploadProof.isPending} />
      <ConfirmModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={() => void handleDelete()} title="Hapus pembayaran?" message="Draft akan dihapus permanen." confirmText="Hapus" variant="danger" isLoading={deletePayment.isPending} />
      <ConfirmModal isOpen={showPayConfirm} onClose={() => setShowPayConfirm(false)} onConfirm={() => void handleMarkPaid()} title="Tandai sudah dibayar?" message="Pastikan dana sudah keluar dari rekening. Status akan berubah ke PAID." confirmText="Konfirmasi" variant="success" isLoading={markPaid.isPending} />
      {showReconcile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowReconcile(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Link Bank Statement</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Masukkan ID baris mutasi bank dari modul rekonsiliasi.</p>
            <input type="number" value={bankStatementId} onChange={(e) => setBankStatementId(e.target.value)} placeholder="Bank statement ID" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm mb-4" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowReconcile(false)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium">Batal</button>
              <button type="button" onClick={() => void handleReconcile()} disabled={reconcile.isPending || !bankStatementId.trim()} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// --- Helper component ---
function InfoField({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 dark:text-white mt-0.5">{value}</p>
    </div>
  )
}
