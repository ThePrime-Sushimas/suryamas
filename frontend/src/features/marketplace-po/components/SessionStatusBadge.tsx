import { STATUS_CONFIG } from '../utils/constants'
import type { MarketplaceSessionStatus } from '../types/marketplacePo.types'

export function SessionStatusBadge({ status }: { status: MarketplaceSessionStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`}
    >
      {cfg.label}
    </span>
  )
}

export function PlatformBadge({ platform }: { platform: 'SHOPEE' | 'TOKOPEDIA' }) {
  const cfg = platform === 'SHOPEE'
    ? { label: 'Shopee', className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' }
    : { label: 'Tokopedia', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
