import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, FileText, CheckCircle2, XCircle, Send, 
  Trash2, Edit, AlertCircle, ExternalLink, Printer, ClipboardCheck
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { 
  usePurchaseInvoice, 
  useSubmitPurchaseInvoice, 
  useApprovePurchaseInvoice, 
  useRejectPurchaseInvoice, 
  usePostPurchaseInvoice,
  useDeletePurchaseInvoice
} from '../api/purchaseInvoices.api'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtCurrency = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)

const STATUS_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: Send },
  APPROVED: { label: 'Approved', color: 'bg-indigo-100 text-indigo-700', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  POSTED: { label: 'Posted', color: 'bg-green-100 text-green-700', icon: ClipboardCheck },
}

export default function PurchaseInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  
  const canApprove = hasPermission('purchase_invoices', 'approve')
  const canDelete = hasPermission('purchase_invoices', 'delete')

  const { data: inv, isLoading } = usePurchaseInvoice(id ?? '')
  const submitPI = useSubmitPurchaseInvoice()
  const approvePI = useApprovePurchaseInvoice()
  const rejectPI = useRejectPurchaseInvoice()
  const postPI = usePostPurchaseInvoice()
  const deletePI = useDeletePurchaseInvoice()

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  if (isLoading) return <div className="p-8 text-center">Loading detail...</div>
  if (!inv) return <div className="p-8 text-center text-gray-500">Invoice tidak ditemukan</div>

  const handleStatusAction = async (action: () => Promise<any>, successMsg: string) => {
    try {
      await action()
      toast.success(successMsg)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal memproses status'))
    }
  }

  const handleDelete = async () => {
    try {
      await deletePI.mutateAsync(id!)
      toast.success('Invoice dihapus')
      navigate('/inventory/purchase-invoices')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menghapus invoice'))
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/inventory/purchase-invoices')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white truncate">{inv.invoice_number}</h1>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_CONFIG[inv.status].color}`}>
                  {STATUS_CONFIG[inv.status].label}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{inv.supplier_name} — {inv.branch_name}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {inv.status === 'DRAFT' && (
              <>
                {canDelete && (
                  <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors">
                    <Trash2 className="w-4 h-4" /> Hapus
                  </button>
                )}
                <button onClick={() => navigate(`/inventory/purchase-invoices/${id}/edit`)} className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">
                  <Edit className="w-4 h-4" /> Edit
                </button>
                <button onClick={() => handleStatusAction(() => submitPI.mutateAsync(id!), 'Invoice diajukan')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm transition-all">
                  <Send className="w-4 h-4" /> Ajukan
                </button>
              </>
            )}

            {inv.status === 'SUBMITTED' && canApprove && (
              <>
                <button onClick={() => setShowRejectModal(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium shadow-sm transition-all">
                  <XCircle className="w-4 h-4" /> Tolak
                </button>
                <button onClick={() => handleStatusAction(() => approvePI.mutateAsync(id!), 'Invoice disetujui')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm transition-all">
                  <CheckCircle2 className="w-4 h-4" /> Setujui
                </button>
              </>
            )}

            {inv.status === 'APPROVED' && canApprove && (
              <button onClick={() => handleStatusAction(() => postPI.mutateAsync(id!), 'Invoice berhasil di-post')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm transition-all animate-pulse hover:animate-none">
                <ClipboardCheck className="w-4 h-4" /> Post Jurnal
              </button>
            )}
            
            {inv.status === 'POSTED' && (
              <button className="flex items-center gap-2 px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg text-sm font-medium cursor-default">
                <CheckCircle2 className="w-4 h-4" /> Sudah Di-post
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Detail Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tanggal Invoice</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmtDate(inv.invoice_date)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Jatuh Tempo</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{inv.due_date ? fmtDate(inv.due_date) : '—'}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Supplier</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{inv.supplier_name}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Penerimaan Barang (GR)</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {inv.gr_links.map(gl => (
                <span key={gl.id} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                  {gl.goods_receipt_number}
                </span>
              ))}
            </div>
          </div>
        </div>

        {inv.status === 'REJECTED' && inv.rejection_reason && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800 dark:text-red-400">Invoice Ditolak</p>
              <p className="text-sm text-red-700 dark:text-red-300">{inv.rejection_reason}</p>
            </div>
          </div>
        )}

        {/* Lines Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Detail Barang</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left text-[10px] uppercase font-bold tracking-wider">Barang</th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">Qty Received</th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">Qty Invoiced</th>
                  <th className="px-4 py-2 text-right text-[10px] uppercase font-bold tracking-wider">Harga Satuan</th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">PPN %</th>
                  <th className="px-4 py-2 text-right text-[10px] uppercase font-bold tracking-wider">Subtotal</th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">Match Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {inv.lines.map((l, index) => (
                  <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{l.product_name}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{l.product_code}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">{l.qty_received}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">{l.qty_invoiced}</td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium text-gray-900 dark:text-white">{fmtCurrency(l.unit_price)}</p>
                      {l.unit_price !== l.unit_price_po && (
                        <p className="text-[10px] text-yellow-600 font-medium">PO: {fmtCurrency(l.unit_price_po ?? 0)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{l.tax_rate}%</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{fmtCurrency(l.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        l.match_status === 'MATCH' ? 'bg-green-100 text-green-700' :
                        l.match_status === 'OVER' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {l.match_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="bg-gray-50/30 dark:bg-gray-700/30 px-6 py-6 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-end gap-2">
              <div className="flex justify-between w-64 text-sm text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span className="font-medium">{fmtCurrency(inv.subtotal)}</span>
              </div>
              <div className="flex justify-between w-64 text-sm text-gray-600 dark:text-gray-400">
                <span>Total PPN</span>
                <span className="font-medium">{fmtCurrency(inv.total_tax)}</span>
              </div>
              <div className="flex justify-between w-64 pt-3 mt-1 border-t border-gray-200 dark:border-gray-600 font-bold text-xl text-indigo-600 dark:text-indigo-400 tracking-tight">
                <span>TOTAL AKHIR</span>
                <span>{fmtCurrency(inv.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)} 
        onConfirm={handleDelete}
        title="Hapus Invoice" 
        message="Yakin ingin menghapus invoice ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus" 
        variant="danger" 
        isLoading={deletePI.isPending} 
      />

      <ConfirmModal 
        isOpen={showRejectModal} 
        onClose={() => setShowRejectModal(false)} 
        onConfirm={() => handleStatusAction(() => rejectPI.mutateAsync({ id: id!, reason: rejectReason }), 'Invoice ditolak').then(() => setShowRejectModal(false))}
        title="Tolak Invoice" 
        message={
          <div className="space-y-3 pt-2">
            <p className="text-sm text-gray-500">Berikan alasan penolakan agar tim finance dapat merevisi invoice ini.</p>
            <textarea 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Alasan penolakan..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
            />
          </div>
        }
        confirmText="Tolak Invoice" 
        variant="danger" 
        isLoading={rejectPI.isPending} 
      />
    </div>
  )
}
