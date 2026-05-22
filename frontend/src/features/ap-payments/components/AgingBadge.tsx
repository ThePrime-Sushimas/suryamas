import { differenceInCalendarDays, startOfDay, parseISO } from 'date-fns'

interface AgingBadgeProps {
  dueDate: string | null
}

/**
 * Color-coded badge indicating how close an invoice is to (or past) its due date.
 * - Red: overdue (due_date < today)
 * - Amber: due today or within next 7 calendar days (inclusive)
 * - Gray: more than 7 days from today
 */
export function AgingBadge({ dueDate }: AgingBadgeProps) {
  if (!dueDate) return null

  const today = startOfDay(new Date())
  const due = startOfDay(parseISO(dueDate))
  const daysUntilDue = differenceInCalendarDays(due, today)

  let label: string
  let className: string

  if (daysUntilDue < 0) {
    // Overdue
    label = `Overdue ${Math.abs(daysUntilDue)}d`
    className =
      'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
  } else if (daysUntilDue <= 7) {
    // Due today or within 7 days
    label = daysUntilDue === 0 ? 'Due today' : `Due in ${daysUntilDue}d`
    className =
      'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30'
  } else {
    // Safe — more than 7 days
    label = `Due in ${daysUntilDue}d`
    className =
      'text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-700/50'
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
