interface VarianceIndicatorProps {
  variancePct: number | null
  threshold: number
}

export function VarianceIndicator({ variancePct, threshold }: VarianceIndicatorProps) {
  if (variancePct == null) {
    return <span className="text-xs text-gray-400">—</span>
  }

  const absVariance = Math.abs(variancePct)
  const exceedsThreshold = absVariance > threshold

  let colorClass = 'text-gray-600 dark:text-gray-400'
  let bgClass = ''

  if (exceedsThreshold) {
    colorClass = 'text-red-700 dark:text-red-300'
    bgClass = 'bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded'
  } else if (absVariance > threshold * 0.5) {
    colorClass = 'text-amber-600 dark:text-amber-400'
  }

  return (
    <span className={`text-xs font-mono font-medium ${colorClass} ${bgClass}`}>
      {variancePct > 0 ? '+' : ''}{variancePct.toFixed(1)}%
    </span>
  )
}
