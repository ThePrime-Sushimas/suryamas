import type { Side } from '../types/accounting-purpose-account.types'
import { SIDE_COLORS } from '../constants/accounting-purpose-account.constants'

interface SideBadgeProps {
  side: Side
  className?: string
}

export const SideBadge = ({ side, className = '' }: SideBadgeProps) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SIDE_COLORS[side]} ${className}`}>
      {side}
    </span>
  )
}