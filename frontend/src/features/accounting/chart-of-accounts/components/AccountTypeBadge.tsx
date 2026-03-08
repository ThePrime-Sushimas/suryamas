import type { AccountType } from '../types/chart-of-account.types'
import { ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS_DARK } from '../constants/chart-of-account.constants'

interface AccountTypeBadgeProps {
  type: AccountType
  className?: string
}

export const AccountTypeBadge = ({ type, className = '' }: AccountTypeBadgeProps) => {
  const baseColorClass = ACCOUNT_TYPE_COLORS[type] || 'bg-gray-100 text-gray-800'
  const darkModeColorClass = ACCOUNT_TYPE_COLORS_DARK[type] || 'dark:bg-gray-700 dark:text-gray-300'
  const label = ACCOUNT_TYPE_LABELS[type] || 'Unknown'

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${baseColorClass} ${darkModeColorClass} ${className}`}>
      {label}
    </span>
  )
}
