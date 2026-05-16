import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { fmtCurrency } from '../utils/format'
import type { MarketplaceCheckoutSession } from '../types/marketplacePo.types'

export function ReceiveConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  session,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  session: MarketplaceCheckoutSession
}) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title="Konfirmasi Barang Diterima"
      confirmText="Ya, Konfirmasi Diterima"
      variant="success"
      message={
        <div className="space-y-3 text-sm text-left">
          <p>Sistem akan otomatis:</p>
          <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-400">
            <li>Membuat Goods Receipt (GR) untuk setiap PO</li>
            <li>Memperbarui stok masuk di gudang tujuan</li>
            <li>Memperbarui status PO</li>
          </ul>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 font-mono text-xs space-y-1">
            <p className="font-semibold mb-1">Journal yang akan di-post:</p>
            <p>Dr 110501 Bahan Baku {fmtCurrency(session.total_amount)}</p>
            <p>Cr 110598 Persediaan Dalam Perjalanan {fmtCurrency(session.total_amount)}</p>
          </div>
          <p className="text-xs text-red-600 font-medium">Tindakan ini tidak dapat dibatalkan.</p>
        </div>
      }
    />
  )
}
