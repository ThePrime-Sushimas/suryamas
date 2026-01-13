import type { AppliedToType } from '../types/accounting-purpose.types'
import { APPLIED_TO_COLORS } from '../constants/accounting-purpose.constants'

interface AppliedToBadgeProps {
  appliedTo: AppliedToType
  className?: string
}

export const AppliedToBadge = ({ appliedTo, className = '' }: AppliedToBadgeProps) => {
  const colorClass = APPLIED_TO_COLORS[appliedTo]
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}>
      {appliedTo}
    </span>
  )
}