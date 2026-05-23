import { useState, useEffect } from 'react'
import api from '@/lib/axios'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useListNavigation } from '@/lib/urlFilters'
import {
  ArrowLeft,
  Send,
  Banknote,
  Upload,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  BookOpen,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import {
  useApPayment,
  useSubmitApPayment,
  useUploadApPaymentProof,
  useMarkApPaymentPaid,
  usePostApPaymentJournal,
  useDeleteApPaymentJournal,
  useReconcileApPayment,
  useDeleteApPayment,
} from '../api/apPayments.api'
import {
  AP_PAYMENTS_LIST_PATH,
  AP_PAYMENT_METHOD_LABELS,
  AP_STATUS_CONFIG,
  AP_JOURNAL_STATUS_LABELS,
} from '../constants'
import { ApPaymentProofModal } from '../components/ApPaymentProofModal'
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
  const canDelete = hasPermission('ap_payments', 'delete')
  const canRelease = hasPermission('ap_payments', 'release')

  const { data: payment, isLoading } = useApPayment(id ?? '')
  const submit = useSubmitApPayment()
  const uploadProof = useUploadApPaymentProof()
  const markPaid = useMarkApPaymentPaid()
  const postJournal = usePostApPaymentJournal()
  const deleteJournal = useDeleteApPaymentJournal()
  const reconcile = useReconcileApPayment()
  const deletePayment = useDeleteApPayment()

  const [showProof, setShowProof] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [showDeleteJournal, setShowDeleteJournal] = useState(false)
  const [showReconcile, setShowReconcile] = useState(false)
  const [paymentDateInput, setPaymentDateInput] = useState('')
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

  // Initialize payment date input from existing data
  useEffect(() => {
    if (payment?.payment_date) {
      setPaymentDateInput(String(payment.payment_date).slice(0, 10))
    }
  }, [payment?.payment_date])

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
  const canMarkPaid = payment.status === 'APPROVED' && payment.proof_url && allLinesPosted && !!paymentDateInput
  const totalAllocated = (payment.lines ?? []).reduce((s, l) => s + Number(l.amount_paid), 0)
  const journalPosted = payment.journal_status === 'POSTED'
  const canPostJournal =
    canUpdate &&
    !!payment.journal_id &&
    !journalPosted &&
    ['PAID', 'RECONCILED'].includes(payment.status)
  const canDeleteJournal =
    canRelease &&
    !!payment.journal_id &&
    ['PAID', 'RECONCILED'].includes(payment.status)

  const handleSubmit = async () => { if (!id) return; try { await submit.mutateAsync(id); toast.success('Pembayaran diajukan') } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal submit')) } }
  const handleProof = async (file: File) => { if (!id) return; try { await uploadProof.mutateAsync({ id, file }); toast.success('Bukti bayar disimpan') } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal upload bukti')); throw err } }
  const handleMarkPaid = async () => { if (!id) return; try { await markPaid.mutateAsync({ id, payment_date: paymentDateInput || new Date().toISOString().slice(0, 10) }); toast.success('Status: sudah dibayar — journal draft dibuat'); setShowPayConfirm(false) } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menandai lunas')) } }
  const handlePostJournal = async () => { if (!id) return; try { await postJournal.mutateAsync(id); toast.success('Journal berhasil di-post') } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal post journal')) } }
  const handleDeleteJournal = async () => { if (!id) return; try { await deleteJournal.mutateAsync(id); toast.success('Journal dihapus — status kembali ke Menunggu Pembayaran'); setShowDeleteJournal(false) } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal hapus journal')) } }
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
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            <div className="max-w-[180px] truncate whitespace-nowrap">
                              {line.invoice_number}
                            </div>
                          </td>
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

            {payment.journal_id && (
              <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-violet-600" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Journal Pembayaran</h2>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                      {payment.journal_number ?? payment.journal_id.slice(0, 8)}
                    </span>
                    {payment.journal_status && (
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${journalPosted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                        {AP_JOURNAL_STATUS_LABELS[payment.journal_status] ?? payment.journal_status}
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/accounting/journals/${payment.journal_id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
                  >
                    <ExternalLink className="w-4 h-4" /> Lihat journal
                  </Link>
                  {!journalPosted && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Journal dibuat otomatis saat ditandai dibayar. Post journal untuk mencatat ke buku besar.
                    </p>
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
                  <Send className="w-4 h-4" /> Ajukan Pembayaran
                </button>
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
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tanggal Bayar</label>
                    <input
                      type="date"
                      value={paymentDateInput}
                      onChange={(e) => setPaymentDateInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-rose-200/90 dark:border-gray-600 bg-[#fff9f7] dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                      placeholder="Pilih tanggal bayar"
                    />
                  </div>
                  <button type="button" onClick={() => setShowPayConfirm(true)} disabled={!canMarkPaid} title={!payment.proof_url ? 'Upload bukti dulu' : !allLinesPosted ? 'Tunggu PI POSTED' : !paymentDateInput ? 'Isi tanggal bayar dulu' : undefined} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
                    <Banknote className="w-4 h-4" /> Tandai Sudah Dibayar
                  </button>
                </>
              )}
              {payment.status === 'PAID' && canUpdate && (
                <button type="button" onClick={() => setShowReconcile(true)} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors">
                  Reconcile
                </button>
              )}
              {canPostJournal && (
                <button type="button" onClick={() => void handlePostJournal()} disabled={postJournal.isPending} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors">
                  <Send className="w-4 h-4" /> {postJournal.isPending ? 'Memproses...' : 'Post Journal'}
                </button>
              )}
              {canDeleteJournal && (
                <button type="button" onClick={() => setShowDeleteJournal(true)} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors">
                  <Trash2 className="w-4 h-4" /> Hapus Journal
                </button>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ApPaymentProofModal isOpen={showProof} onClose={() => setShowProof(false)} onSubmit={handleProof} isLoading={uploadProof.isPending} />
      <ConfirmModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={() => void handleDelete()} title="Hapus pembayaran?" message="Draft akan dihapus permanen." confirmText="Hapus" variant="danger" isLoading={deletePayment.isPending} />
      <ConfirmModal isOpen={showPayConfirm} onClose={() => setShowPayConfirm(false)} onConfirm={() => void handleMarkPaid()} title="Tandai sudah dibayar?" message="Pastikan dana sudah keluar dari rekening. Status akan berubah ke PAID dan journal draft otomatis dibuat." confirmText="Konfirmasi" variant="success" isLoading={markPaid.isPending} />
      <ConfirmModal isOpen={showDeleteJournal} onClose={() => setShowDeleteJournal(false)} onConfirm={() => void handleDeleteJournal()} title="Hapus journal?" message="Journal akan dihapus permanen dan status pembayaran kembali ke Menunggu Pembayaran (APPROVED). Bukti bayar tetap tersimpan." confirmText="Hapus Journal" variant="danger" isLoading={deleteJournal.isPending} />
      {showReconcile && (
        <ReconcileModal
          paymentId={id!}
          onClose={() => setShowReconcile(false)}
          onConfirm={async (statementId: number) => {
            try {
              await reconcile.mutateAsync({ id: id!, bank_statement_id: statementId })
              toast.success('Reconciled')
              setShowReconcile(false)
            } catch (err: unknown) {
              toast.error(parseApiError(err, 'Gagal reconcile'))
            }
          }}
          isLoading={reconcile.isPending}
        />
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

// --- Reconcile Modal with inline picker ---
interface ReconcileModalProps {
  paymentId: string
  onClose: () => void
  onConfirm: (statementId: number) => Promise<void>
  isLoading: boolean
}

function ReconcileModal({ paymentId, onClose, onConfirm, isLoading }: ReconcileModalProps) {
  const [candidates, setCandidates] = useState<Array<{ id: number; transaction_date: string; description: string; debit_amount: number; credit_amount: number; reference_number: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    api.get(`/ap-payments/${paymentId}/reconcile-candidates`)
      .then((res) => setCandidates(res.data?.data ?? []))
      .catch(() => { setFetchError(true); setCandidates([]) })
      .finally(() => setLoading(false))
  }, [paymentId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rose-900/12 dark:bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#fff9f7] dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full mx-4 border border-rose-200/85 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-rose-200 dark:border-gray-700">
          <h3 className="font-semibold text-rose-950 dark:text-white">Reconcile — Pilih Mutasi Bank</h3>
          <p className="text-xs text-rose-700/65 dark:text-gray-400 mt-0.5">Pilih baris mutasi bank yang sesuai dengan pembayaran ini</p>
        </div>
        <div className="p-5 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
            </div>
          ) : fetchError ? (
            <p className="text-sm text-red-600 dark:text-red-400 text-center py-8">Gagal memuat data mutasi bank</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-rose-700/65 dark:text-gray-400 text-center py-8">Tidak ada mutasi bank yang cocok</p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const isSelected = selectedId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      isSelected
                        ? 'border-rose-400 bg-rose-50 dark:border-blue-500 dark:bg-blue-900/20'
                        : 'border-rose-200/80 dark:border-gray-600 hover:border-rose-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.description || '—'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {fmtDate(c.transaction_date)}
                          {c.reference_number && ` · Ref: ${c.reference_number}`}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {fmtCurrency(c.debit_amount)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-rose-200 dark:border-gray-700 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-2xl border border-rose-200 dark:border-gray-600 text-sm font-medium">Batal</button>
          <button
            type="button"
            onClick={() => selectedId && void onConfirm(selectedId)}
            disabled={!selectedId || isLoading}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 text-white text-sm font-medium disabled:opacity-50 dark:bg-blue-600 dark:from-blue-600 dark:to-blue-600"
          >
            {isLoading ? 'Menyimpan...' : 'Reconcile'}
          </button>
        </div>
      </div>
    </div>
  )
}
