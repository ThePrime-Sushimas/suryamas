import { StatusBadge } from '@/components/ui'
import { statusMappings } from '@/lib/theme'
import type { SemanticColorKey } from '@/lib/theme'
import { PI_STATUS_CONFIG } from '../types/purchaseInvoice.status'

interface InvoiceStatusBadgeProps {
  status: string
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = PI_STATUS_CONFIG[status]
  if (!config) return null

  const variant =
    (statusMappings.purchaseInvoice[status] as SemanticColorKey | undefined) ??
    'neutral'
  const label = config.label

  return <StatusBadge variant={variant} label={label} size="sm" />
}
