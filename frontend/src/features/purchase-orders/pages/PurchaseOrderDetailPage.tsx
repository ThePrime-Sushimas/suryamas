import { useState, useEffect } from 'react'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { useParams, useNavigate } from 'react-router-dom'
import { useListNavigation } from '@/lib/urlFilters'
import {
  ArrowLeft,
  ShoppingCart,
  CheckCircle,
  XCircle,
  MessageCircle,
  Save,
  Pencil,
  X,
  Printer,
  FileDown,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { PO_STATUS_CONFIG } from '../constants'
import {
  usePurchaseOrder,
  useUpdatePurchaseOrder,
  useMarkSentPurchaseOrder,
  useMarkOrderedPurchaseOrder,
  useCancelPurchaseOrder,
  useCheckDuplicatePO,
  usePaymentDuePreview,
  type PoPaymentDueInfo,
} from '../api/purchaseOrders.api'
import { PoWhatsAppModal } from '../components/PoWhatsAppModal'
import {
  exportPurchaseOrderPdf,
  openPurchaseOrderWhatsApp,
} from '../utils/purchase-order-document.util'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm'

const PURCHASE_ORDERS_LIST_PATH = '/inventory/purchase-orders'

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { backToList } = useListNavigation(PURCHASE_ORDERS_LIST_PATH)
  const toast = useToast()
  const hasPermission = usePermissionStore((state) => state.hasPermission)
  const canUpdate = hasPermission('purchase_orders', 'update')

  const { data: po, isLoading } = usePurchaseOrder(id ?? '')
  const updatePO = useUpdatePurchaseOrder()
  const markSent = useMarkSentPurchaseOrder()
  const markOrdered = useMarkOrderedPurchaseOrder()
  const cancelPO = useCancelPurchaseOrder()

  const isSent = po?.status === 'SENT'
  /** Purchasing edits payment terms after stock keeper sends PO */
  const canEdit = isSent && canUpdate

  const [isEditing, setIsEditing] = useState(false)
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [whatsAppMode, setWhatsAppMode] = useState<'send' | 'share'>('share')

  useEffect(() => {
    if (!po) return
    setExpectedDate(po.expected_delivery_date?.slice(0, 10) ?? '')
    setNotes(po.notes ?? '')
    setIsEditing(false)
  }, [po?.id, po?.status, po?.expected_delivery_date, po?.notes])

  const { data: duplicateCheck } = useCheckDuplicatePO({
    supplier_id: po?.supplier_id,
    branch_id: po?.branch_id,
    total_amount: isEditing && po && po.total_amount > 0 ? po.total_amount : undefined,
  })

  const debouncedExpectedDate = useDebounce(expectedDate, 300)
  const previewEnabled = Boolean(id) && isEditing
  const { data: duePreview } = usePaymentDuePreview(id ?? '', debouncedExpectedDate, previewEnabled)

  const handleSave = async () => {
    if (!id) return
    try {
      await updatePO.mutateAsync({
        id,
        expected_delivery_date: expectedDate || null,
        notes: notes.trim() || null,
      })
      toast.success('Purchase order disimpan')
      setIsEditing(false)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyimpan'))
    }
  }

  const handleSendToPurchasing = () => {
    setWhatsAppMode('send')
    setShowWhatsAppModal(true)
  }

  const handleOpenWhatsAppShare = () => {
    setWhatsAppMode('share')
    setShowWhatsAppModal(true)
  }

  const handleWhatsAppConfirm = async (phone: string) => {
    if (!po) return
    if (whatsAppMode === 'send') {
      if (!id) return
      try {
        await markSent.mutateAsync(id)
        toast.success('PO ditandai terkirim')
        openPurchaseOrderWhatsApp(po, phone)
        setShowWhatsAppModal(false)
      } catch (err: unknown) {
        toast.error(parseApiError(err, 'Gagal mengirim PO'))
      }
    } else {
      openPurchaseOrderWhatsApp(po, phone)
      setShowWhatsAppModal(false)
    }
  }

  const handleMarkOrdered = async () => {
    if (!id) return
    try {
      await markOrdered.mutateAsync(id)
      toast.success('PO dikonfirmasi sudah di-order ke supplier')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal mengubah status'))
    }
  }

  const handleCancel = async () => {
    if (!id || !cancelReason.trim()) {
      toast.error('Alasan pembatalan wajib diisi')
      return
    }
    try {
      await cancelPO.mutateAsync({ id, cancelled_reason: cancelReason.trim() })
      toast.success('PO dibatalkan')
      setShowCancelModal(false)
      setCancelReason('')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal membatalkan'))
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!po) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Purchase order tidak ditemukan</p>
      </div>
    )
  }

  const statusCfg = PO_STATUS_CONFIG[po.status] ?? PO_STATUS_CONFIG.DRAFT
  const showForm = canEdit && isEditing
  const displayTotal = po.total_amount
  const paymentDueInfo: PoPaymentDueInfo | null = showForm
    ? (duePreview?.payment_due_info ?? po.payment_due_info)
    : po.payment_due_info

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={backToList}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ShoppingCart className="w-6 h-6 text-blue-600 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {po.po_number}
                </h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                {po.supplier_name} — {po.branch_name}
              </p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0 overflow-x-auto">
            {!isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => exportPurchaseOrderPdf(po)}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/inventory/purchase-orders/${po.id}/print`)}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsAppShare}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
              </>
            )}
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
                title="Atur tempo pembayaran dan catatan"
              >
                <Pencil className="w-4 h-4" /> Atur Purchasing
              </button>
            )}
            {canEdit && isEditing && (
              <>
                <button
                  onClick={() => {
                    if (po) {
                      setExpectedDate(po.expected_delivery_date?.slice(0, 10) ?? '')
                      setNotes(po.notes ?? '')
                    }
                    setIsEditing(false)
                  }}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 whitespace-nowrap"
                >
                  <X className="w-4 h-4" /> Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={updatePO.isPending}
                  className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  <Save className="w-4 h-4" /> {updatePO.isPending ? 'Menyimpan...' : 'Simpan'}
                </button>
              </>
            )}
            {po.status === 'DRAFT' && canUpdate && !isEditing && (
              <button
                onClick={handleSendToPurchasing}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />{' '}
                <span className="hidden sm:inline">Kirim ke</span> Purchasing
              </button>
            )}
            {po.status === 'SENT' && canUpdate && !isEditing && (
              <button
                onClick={handleMarkOrdered}
                disabled={markOrdered.isPending}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm whitespace-nowrap"
              >
                <CheckCircle className="w-4 h-4" />{' '}
                {markOrdered.isPending ? '...' : 'Konfirmasi Order'}
              </button>
            )}
            {['DRAFT', 'SENT'].includes(po.status) && canUpdate && !isEditing && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20 whitespace-nowrap"
              >
                <XCircle className="w-4 h-4" /> Batal
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info / Edit form */}
      <div className="px-4 sm:px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {showForm ? (
          <div className="space-y-4">
            <p className="text-sm text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2">
              PO sudah dikirim dari Stock Keeper. Sesuaikan estimasi kirim dan catatan sebelum konfirmasi order.
              Term pembayaran mengikuti master supplier.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Supplier</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{po.supplier_name}</p>
              </div>
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Dari PR</span>
                <button
                  type="button"
                  onClick={() => navigate(`/inventory/purchase-requests/${po.purchase_request_id}`)}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {po.request_number}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estimasi Kirim
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Term pembayaran</span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {duePreview?.payment_term_name ?? po.payment_term_name ?? '—'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opsional"
                  className={inputCls}
                />
              </div>
              <div className="flex items-end">
                <div>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">Total</span>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">Rp {fmt(displayTotal)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Tanggal Order</span>
              <p className="font-medium text-gray-900 dark:text-white">{fmtDate(po.order_date)}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Estimasi Kirim</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {po.expected_delivery_date ? fmtDate(po.expected_delivery_date) : '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Term pembayaran</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {po.payment_term_name ??
                  (po.payment_type === 'CASH' ? 'Tunai' : `Tempo ${po.payment_terms_days ?? ''} hari`)}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Dari PR</span>
              <p
                className="font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                onClick={() => navigate(`/inventory/purchase-requests/${po.purchase_request_id}`)}
              >
                {po.request_number}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Total</span>
              <p className="font-bold text-gray-900 dark:text-white">Rp {fmt(displayTotal)}</p>
            </div>
            {po.notes && (
              <div className="col-span-2 sm:col-span-3 lg:col-span-5">
                <span className="text-gray-500 dark:text-gray-400">Catatan</span>
                <p className="font-medium text-gray-900 dark:text-white">{po.notes}</p>
              </div>
            )}
          </div>
        )}

        {paymentDueInfo && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              paymentDueInfo.confirmed
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
            }`}
          >
            <p className="font-medium text-gray-900 dark:text-white">
              {paymentDueInfo.label}
              {paymentDueInfo.date && (
                <>
                  {': '}
                  {fmtDate(paymentDueInfo.date)}
                  {!paymentDueInfo.confirmed && (
                    <span className="ml-1 text-xs font-normal text-amber-700 dark:text-amber-300">
                      (estimasi)
                    </span>
                  )}
                </>
              )}
              {paymentDueInfo.text && `: ${paymentDueInfo.text}`}
            </p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{paymentDueInfo.hint}</p>
          </div>
        )}

        {po.cancelled_reason && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Alasan Pembatalan:</strong> {po.cancelled_reason}
            </p>
          </div>
        )}

        {showForm && duplicateCheck && duplicateCheck.count > 0 && (
          <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
              Potensi duplikasi PO ({duplicateCheck.count} PO serupa dalam 30 hari)
            </p>
            <div className="mt-2 space-y-1">
              {duplicateCheck.similar_pos.slice(0, 3).map((dup) => (
                <div
                  key={dup.id}
                  className="text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded"
                >
                  {dup.po_number} — Rp {fmt(dup.total_amount)} ({dup.status})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {showForm && (
            <p className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
              Item order ditetapkan oleh Stock Keeper — tidak dapat diubah di tahap ini.
            </p>
          )}
          <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Produk
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Diterima
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        UOM
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Harga/Unit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {(po.lines ?? []).map((line, idx) => (
                      <tr key={line.id ?? idx}>
                        <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {line.product_name}
                          </div>
                          <div className="text-xs text-gray-500">{line.product_code}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                          {fmt(line.qty)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span
                            className={
                              line.qty_received && line.qty_received >= line.qty
                                ? 'text-green-600'
                                : 'text-gray-500'
                            }
                          >
                            {fmt(line.qty_received ?? 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{line.uom}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                          Rp {fmt(line.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                          Rp {fmt(line.total_price ?? line.qty * line.unit_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        Total:
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                        Rp {fmt(po.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="md:hidden">
                {(po.lines ?? []).length === 0 ? (
                  <div className="px-4 py-12 text-center text-gray-400 text-sm">Tidak ada item</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {(po.lines ?? []).map((line, idx) => (
                      <div key={line.id ?? idx} className="p-4 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {line.product_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {line.product_code} · {line.uom}
                            </p>
                          </div>
                          <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white shrink-0 ml-2">
                            Rp {fmt(line.total_price ?? line.qty * line.unit_price)}
                          </p>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <div>
                            <span className="text-gray-500">Qty</span>
                            <p className="font-mono font-medium text-gray-900 dark:text-white">
                              {fmt(line.qty)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Diterima</span>
                            <p
                              className={`font-mono font-medium ${
                                line.qty_received && line.qty_received >= line.qty
                                  ? 'text-green-600'
                                  : 'text-gray-500'
                              }`}
                            >
                              {fmt(line.qty_received ?? 0)}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Harga</span>
                            <p className="font-mono text-gray-600 dark:text-gray-400">
                              Rp {fmt(line.unit_price)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        Rp {fmt(po.total_amount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
        </div>
      </div>

      <PoWhatsAppModal
        open={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        onConfirm={handleWhatsAppConfirm}
        isPending={whatsAppMode === 'send' && markSent.isPending}
        title={whatsAppMode === 'send' ? 'Kirim ke Purchasing' : 'Kirim via WhatsApp'}
        description={
          whatsAppMode === 'send'
            ? 'PO akan ditandai sebagai "Dikirim" dan pesan WhatsApp akan dibuka untuk dikirim ke tim purchasing. Kosongkan nomor jika tidak ingin kirim WA (status tetap berubah).'
            : 'Kirim ringkasan PO ke purchasing atau pihak terkait.'
        }
        confirmLabel={whatsAppMode === 'send' ? 'Kirim' : 'Buka WhatsApp'}
      />

      {/* Cancel Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Batalkan Purchase Order</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alasan Pembatalan *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Jelaskan alasan pembatalan..."
                className={inputCls}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                Batal
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelPO.isPending || !cancelReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {cancelPO.isPending ? 'Membatalkan...' : 'Batalkan PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
