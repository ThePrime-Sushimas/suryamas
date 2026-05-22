interface BulkBadgeProps {
  batchId: string
}

export function BulkBadge({ batchId }: BulkBadgeProps) {
  const shortId = batchId.slice(0, 4)

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
      BULK · Batch #{shortId}
    </span>
  )
}
