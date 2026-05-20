interface MiniSparklineProps {
  values: number[]
  width?: number
  height?: number
  className?: string
}

export function MiniSparkline({
  values,
  width = 90,
  height = 24,
  className = '',
}: MiniSparklineProps) {
  if (!values.length) {
    return (
      <svg width={width} height={height} className={className} aria-hidden>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          className="stroke-gray-200 dark:stroke-gray-700"
          strokeWidth={1}
        />
      </svg>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 2
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * innerW
      const y = pad + innerH - ((v - min) / range) * innerH
      return `${x},${y}`
    })
    .join(' ')

  const trendUp = values[values.length - 1] >= values[0]

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <polyline
        fill="none"
        points={points}
        className={trendUp ? 'stroke-red-400 dark:stroke-red-500' : 'stroke-emerald-400 dark:stroke-emerald-500'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
