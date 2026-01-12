import type { AccountType } from '../types/chart-of-account.types'
import { ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_LABELS } from '../constants/chart-of-account.constants'

interface AccountTypeBadgeProps {
  type: AccountType
  className?: string
}

export const AccountTypeBadge = ({ type, className = '' }: AccountTypeBadgeProps) => {
  const colorClass = ACCOUNT_TYPE_COLORS[type] || 'bg-gray-100 text-gray-800'
  const label = ACCOUNT_TYPE_LABELS[type] || 'Unknown'

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}>
      {label}
    </span>
  )
}