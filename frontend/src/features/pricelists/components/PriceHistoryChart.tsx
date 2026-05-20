import type { PriceChangeChartPoint } from '../types/pricelist.types'

interface PriceHistoryChartProps {
  points: PriceChangeChartPoint[]
  activePrice?: number | null
  height?: number
}

export function PriceHistoryChart({ points, activePrice, height = 160 }: PriceHistoryChartProps) {
  const width = 640
  const pad = { top: 16, right: 16, bottom: 28, left: 56 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400 dark:text-gray-500">
        Belum ada data grafik
      </div>
    )
  }

  const prices = points.map((p) => p.new_price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const coords = points.map((p, i) => ({
    x: pad.left + (i / Math.max(points.length - 1, 1)) * innerW,
    y: pad.top + innerH - ((p.new_price - min) / range) * innerH,
    ...p,
  }))

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${pad.top + innerH} L ${coords[0].x} ${pad.top + innerH} Z`

  const fmtPrice = (n: number) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full h-auto" role="img" aria-label="Grafik riwayat harga">
        <defs>
          <linearGradient id="priceChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(99 102 241 / 0.15)" />
            <stop offset="100%" stopColor="rgb(99 102 241 / 0)" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t) => {
          const y = pad.top + innerH * (1 - t)
          const val = min + range * t
          return (
            <g key={t}>
              <line
                x1={pad.left}
                y1={y}
                x2={width - pad.right}
                y2={y}
                className="stroke-gray-100 dark:stroke-gray-800"
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-400 text-[10px]"
              >
                {fmtPrice(val)}
              </text>
            </g>
          )
        })}

        <path d={areaPath} fill="url(#priceChartFill)" />
        <path
          d={linePath}
          fill="none"
          className="stroke-indigo-500 dark:stroke-indigo-400"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {coords.map((c) => (
          <circle
            key={`${c.effective_date}-${c.x}`}
            cx={c.x}
            cy={c.y}
            r={3}
            className="fill-indigo-500 dark:fill-indigo-400"
          />
        ))}

        {activePrice != null && (
          <line
            x1={pad.left}
            y1={pad.top + innerH - ((activePrice - min) / range) * innerH}
            x2={width - pad.right}
            y2={pad.top + innerH - ((activePrice - min) / range) * innerH}
            className="stroke-emerald-400 dark:stroke-emerald-500"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {coords.length > 0 && (
          <>
            <text x={coords[0].x} y={height - 6} className="fill-gray-400 text-[10px]">
              {coords[0].effective_date.slice(5)}
            </text>
            <text
              x={coords[coords.length - 1].x}
              y={height - 6}
              textAnchor="end"
              className="fill-gray-400 text-[10px]"
            >
              {coords[coords.length - 1].effective_date.slice(5)}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
