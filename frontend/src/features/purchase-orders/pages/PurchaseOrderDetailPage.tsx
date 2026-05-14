import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, CheckCircle, XCircle, MessageCircle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { PO_STATUS_CONFIG } from '../constants'
import {
  usePurchaseOrder, useMarkSentPurchaseOrder, useMarkOrderedPurchaseOrder, useCancelPurchaseOrder
} from '../api/purchaseOrders.api'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })


export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canUpdate = hasPermission('purchase_orders', 'update')

  const { data: po, isLoading } = usePurchaseOrder(id ?? '')
  const markSent = useMarkSentPurchaseOrder()
  const markOrdered = useMarkOrderedPurchaseOrder()
  const cancelPO = useCancelPurchaseOrder()

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [whatsappNumber, setWhatsappNumber] = useState('')

  // Fetch employees with phone for WhatsApp
  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'with-phone'],
    queryFn: async () => {
      const { data } = await api.get('/employees', { params: { limit: 100 } })
      return (data.data ?? []).filter((e: Record<string, unknown>) => e.mobile_phone) as Array<{ id: string; full_name: string; mobile_phone: string }>
    },
    staleTime: 120_000,
  })
  const employees = employeesData ?? []

  const handleSendToPurchasing = () => {
    setShowWhatsAppModal(true)
  }

  const handleConfirmSend = async () => {
    if (!id) return
    try {
      await markSent.mutateAsync(id)
      toast.success('PO ditandai terkirim')

      // Open WhatsApp if number provided
      if (whatsappNumber.trim() && po) {
        const items = (po.lines ?? []).map((l, i) =>
          `${i + 1}. ${l.product_name} - ${fmt(l.qty)} ${l.uom}`
        ).join('\n')

        const message = `*ORDERAN ${po.branch_name}*\n\n` +
          `• PO: ${po.po_number}\n` +
          `• Tanggal: ${new Date(po.order_date).toLocaleDateString('id-ID')}\n` +
          `• Cabang: ${po.branch_name}\n` +
          `• Supplier: ${po.supplier_name}\n\n` +
          `*DETAIL ITEM*\n${items}` +
          (po.notes ? `\n\n📝 Catatan: ${po.notes}` : '') +
          `\n\n_Dokumen ini digenerate otomatis_`

        let cleanPhone = whatsappNumber.replace(/[^0-9]/g, '')
        if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1)
        if (!cleanPhone.startsWith('62')) cleanPhone = '62' + cleanPhone

        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank')
      }

      setShowWhatsAppModal(false)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal mengirim PO'))
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
    if (!id || !cancelReason.trim()) { toast.error('Alasan pembatalan wajib diisi'); return }
    try {
      await cancelPO.mutateAsync({ id, cancelled_reason: cancelReason.trim() })
      toast.success('PO dibatalkan')
      setShowCancelModal(false)
      setCancelReason('')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membatalkan')) }
  }

  if (isLoading) {
    return <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6"><div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}</div></div>
  }

  if (!po) {
    return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><p className="text-gray-500">Purchase order tidak ditemukan</p></div>
  }

  const statusCfg = PO_STATUS_CONFIG[po.status] ?? PO_STATUS_CONFIG.DRAFT

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/inventory/purchase-orders')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ShoppingCart className="w-6 h-6 text-blue-600 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">{po.po_number}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusCfg.color}`}>{statusCfg.label}</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{po.supplier_name} — {po.branch_name}</p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0 overflow-x-auto">
            {po.status === 'DRAFT' && canUpdate && (
              <button onClick={() => navigate(`/inventory/purchase-orders/${id}/edit`)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap">
                Edit
              </button>
            )}
            {po.status === 'DRAFT' && canUpdate && (
              <button onClick={handleSendToPurchasing} className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap">
                <MessageCircle className="w-4 h-4" /> <span className="hidden sm:inline">Kirim ke</span> Purchasing
              </button>
            )}
            {po.status === 'SENT' && canUpdate && (
              <button onClick={handleMarkOrdered} disabled={markOrdered.isPending}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm whitespace-nowrap">
                <CheckCircle className="w-4 h-4" /> {markOrdered.isPending ? '...' : 'Konfirmasi Order'}
              </button>
            )}
            {['DRAFT', 'SENT'].includes(po.status) && canUpdate && (
              <button onClick={() => setShowCancelModal(true)} className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20 whitespace-nowrap">
                <XCircle className="w-4 h-4" /> Batal
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="px-4 sm:px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Tanggal Order</span>
            <p className="font-medium text-gray-900 dark:text-white">{fmtDate(po.order_date)}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Estimasi Kirim</span>
            <p className="font-medium text-gray-900 dark:text-white">{po.expected_delivery_date ? fmtDate(po.expected_delivery_date) : '—'}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Pembayaran</span>
            <p className="font-medium text-gray-900 dark:text-white">{po.payment_type === 'CASH' ? 'Cash' : `Tempo ${po.payment_terms_days ?? ''}hr`}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Dari PR</span>
            <p className="font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={() => navigate(`/inventory/purchase-requests/${po.purchase_request_id}`)}>{po.request_number}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total</span>
            <p className="font-bold text-gray-900 dark:text-white">Rp {fmt(po.total_amount)}</p>
          </div>
        </div>
        {po.cancelled_reason && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300"><strong>Alasan Pembatalan:</strong> {po.cancelled_reason}</p>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Diterima</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">UOM</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga/Unit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {(po.lines ?? []).map((line, idx) => (
                <tr key={line.id ?? idx}>
                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{line.product_name}</div>
                    <div className="text-xs text-gray-500">{line.product_code}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">{fmt(line.qty)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={line.qty_received && line.qty_received >= line.qty ? 'text-green-600' : 'text-gray-500'}>
                      {fmt(line.qty_received ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{line.uom}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">Rp {fmt(line.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">Rp {fmt(line.total_price ?? line.qty * line.unit_price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">Total:</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">Rp {fmt(po.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {(po.lines ?? []).length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400 text-sm">Tidak ada item</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {(po.lines ?? []).map((line, idx) => (
                  <div key={line.id ?? idx} className="p-4 space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{line.product_name}</p>
                        <p className="text-xs text-gray-500">{line.product_code} · {line.uom}</p>
                      </div>
                      <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white shrink-0 ml-2">Rp {fmt(line.total_price ?? line.qty * line.unit_price)}</p>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <div>
                        <span className="text-gray-500">Qty</span>
                        <p className="font-mono font-medium text-gray-900 dark:text-white">{fmt(line.qty)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Diterima</span>
                        <p className={`font-mono font-medium ${line.qty_received && line.qty_received >= line.qty ? 'text-green-600' : 'text-gray-500'}`}>{fmt(line.qty_received ?? 0)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Harga</span>
                        <p className="font-mono text-gray-600 dark:text-gray-400">Rp {fmt(line.unit_price)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">Rp {fmt(po.total_amount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowWhatsAppModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Kirim ke Purchasing</h3>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                PO akan ditandai sebagai "Dikirim" dan pesan WhatsApp akan dibuka untuk dikirim ke tim purchasing.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pilih Penerima</label>
                <select onChange={e => {
                    const emp = employees.find(x => x.id === e.target.value)
                    if (emp) setWhatsappNumber(emp.mobile_phone)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="">Pilih employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} - {emp.mobile_phone}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomor WhatsApp</label>
                <input type="tel" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                <p className="text-xs text-gray-500 mt-1">Kosongkan jika tidak ingin kirim WA (status tetap berubah)</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowWhatsAppModal(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">
                Batal
              </button>
              <button onClick={handleConfirmSend} disabled={markSent.isPending}
                className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {markSent.isPending ? 'Mengirim...' : <><MessageCircle className="w-4 h-4" /> Kirim</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Batalkan Purchase Order</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alasan Pembatalan *</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder="Jelaskan alasan pembatalan..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Batal</button>
              <button onClick={handleCancel} disabled={cancelPO.isPending || !cancelReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {cancelPO.isPending ? 'Membatalkan...' : 'Batalkan PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
