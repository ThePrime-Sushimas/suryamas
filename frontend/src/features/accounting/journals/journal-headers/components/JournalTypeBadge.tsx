import { JOURNAL_TYPE_LABELS } from '../../shared/journal.constants'
import type { JournalType } from '../../shared/journal.types'

interface JournalTypeBadgeProps {
  type: JournalType
  className?: string
}

export const JournalTypeBadge = ({ type, className = '' }: JournalTypeBadgeProps) => {
  const label = JOURNAL_TYPE_LABELS[type]

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 ${className}`}
    >
      {label}
    </span>
  )
}
