import { useState } from 'react'
import { X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useAdjustStock } from '../api/inventory.api'
import type { StockBalance } from '../types'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

interface Props {
  balance: StockBalance
  onClose: () => void
}

export default function AdjustStockModal({ balance, onClose }: Props) {
  const toast = useToast()
  const [newQty, setNewQty] = useState(balance.qty)
  const [costPerUnit, setCostPerUnit] = useState(balance.avg_cost)
  const [reason, setReason] = useState('')

  const adjustStock = useAdjustStock()
  const diff = newQty - balance.qty

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) { toast.error('Alasan wajib diisi'); return }
    if (diff === 0) { toast.error('Qty baru sama dengan qty saat ini'); return }

    try {
      await adjustStock.mutateAsync({
        warehouse_id: balance.warehouse_id,
        product_id: balance.product_id,
        new_qty: newQty,
        cost_per_unit: costPerUnit,
        reason: reason.trim(),
      })
      toast.success('Stok berhasil disesuaikan')
      onClose()
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyesuaikan stok'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Penyesuaian Stok</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{balance.product_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>

        {/* Info */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Gudang</span>
              <p className="font-medium text-gray-900 dark:text-white">{balance.warehouse_name}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Stok Saat Ini</span>
              <p className="font-medium text-gray-900 dark:text-white">{fmt(balance.qty)} {balance.base_unit_name || ''}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qty Baru (Hasil SO) *</label>
            <input type="number" min="0" value={newQty} onChange={e => setNewQty(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            {diff !== 0 && (
              <p className={`mt-1 text-sm font-medium ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                Selisih: {diff > 0 ? '+' : ''}{fmt(diff)} {balance.base_unit_name || ''}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost per Unit (Rp)</label>
            <input type="number" min="0" value={costPerUnit} onChange={e => setCostPerUnit(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Default: avg cost saat ini. Ubah jika perlu.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alasan *</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Contoh: Hasil SO bulanan Juni 2026"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={adjustStock.isPending || diff === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
              {adjustStock.isPending ? 'Menyimpan...' : 'Simpan Penyesuaian'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
