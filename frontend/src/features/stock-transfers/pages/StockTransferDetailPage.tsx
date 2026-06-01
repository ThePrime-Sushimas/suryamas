import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Loader2, ArrowRightLeft, Printer, Undo2, Pencil } from 'lucide-react'
import { useStockTransfer, useConfirmStockTransfer, useCancelStockTransfer, useReturnLoan } from '../api/stockTransfers.api'
import { useListNavigation } from '@/lib/urlFilters'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useState } from 'react'
import { StockTransferPrintModal } from '../components/StockTransferPrintModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CONFIRMED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  RETURNED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function StockTransferDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { backToList } = useListNavigation('/inventory/stock-transfers')
  const toast = useToast()
  const canUpdate = usePermissionStore(s => s.hasPermission('stock_transfers', 'update'))

  const { data: transfer, isLoading } = useStockTransfer(id ?? '')
  const confirmMutation = useConfirmStockTransfer()
  const cancelMutation = useCancelStockTransfer()
  const returnLoanMutation = useReturnLoan()

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10))

  const handleConfirm = async () => {
    if (!id) return
    try {
      await confirmMutation.mutateAsync(id)
      toast.success('Transfer berhasil dikonfirmasi — stok sudah dipindahkan')
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal konfirmasi transfer'))
    }
  }

  const handleCancel = async () => {
    if (!id) return
    try {
      await cancelMutation.mutateAsync({ id, cancel_reason: cancelReason || undefined })
      toast.success('Transfer dibatalkan')
      setShowCancelModal(false)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membatalkan transfer'))
    }
  }

  const handleReturnLoan = async () => {
    if (!id) return
    if (!returnDate) { toast.error('Pilih tanggal pengembalian'); return }
    try {
      await returnLoanMutation.mutateAsync({ id, return_date: returnDate })
      toast.success('Pinjaman berhasil dikembalikan — stok sudah dipindahkan kembali')
      setShowReturnModal(false)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal mengembalikan pinjaman'))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (!transfer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <p>Transfer tidak ditemukan</p>
        <button onClick={backToList} className="mt-2 text-blue-500 text-sm">Kembali ke list</button>
      </div>
    )
  }

  const lines = transfer.lines ?? []

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={backToList}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">{transfer.transfer_number}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[transfer.status]}`}>
                  {transfer.status}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${transfer.transfer_type === 'LOAN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {transfer.transfer_type}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {transfer.source_branch_name} → {transfer.target_branch_name}
              </p>
            </div>
          </div>

          {/* Actions */}
          {transfer.status === 'DRAFT' && (
            <div className="flex items-center gap-2">
              {canUpdate && (
                <button
                  onClick={() => navigate(`/inventory/stock-transfers/${id}/edit`)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
              )}
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                <X className="w-4 h-4" /> Batalkan
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirmMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {confirmMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Konfirmasi...</>
                  : <><Check className="w-4 h-4" /> Konfirmasi & Transfer</>
                }
              </button>
            </div>
          )}
          {transfer.status === 'CONFIRMED' && (
            <div className="flex items-center gap-2">
              {transfer.transfer_type === 'LOAN' && (
                <button
                  type="button"
                  onClick={() => setShowReturnModal(true)}
                  disabled={returnLoanMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50"
                >
                  {returnLoanMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengembalikan...</>
                    : <><Undo2 className="w-4 h-4" /> Kembalikan Pinjaman</>
                  }
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-900/20 text-sm font-medium transition-colors bg-white dark:bg-gray-800 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print Thermal</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Tanggal</span>
                <p className="font-medium text-gray-900 dark:text-white">{transfer.transfer_date}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Gudang Sumber</span>
                <p className="font-medium text-gray-900 dark:text-white">{transfer.source_warehouse_name}</p>
                <p className="text-xs text-gray-400">{transfer.source_branch_name}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Gudang Tujuan</span>
                <p className="font-medium text-gray-900 dark:text-white">{transfer.target_warehouse_name}</p>
                <p className="text-xs text-gray-400">{transfer.target_branch_name}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Dikonfirmasi</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {transfer.confirmed_by_name ?? '—'}
                </p>
                {transfer.confirmed_at && (
                  <p className="text-xs text-gray-400">{new Date(transfer.confirmed_at).toLocaleString('id-ID')}</p>
                )}
              </div>
            </div>
            {transfer.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                <span className="text-gray-500 dark:text-gray-400 text-xs">Catatan</span>
                <p className="text-sm text-gray-900 dark:text-white">{transfer.notes}</p>
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Produk ({lines.length} item)
            </h2>

            {lines.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Tidak ada produk</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produk</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kode</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Satuan</th>
                      {transfer.status === 'CONFIRMED' && (
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cost/Unit</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {lines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{line.product_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{line.product_code}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                          {Number(line.qty).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{line.base_unit_name || '—'}</td>
                        {transfer.status === 'CONFIRMED' && (
                          <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">
                            {Number(line.cost_per_unit).toLocaleString('id-ID')}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Batalkan Transfer?</h3>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Alasan pembatalan (opsional)"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Loan Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Kembalikan Pinjaman?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Semua barang yang dipinjam akan dikembalikan ke gudang pemberi. Stok akan dipindahkan kembali.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Tanggal Pengembalian <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReturnModal(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleReturnLoan}
                disabled={returnLoanMutation.isPending || !returnDate}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                {returnLoanMutation.isPending ? 'Mengembalikan...' : 'Ya, Kembalikan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Thermal Modal */}
      {showPrintModal && transfer && lines.length > 0 && (
        <StockTransferPrintModal
          transferId={transfer.id}
          lines={lines}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  )
}
