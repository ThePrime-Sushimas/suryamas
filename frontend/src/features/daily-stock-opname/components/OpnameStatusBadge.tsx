import type { OpnameDisplayStatus } from '../types'

const STATUS_CONFIG: Record<OpnameDisplayStatus, { label: string; className: string }> = {
  DRAFT: {
    label: 'Draft',
    className:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  },
  CONFIRMED: {
    label: 'Confirmed',
    className:
      'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  },
  FLAGGED: {
    label: 'Flagged',
    className:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  },
  MISSED: {
    label: 'Missed',
    className:
      'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600',
  },
  NOT_STARTED: {
    label: 'Not Started',
    className:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600',
  },
}

interface OpnameStatusBadgeProps {
  status: OpnameDisplayStatus
  className?: string
}

export function OpnameStatusBadge({ status, className = '' }: OpnameStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.className} ${className}`}
    >
      {cfg.label}
    </span>
  )
}
