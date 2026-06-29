import { StatusBadge } from '@/components/ui'
import { statusMappings } from '@/lib/theme'
import type { SemanticColorKey } from '@/lib/theme'
import type { PettyCashRequestStatus } from '../types/pettyCash.types'
import { PETTY_CASH_STATUS_LABELS } from '../types/pettyCash.status'

export function PettyCashStatusBadge({ status }: { status: PettyCashRequestStatus }) {
  const variant =
    (statusMappings.pettyCash[status] as SemanticColorKey | undefined) ?? 'neutral'
  const label = PETTY_CASH_STATUS_LABELS[status] ?? status

  return <StatusBadge variant={variant} label={label} size="sm" />
}
