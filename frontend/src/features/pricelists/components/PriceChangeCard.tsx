import { Link } from 'react-router-dom'
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import { MiniSparkline } from './MiniSparkline'
import type { PriceChangeWithRelations } from '../types/pricelist.types'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const fmtPrice = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  PI_POST: { label: 'Invoice', className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  MANUAL: { label: 'Manual', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  PI_UNPOST: { label: 'Unpost', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
}

interface PriceChangeCardProps {
  change: PriceChangeWithRelations
}

export function PriceChangeCard({ change }: PriceChangeCardProps) {
  const pct = change.change_pct
  const isUp = pct != null && pct > 0
  const isDown = pct != null && pct < 0
  const isNew = change.old_price == null
  const badge = SOURCE_BADGE[change.source] ?? SOURCE_BADGE.MANUAL
  const sparkValues = [...change.recent_prices, change.new_price]

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 lg:p-5 shadow-sm hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors duration-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-gray-400">{fmtDate(change.effective_date)}</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
            {pct != null && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isUp
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : isDown
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : null}
                {isUp ? '▲' : isDown ? '▼' : ''} {Math.abs(pct).toFixed(1)}%
              </span>
            )}
            {isNew && (
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                Baru
              </span>
            )}
          </div>

          <div>
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {change.product_name}
              {change.product_code && (
                <span className="ml-2 font-mono text-xs font-normal text-gray-400">{change.product_code}</span>
              )}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {change.supplier_name} · {change.uom_name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {change.old_price != null ? (
              <>
                <span className="text-gray-400 line-through tabular-nums">{fmtPrice(change.old_price)}</span>
                <ArrowRight className="w-4 h-4 text-gray-300" />
              </>
            ) : null}
            <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{fmtPrice(change.new_price)}</span>
          </div>

          {change.purchase_invoice_id && change.invoice_number && (
            <Link
              to={`/inventory/purchase-invoices/${change.purchase_invoice_id}`}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            >
              Dari invoice {change.invoice_number}
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        <div className="flex-shrink-0 self-end sm:self-center">
          <MiniSparkline values={sparkValues} />
        </div>
      </div>
    </div>
  )
}
