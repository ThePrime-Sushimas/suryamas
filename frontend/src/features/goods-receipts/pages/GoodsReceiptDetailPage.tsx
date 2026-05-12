import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, PackageCheck, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useGoodsReceipt, useConfirmGoodsReceipt, useInvoiceSignedUrl } from '../api/goodsReceipts.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const VARIANCE_COLORS: Record<string, string> = {
  OK: 'text-green-600 dark:text-green-400',
  NOTICE: 'text-yellow-600 dark:text-yellow-400',
  DISPUTED: 'text-red-600 dark:text-red-400',
}

export default function GoodsReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canUpdate = hasPermission('goods_receipts', 'update')

  const { data: gr, isLoading } = useGoodsReceipt(id ?? '')
  const confirmGR = useConfirmGoodsReceipt()
  const { data: invoiceUrl } = useInvoiceSignedUrl(gr?.invoice_photo_url ?? null)

  const [showConfirm, setShowConfirm] = useState(false)

  const handleConfirm = async () => {
    if (!id) return
    try {
      await confirmGR.mutateAsync({ id })
      toast.success('Barang dikonfirmasi — stok & jurnal tercatat')
      setShowConfirm(false)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal mengkonfirmasi')) }
  }

  if (isLoading) {
    return <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6"><div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}</div></div>
  }

  if (!gr) {
    return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><p className="text-gray-500">Penerimaan barang tidak ditemukan</p></div>
  }

  const hasDisputed = (gr.lines ?? []).some(l => l.variance_status === 'DISPUTED')

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/inventory/goods-receipts')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <PackageCheck className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{gr.gr_number}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{gr.supplier_name} — {gr.branch_name}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${gr.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
              {gr.status === 'CONFIRMED' ? 'Confirmed' : 'Draft'}
            </span>
          </div>

          {gr.status === 'DRAFT' && canUpdate && (
            <div className="flex gap-2">
              <button onClick={() => navigate(`/inventory/goods-receipts/${id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">
                Edit
              </button>
              <button onClick={() => setShowConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
                <CheckCircle className="w-4 h-4" /> Konfirmasi Penerimaan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">PO</span>
            <p className="font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={() => navigate(`/inventory/purchase-orders/${gr.po_id}`)}>{gr.po_number}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Tanggal Terima</span>
            <p className="font-medium text-gray-900 dark:text-white">{fmtDate(gr.received_date)}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Gudang</span>
            <p className="font-medium text-gray-900 dark:text-white">{gr.warehouse_name}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">No. Invoice</span>
            <p className="font-medium text-gray-900 dark:text-white">{gr.invoice_number || '—'}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Foto Invoice</span>
            {invoiceUrl ? (
              <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline font-medium">
                <ExternalLink className="w-3 h-3" /> Lihat Foto
              </a>
            ) : (
              <p className="font-medium text-gray-500">—</p>
            )}
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total Invoice</span>
            <p className="font-bold text-gray-900 dark:text-white">Rp {fmt(gr.total_invoice_amount)}</p>
          </div>
        </div>

        {hasDisputed && gr.status === 'DRAFT' && (
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">Ada selisih harga &gt; 15% yang perlu diperhatikan. Journal tetap akan dibuat saat confirm.</p>
          </div>
        )}
      </div>

      {/* Lines Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga Invoice</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga PO</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Selisih</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {(gr.lines ?? []).map((line, idx) => (
                <tr key={line.id ?? idx}>
                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{line.product_name}</div>
                    <div className="text-xs text-gray-500">{line.product_code} · {line.uom}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">{fmt(line.qty_received)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">Rp {fmt(line.unit_price_invoice)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">Rp {fmt(line.unit_price_po ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={VARIANCE_COLORS[line.variance_status ?? 'OK']}>
                      {(line.price_variance ?? 0) > 0 ? '+' : ''}{fmt(line.price_variance ?? 0)}
                      {(line.price_variance_pct ?? 0) > 0 && <span className="text-xs ml-1">({fmt(line.price_variance_pct ?? 0)}%)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${VARIANCE_COLORS[line.variance_status ?? 'OK']}`}>
                      {line.variance_status === 'DISPUTED' ? '⚠️ Disputed' : line.variance_status === 'NOTICE' ? 'Notice' : '✓'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">Rp {fmt(line.total_price_invoice ?? line.qty_received * line.unit_price_invoice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
              <tr>
                <td colSpan={7} className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">Total:</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">Rp {fmt(gr.total_invoice_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <ConfirmModal isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={handleConfirm}
        title="Konfirmasi Penerimaan Barang"
        message={`Konfirmasi akan:\n• Menambah stok ke gudang\n• Membuat jurnal (Persediaan / Hutang)\n• Update status PO\n\nLanjutkan?`}
        confirmText="Konfirmasi" variant="success" isLoading={confirmGR.isPending} />
    </div>
  )
}
