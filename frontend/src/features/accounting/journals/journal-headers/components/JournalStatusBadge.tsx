import { JOURNAL_STATUS_LABELS } from '../../shared/journal.constants'
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

const statusColorClasses: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  APPROVED:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  POSTED:    'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  REVERSED:  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  REJECTED:  'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
}

export const JournalStatusBadge = ({ status, className = '' }: JournalStatusBadgeProps) => {
  const label = JOURNAL_STATUS_LABELS[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        statusColorClasses[status] ?? 'bg-gray-100 text-gray-600'
      } ${className}`}
    >
      {statusIcons[status]}
      {label}
    </span>
  )
}
