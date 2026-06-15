import { useMemo } from 'react'
import type { WasteRecord, WasteSource } from '../api/wasteReport.api'
import { fmt, fmtRp, SOURCE_LABELS, SOURCE_COLORS } from './wasteReport.constants'

export function ModuleBreakdownBar({ records }: { records: WasteRecord[] }) {
  const breakdown = useMemo(() => {
    const empty = () => ({ qty: 0, cost: 0 })
    const result: Record<WasteSource, { qty: number; cost: number }> = {
      GOODS_PROCESSING: empty(),
      STOCK_ADJUSTMENT: empty(),
      PRODUCTION_ORDER: empty(),
      DAILY_OPNAME: empty(),
    }
    for (const r of records) {
      result[r.source].qty += r.qty
      result[r.source].cost += r.total_cost
    }
    return result
  }, [records])

  const totalCost = useMemo(
    () => Object.values(breakdown).reduce((sum, b) => sum + b.cost, 0),
    [breakdown],
  )

  return (
    <div className="overflow-x-auto">
      <div className="flex items-stretch min-w-max divide-x divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30 text-xs">
        {(Object.keys(SOURCE_LABELS) as WasteSource[]).map((s) => {
          const b = breakdown[s]
          return (
            <div key={s} className="px-3 py-2 flex flex-col gap-0.5 min-w-30">
              <span className={`self-start px-1.5 py-0.5 rounded font-medium ${SOURCE_COLORS[s]}`}>
                {SOURCE_LABELS[s]}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{fmtRp(b.cost)}</span>
              <span className="text-gray-500 tabular-nums">{fmt(b.qty)} qty</span>
            </div>
          )
        })}
        <div className="px-3 py-2 flex flex-col gap-0.5 min-w-22 bg-white/60 dark:bg-gray-800/40">
          <span className="text-gray-500 font-medium">Total</span>
          <span className="font-bold text-gray-900 dark:text-white tabular-nums">{fmtRp(totalCost)}</span>
          <span className="text-gray-500 tabular-nums">{records.length} trx</span>
        </div>
      </div>
    </div>
  )
}

export function ProductionOrderStatusBadge({ record }: { record: WasteRecord }) {
  if (record.source !== 'PRODUCTION_ORDER') return null
  if (record.metadata?.is_voided === true) {
    return (
      <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
        dibatalkan
      </span>
    )
  }
  if (record.metadata?.is_provisional === true) {
    return (
      <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        belum final
      </span>
    )
  }
  return null
}
