import { AlertTriangle } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { fmtCurrency } from '../utils/format'
import { PlatformBadge } from './SessionStatusBadge'
import type { MarketplaceCheckoutSession, MarketplaceAttachment } from '../types/marketplacePo.types'

export function OrderConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  session,
  attachments,
  lineCount,
  branchCount,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  session: MarketplaceCheckoutSession
  attachments: MarketplaceAttachment[]
  lineCount: number
  branchCount: number
}) {
  const hasBukti = attachments.some((a) => a.file_type === 'BUKTI_BAYAR')
  const ccLabel = session.card_label ?? session.cc_label ?? '-'
  const coaCode = session.coa_code ?? '210602'

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title="Konfirmasi Order Marketplace"
      confirmText="Ya, Konfirmasi Order"
      variant="success"
      message={
        <div className="space-y-4 text-sm text-left">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-500">Platform</p>
              <PlatformBadge platform={session.platform} />
            </div>
            <div>
              <p className="text-xs text-gray-500">CC</p>
              <p className="font-medium">{ccLabel}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-semibold">{fmtCurrency(session.total_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Items</p>
              <p>
                {lineCount} item · {branchCount} cabang
              </p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 font-mono text-xs space-y-1">
            <p className="font-semibold text-gray-600 dark:text-gray-300 mb-2">Journal yang akan di-post:</p>
            <p>Dr 110598 Persediaan Dalam Perjalanan {fmtCurrency(session.total_amount)}</p>
            <p>Cr {coaCode} Hutang CC Owner {fmtCurrency(session.total_amount)}</p>
          </div>
          {!hasBukti ? (
            <p className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Upload bukti bayar (BUKTI_BAYAR) di tab Lampiran terlebih dahulu.
            </p>
          ) : (
            <p className="flex items-start gap-2 text-amber-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Pastikan bukti bayar sudah benar sebelum konfirmasi.
            </p>
          )}
        </div>
      }
    />
  )
}
