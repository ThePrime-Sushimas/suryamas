import { PRIORITY_COLORS } from '../constants/accounting-purpose-account.constants'
import { getPriorityLevel } from '../utils/validation'

interface PriorityBadgeProps {
  priority: number
  className?: string
}

export const PriorityBadge = ({ priority, className = '' }: PriorityBadgeProps) => {
  const level = getPriorityLevel(priority)
  const colorClass = PRIORITY_COLORS[level] || 'bg-gray-100 text-gray-800'
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}>
      {priority}
    </span>
  )
}