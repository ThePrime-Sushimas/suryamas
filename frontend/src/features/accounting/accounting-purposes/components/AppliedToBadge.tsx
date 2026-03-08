import type { AppliedToType } from '../types/accounting-purpose.types'
import { APPLIED_TO_COLORS, APPLIED_TO_COLORS_DARK } from '../constants/accounting-purpose.constants'

interface AppliedToBadgeProps {
  appliedTo: AppliedToType
  className?: string
}

export const AppliedToBadge = ({ appliedTo, className = '' }: AppliedToBadgeProps) => {
  const colorClass = APPLIED_TO_COLORS[appliedTo] || 'bg-gray-100 text-gray-800'
  const colorDarkClass = APPLIED_TO_COLORS_DARK[appliedTo] || 'dark:bg-gray-700 dark:text-gray-300'
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} ${colorDarkClass} ${className}`}>
      {appliedTo}
    </span>
  )
}
