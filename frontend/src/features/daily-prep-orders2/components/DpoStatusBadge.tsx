import type { DpoStatus } from '../api/dailyPrepOrders.api'

const CONFIG: Record<DpoStatus, { label: string; className: string }> = {
  DRAFT:     { label: 'Draft',     className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600' },
}

export function DpoStatusBadge({ status }: { status: DpoStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.DRAFT
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}