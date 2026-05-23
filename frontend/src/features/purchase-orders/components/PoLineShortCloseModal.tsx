import { useEffect, useState } from 'react'
import { X, PackageX } from 'lucide-react'
import {
  PO_SHORT_CLOSE_REASONS,
  type PoShortCloseReason,
  type PurchaseOrderLine,
} from '../api/purchaseOrders.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

interface PoLineShortCloseModalProps {
  open: boolean
  line: PurchaseOrderLine | null
  openQty: number
  isPending: boolean
  onClose: () => void
  onConfirm: (payload: {
    po_line_id: string
    qty: number
    reason: PoShortCloseReason
    notes: string | null
  }) => void
}

export function PoLineShortCloseModal({
  open,
  line,
  openQty,
  isPending,
  onClose,
  onConfirm,
}: PoLineShortCloseModalProps) {
  const [qty, setQty] = useState(openQty)
  const [reason, setReason] = useState<PoShortCloseReason>('SUPPLIER_OUT_OF_STOCK')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setQty(openQty)
    setReason('SUPPLIER_OUT_OF_STOCK')
    setNotes('')
  }, [open, openQty, line?.id])

  if (!open || !line?.id) return null

  const invalidQty = qty <= 0 || qty > openQty

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
              <PackageX className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Tutup sisa PO</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[240px]">
                {line.product_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sisa terbuka:{' '}
            <span className="font-bold text-amber-700 dark:text-amber-400">
              {fmt(openQty)} {line.uom}
            </span>
            . Qty ini tidak akan masuk stok dan menandai line PO sebagai lunas untuk bagian yang tidak
            dikirim supplier.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Qty ditutup ({line.uom})
            </label>
            <input
              type="number"
              min={0}
              step="any"
              max={openQty}
              value={qty || ''}
              onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Alasan
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as PoShortCloseReason)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {PO_SHORT_CLOSE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Catatan (opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
              placeholder="Mis. supplier konfirmasi stok kosong minggu ini"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isPending || invalidQty}
            onClick={() =>
              onConfirm({
                po_line_id: line.id!,
                qty,
                reason,
                notes: notes.trim() || null,
              })
            }
            className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium"
          >
            {isPending ? 'Menyimpan...' : 'Tutup sisa'}
          </button>
        </div>
      </div>
    </div>
  )
}
