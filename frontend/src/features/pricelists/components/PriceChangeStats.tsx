import { TrendingDown, TrendingUp, Percent } from 'lucide-react'
import type { PriceChangeSummary } from '../types/pricelist.types'

interface PriceChangeStatsProps {
  summary: PriceChangeSummary | undefined
  loading?: boolean
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm animate-pulse">
      <div className="h-4 w-20 bg-gray-100 dark:bg-gray-800 rounded mb-3" />
      <div className="h-8 w-12 bg-gray-100 dark:bg-gray-800 rounded mb-2" />
      <div className="h-3 w-28 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}

export function PriceChangeStats({ summary, loading }: PriceChangeStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
    )
  }

  const cards = [
    {
      label: 'Naik',
      value: summary?.up_count ?? 0,
      sub: 'produk naik harga',
      icon: TrendingUp,
      iconClass: 'text-red-500',
      valueClass: 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Turun',
      value: summary?.down_count ?? 0,
      sub: 'produk turun harga',
      icon: TrendingDown,
      iconClass: 'text-emerald-500',
      valueClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Rata-rata Δ',
      value:
        summary?.avg_change_pct != null
          ? `${summary.avg_change_pct > 0 ? '+' : ''}${summary.avg_change_pct}%`
          : '—',
      sub: 'periode filter',
      icon: Percent,
      iconClass: 'text-indigo-500',
      valueClass: 'text-gray-900 dark:text-white',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
              {card.label}
            </span>
            <card.icon className={`w-4 h-4 ${card.iconClass}`} />
          </div>
          <p className={`text-3xl font-semibold tabular-nums ${card.valueClass}`}>{card.value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}
