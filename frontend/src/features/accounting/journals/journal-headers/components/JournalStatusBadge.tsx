import { JOURNAL_STATUS_LABELS, JOURNAL_STATUS_COLORS } from '../../shared/journal.constants'
import type { JournalStatus } from '../../shared/journal.types'

interface JournalStatusBadgeProps {
  status: JournalStatus
  className?: string
}

export const JournalStatusBadge = ({ status, className = '' }: JournalStatusBadgeProps) => {
  const label = JOURNAL_STATUS_LABELS[status]
  const color = JOURNAL_STATUS_COLORS[status]

  const colorClasses = {
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-purple-100 text-purple-800',
    red: 'bg-red-100 text-red-800',
    orange: 'bg-orange-100 text-orange-800',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colorClasses[color as keyof typeof colorClasses]
      } ${className}`}
    >
      {label}
    </span>
  )
}
