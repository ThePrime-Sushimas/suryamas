import type { CashCountStatus } from '../types'

const config: Record<CashCountStatus, { label: string; dot: string; badge: string }> = {
  OPEN: { label: 'Open', dot: 'bg-blue-500', badge: 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' },
  COUNTED: { label: 'Counted', dot: 'bg-amber-500', badge: 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20' },
  DEPOSITED: { label: 'Deposited', dot: 'bg-purple-500', badge: 'text-purple-700 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20' },
  CLOSED: { label: 'Closed', dot: 'bg-green-500', badge: 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20' },
}

export function CashCountStatusBadge({ status }: { status: CashCountStatus }) {
  const v = config[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${v.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.dot}`} />
      {v.label}
    </span>
  )
}
