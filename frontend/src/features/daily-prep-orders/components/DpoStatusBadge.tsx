import type { DpoStatus } from '../types/dpo.types'

interface DpoStatusBadgeProps {
  status: DpoStatus
}

const STATUS_STYLES: Record<DpoStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-400',
}

export const DpoStatusBadge = ({ status }: DpoStatusBadgeProps) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}
