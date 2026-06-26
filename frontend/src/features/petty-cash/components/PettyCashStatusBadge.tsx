import type { PettyCashRequestStatus } from '../types/pettyCash.types'

const CONFIG: Record<PettyCashRequestStatus, { label: string; className: string }> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200/80 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-transparent',
  },
  DISBURSED: {
    label: 'Aktif',
    className: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-900/30 dark:text-blue-300 dark:border-transparent',
  },
  CLOSED: {
    label: 'Selesai',
    className: 'bg-green-50 text-green-700 border-green-200/80 dark:bg-green-900/30 dark:text-green-300 dark:border-transparent',
  },
  REJECTED: {
    label: 'Ditolak',
    className: 'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-900/30 dark:text-red-300 dark:border-transparent',
  },
}

export function PettyCashStatusBadge({ status }: { status: PettyCashRequestStatus }) {
  const cfg = CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
