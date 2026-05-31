import { useParams } from 'react-router-dom'
import { ArrowLeft, Check, X, Loader2, Trash2, Scissors } from 'lucide-react'
import { useStockAdjustment, useConfirmStockAdjustment, useCancelStockAdjustment } from '../api/stockAdjustments.api'
import { useListNavigation } from '@/lib/urlFilters'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useState } from 'react'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CONFIRMED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const REASON_LABEL: Record<string, string> = {
  EXPIRED: 'Expired / Kadaluarsa',
  DAMAGED: 'Rusak',
  CONTAMINATED: 'Terkontaminasi',
  OVERSTOCK: 'Overstock',
  PROCESSING_LOSS: 'Susut Proses',
  OTHER: 'Lainnya',
}

export default function StockAdjustmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { backToList } = useListNavigation('/inventory/stock-adjustments')
  const toast = useToast()

  const { data: adjustment, isLoading } = useStockAdjustment(id ?? '')
  const confirmMutation = useConfirmStockAdjustment()
  const cancelMutation = useCancelStockAdjustment()
  const [showCancelModal, setShowCancelModal] = useState(false)

  const handleConfirm = async () => {
    if (!id) return
    try {
      await confirmMutation.mutateAsync(id)
      toast.success('Adjustment dikonfirmasi — stok sudah diperbarui')
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal konfirmasi'))
    }
  }

  const handleCancel = async () => {
    if (!id) return
    try {
      await cancelMutation.mutateAsync(id)
      toast.success('Adjustment dibatalkan')
      setShowCancelModal(false)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membatalkan'))
    }
  }

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  if (!adjustment) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <p>Adjustment tidak ditemukan</p>
      <button onClick={backToList} className="mt-2 text-blue-500 text-sm">Kembali ke list</button>
    </div>
  )

  const lines = adjustment.lines ?? []
  const outputs = adjustment.outputs ?? []
  const fmt = (n: number) => Number(n).toLocaleString('id-ID')

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={backToList} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">{adjustment.adjustment_number}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[adjustment.status]}`}>{adjustment.status}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${adjustment.adjustment_type === 'WASTE' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {adjustment.adjustment_type === 'WASTE' ? <Trash2 className="w-3 h-3" /> : <Scissors className="w-3 h-3" />}
                  {adjustment.adjustment_type}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{adjustment.branch_name} — {adjustment.warehouse_name}</p>
            </div>
          </div>
          {adjustment.status === 'DRAFT' && (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCancelModal(true)} disabled={cancelMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                <X className="w-4 h-4" /> Batalkan
              </button>
              <button onClick={handleConfirm} disabled={confirmMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium shadow-sm disabled:opacity-50">
                {confirmMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Konfirmasi...</> : <><Check className="w-4 h-4" /> Konfirmasi</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Info */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Tanggal</span>
                <p className="font-medium text-gray-900 dark:text-white">{adjustment.adjustment_date}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Alasan</span>
                <p className="font-medium text-gray-900 dark:text-white">{adjustment.reason ? REASON_LABEL[adjustment.reason] ?? adjustment.reason : '—'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Dikonfirmasi</span>
                <p className="font-medium text-gray-900 dark:text-white">{adjustment.confirmed_by_name ?? '—'}</p>
                {adjustment.confirmed_at && <p className="text-xs text-gray-400">{new Date(adjustment.confirmed_at).toLocaleString('id-ID')}</p>}
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Waste/Susut</span>
                {adjustment.adjustment_type === 'BREAKDOWN' ? (
                  <p className="font-medium text-red-600 dark:text-red-400">{fmt(adjustment.waste_qty)} {adjustment.input_base_unit_name ?? ''}</p>
                ) : (
                  <p className="font-medium text-red-600 dark:text-red-400">{adjustment.line_count} produk dibuang</p>
                )}
              </div>
            </div>
          </div>

          {/* WASTE: show lines */}
          {adjustment.adjustment_type === 'WASTE' && lines.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Produk Dibuang ({lines.length} item)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produk</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Satuan</th>
                      {adjustment.status === 'CONFIRMED' && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cost/Unit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {lines.map((l, idx) => (
                      <tr key={l.id}>
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3"><span className="font-medium text-gray-900 dark:text-white">{l.product_name}</span><span className="ml-2 text-xs text-gray-400 font-mono">{l.product_code}</span></td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">{fmt(l.qty)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{l.base_unit_name ?? '—'}</td>
                        {adjustment.status === 'CONFIRMED' && <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">Rp {fmt(l.cost_per_unit)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BREAKDOWN: show input + outputs */}
          {adjustment.adjustment_type === 'BREAKDOWN' && (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Produk Input</h2>
                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{adjustment.input_product_name ?? '—'}</p>
                    <p className="text-xs text-gray-500 font-mono">{adjustment.input_product_code ?? ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">{fmt(adjustment.input_qty ?? 0)}</p>
                    <p className="text-xs text-gray-500">{adjustment.input_base_unit_name ?? ''}</p>
                  </div>
                  {adjustment.status === 'CONFIRMED' && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Cost/unit</p>
                      <p className="font-mono text-sm text-gray-600 dark:text-gray-400">Rp {fmt(adjustment.input_cost_per_unit)}</p>
                    </div>
                  )}
                </div>
              </div>

              {outputs.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Produk Output ({outputs.length} item)</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produk</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Satuan</th>
                          {adjustment.status === 'CONFIRMED' && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cost/Unit</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {outputs.map((o, idx) => (
                          <tr key={o.id}>
                            <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                            <td className="px-4 py-3"><span className="font-medium text-gray-900 dark:text-white">{o.product_name}</span><span className="ml-2 text-xs text-gray-400 font-mono">{o.product_code}</span></td>
                            <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">{fmt(o.qty)}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{o.base_unit_name ?? '—'}</td>
                            {adjustment.status === 'CONFIRMED' && <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">Rp {fmt(o.cost_per_unit)}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Batalkan Adjustment?</h3>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Batal</button>
              <button onClick={handleCancel} disabled={cancelMutation.isPending} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
                {cancelMutation.isPending ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
