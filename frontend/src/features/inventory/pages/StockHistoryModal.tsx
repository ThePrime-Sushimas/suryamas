import { useState } from 'react'
import { X, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useProductHistory } from '../api/inventory.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const MOVEMENT_LABELS: Record<string, string> = {
  IN_PURCHASE: 'Pembelian',
  IN_TRANSFER: 'Transfer Masuk',
  IN_RETURN: 'Pengembalian',
  IN_PRODUCTION: 'Hasil Produksi',
  IN_ADJUSTMENT: 'Penyesuaian (+)',
  IN_OPENING: 'Saldo Awal',
  OUT_TRANSFER: 'Transfer Keluar',
  OUT_LOAN: 'Pinjam Cabang',
  OUT_ADJUSTMENT: 'Penyesuaian (-)',
  OUT_WASTE: 'Waste',
  OUT_PRODUCTION: 'Bahan Produksi',
}

interface Props {
  warehouseId: string
  productId: string
  productName: string
  warehouseName: string
  onClose: () => void
}

export default function StockHistoryModal({ warehouseId, productId, productName, warehouseName, onClose }: Props) {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useProductHistory(warehouseId, productId, { page, limit: 20 })
  const movements = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Riwayat Mutasi</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{productName} — {warehouseName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}
            </div>
          ) : movements.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Belum ada riwayat mutasi</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {movements.map(m => {
                  const isIn = m.qty > 0
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{fmtDate(m.movement_date)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${isIn ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          {isIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {MOVEMENT_LABELS[m.movement_type] || m.movement_type}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${isIn ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {isIn ? '+' : ''}{fmt(m.qty)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-gray-200">{fmt(m.balance_after)}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[150px]">{m.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs text-gray-500">Halaman {pagination.page} dari {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!pagination.hasPrev}
                className="px-3 py-1 text-xs border rounded disabled:opacity-50 dark:border-gray-600 dark:text-gray-300">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={!pagination.hasNext}
                className="px-3 py-1 text-xs border rounded disabled:opacity-50 dark:border-gray-600 dark:text-gray-300">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
