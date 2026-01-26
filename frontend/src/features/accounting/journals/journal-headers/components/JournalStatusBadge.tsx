import { JOURNAL_STATUS_LABELS, JOURNAL_STATUS_COLORS } from '../../shared/journal.constants'
import type { JournalStatus } from '../../shared/journal.types'
import { FileText, CheckCircle, XCircle, Send, Shield, RotateCcw } from 'lucide-react'

interface JournalStatusBadgeProps {
  status: JournalStatus
  className?: string
}

const statusIcons: Record<string, React.ReactNode> = {
  DRAFT: <FileText size={12} />,
  SUBMITTED: <Send size={12} />,
  APPROVED: <CheckCircle size={12} />,
  POSTED: <Shield size={12} />,
  REVERSED: <RotateCcw size={12} />,
  REJECTED: <XCircle size={12} />,
}

const colorClasses = {
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
}

export const JournalStatusBadge = ({ status, className = '' }: JournalStatusBadgeProps) => {
  const label = JOURNAL_STATUS_LABELS[status]
  const color = JOURNAL_STATUS_COLORS[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        colorClasses[color as keyof typeof colorClasses]
      } ${className}`}
    >
      {statusIcons[status]}
      {label}
    </span>
  )
}

