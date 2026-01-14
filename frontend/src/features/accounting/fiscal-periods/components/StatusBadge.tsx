import { FISCAL_PERIOD_STATUS_COLORS, FISCAL_PERIOD_STATUS_LABELS } from '../constants/fiscal-period.constants'

interface StatusBadgeProps {
  isOpen: boolean
}

export function StatusBadge({ isOpen }: StatusBadgeProps) {
  const status = isOpen ? 'OPEN' : 'CLOSED'
  const colorClass = FISCAL_PERIOD_STATUS_COLORS[status]
  const label = FISCAL_PERIOD_STATUS_LABELS[status]

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      role="status"
      aria-label={`Period status: ${label}`}
    >
      {label}
    </span>
  )
}
