import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Filter, Loader2 } from 'lucide-react'
import {
  useWasteVarianceSummary,
  type WasteReportParams,
  type WasteVarianceSummary,
  type WasteSource,
  type VarianceSeverity,
} from '../api/wasteReport.api'
import { fmt, fmtRp, SOURCE_LABELS } from './wasteReport.constants'

const fmtPct = (n: number | null | undefined) =>
  n == null ? '-' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

const SEVERITY_BADGE: Record<VarianceSeverity, { label: string; cls: string }> = {
  OK: { label: 'OK', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  WARNING: { label: 'WARNING', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  CRITICAL: { label: 'CRITICAL', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
}

interface Props {
  params: WasteReportParams | null
}

export default function VarianceSummaryTab({ params }: Props) {
  const { data, isLoading } = useWasteVarianceSummary(params)
  const [onlyUnexplained, setOnlyUnexplained] = useState(false)
  const [onlySevere, setOnlySevere] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleFilterChange = (setter: (v: boolean) => void, value: boolean) => {
    setExpandedId(null)
    setter(value)
  }

  const filteredItems = useMemo(() => {
    if (!data) return []
    let items = data.items
    if (onlyUnexplained) {
      items = items.filter((i) => i.unexplained_qty > 0)
    }
    if (onlySevere) {
      items = items.filter((i) => i.severity === 'WARNING' || i.severity === 'CRITICAL')
    }
    return items
  }, [data, onlyUnexplained, onlySevere])

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-red-500" />
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="text-sm">Tidak ada data variance untuk periode ini.</p>
        <p className="text-xs mt-1">Pastikan ada data penjualan POS dan produksi di range tanggal yang dipilih.</p>
      </div>
    )
  }

  const { totals } = data

  return (
    <div className="space-y-5">
      {/* Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Variance"
          value={fmt(totals.total_variance_qty)}
          sublabel="qty over-usage keseluruhan"
          color="amber"
        />
        <SummaryCard
          label="Total Waste Tercatat"
          value={fmt(totals.total_waste_qty)}
          sublabel="dari 4 sumber terverifikasi"
          color="blue"
        />
        <SummaryCard
          label="Total Unexplained"
          value={fmt(totals.total_unexplained_qty)}
          sublabel={`${totals.items_with_unexplained} item belum terjelaskan`}
          color={totals.total_unexplained_qty > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Warning if unexplained is significant */}
      {totals.total_unexplained_qty > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-900 dark:text-red-200">
            Ada <strong>{fmt(totals.total_unexplained_qty)}</strong> qty pemakaian berlebih yang
            belum bisa dijelaskan dari waste tercatat ({totals.items_with_unexplained} item).
            Investigasi diperlukan.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyUnexplained}
            onChange={(e) => handleFilterChange(setOnlyUnexplained, e.target.checked)}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          Hanya unexplained &gt; 0
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={onlySevere}
            onChange={(e) => handleFilterChange(setOnlySevere, e.target.checked)}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          Hanya WARNING / CRITICAL
        </label>
        <span className="text-xs text-gray-500 ml-auto">
          {filteredItems.length} / {data.items.length} item
        </span>
      </div>

      {/* Empty state after filter */}
      {filteredItems.length === 0 && (onlyUnexplained || onlySevere) && (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            ✓ Semua variance sudah terjelaskan oleh waste tercatat
          </p>
          <p className="text-xs mt-1">Tidak ada item yang memenuhi filter yang dipilih.</p>
        </div>
      )}

      {/* Table */}
      {filteredItems.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Item</th>
                <th className="px-3 py-3 text-right">Aktual</th>
                <th className="px-3 py-3 text-right">Teoretis</th>
                <th className="px-3 py-3 text-right">Variance</th>
                <th className="px-3 py-3 text-right">Waste</th>
                <th className="px-3 py-3 text-right">Unexplained</th>
                <th className="px-3 py-3 text-center">Severity</th>
                <th className="px-3 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filteredItems.map((item) => (
                <VarianceRow
                  key={item.product_id}
                  item={item}
                  expanded={expandedId === item.product_id}
                  onToggle={() =>
                    setExpandedId(expandedId === item.product_id ? null : item.product_id)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Note */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Data variance berdasarkan periode yang sama — item yang date-nya di border range mungkin partial.
        <a
          href="/food-production/consumption"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
        >
          Lihat detail BOM <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  )
}

// ── Sub-components ──

function SummaryCard({
  label,
  value,
  sublabel,
  color,
}: {
  label: string
  value: string
  sublabel: string
  color: 'amber' | 'blue' | 'red' | 'green'
}) {
  const colorMap = {
    amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-800/40',
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-800/40',
    red: 'bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-800/40',
    green: 'bg-green-50 dark:bg-green-950/30 border-green-200/60 dark:border-green-800/40',
  }
  const textMap = {
    amber: 'text-amber-900 dark:text-amber-100',
    blue: 'text-blue-900 dark:text-blue-100',
    red: 'text-red-900 dark:text-red-100',
    green: 'text-green-900 dark:text-green-100',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${textMap[color]}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sublabel}</p>
    </div>
  )
}

function VarianceRow({
  item,
  expanded,
  onToggle,
}: {
  item: WasteVarianceSummary
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900 dark:text-white">{item.product_name}</div>
          <div className="text-xs text-gray-500">
            {item.product_code}{item.uom ? ` · ${item.uom}` : ''}
          </div>
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
          {fmt(item.actual_qty)}
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
          {fmt(item.theoretical_qty)}
        </td>
        <td className="px-3 py-3 text-right tabular-nums">
          <span className={item.variance_qty > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
            {item.variance_qty > 0 ? '+' : ''}{fmt(item.variance_qty)}
          </span>
          {item.variance_pct != null && (
            <span className="block text-xs text-gray-500">
              {fmtPct(item.variance_pct)}
              {item.variance_qty < 0 && (
                <span className="ml-1 text-[10px] text-green-600 dark:text-green-400" title="Pemakaian aktual lebih rendah dari resep">↓</span>
              )}
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
          {fmt(item.waste_qty)}
        </td>
        <td className="px-3 py-3 text-right tabular-nums">
          <span
            className={
              item.unexplained_qty > 0
                ? 'text-red-600 dark:text-red-400 font-semibold'
                : 'text-green-600 dark:text-green-400'
            }
          >
            {item.unexplained_qty > 0 ? fmt(item.unexplained_qty) : '0'}
          </span>
        </td>
        <td className="px-3 py-3 text-center">
          {item.severity && (
            <span
              className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-md ${SEVERITY_BADGE[item.severity].cls}`}
            >
              {SEVERITY_BADGE[item.severity].label}
            </span>
          )}
        </td>
        <td className="px-3 py-3">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-4 py-4 bg-gray-50/50 dark:bg-gray-800/20">
            <VarianceDetail item={item} />
          </td>
        </tr>
      )}
    </>
  )
}

function VarianceDetail({ item }: { item: WasteVarianceSummary }) {
  const sources = (Object.keys(item.waste_breakdown) as WasteSource[]).filter(
    (s) => item.waste_breakdown[s].qty > 0 || item.waste_breakdown[s].cost > 0,
  )

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
        Breakdown Waste per Sumber
      </div>
      {sources.length === 0 ? (
        <p className="text-xs text-gray-500">Tidak ada waste tercatat untuk item ini.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sources.map((s) => (
            <div
              key={s}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800"
            >
              <p className="text-[10px] font-medium text-gray-500 uppercase">{SOURCE_LABELS[s]}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums mt-1">
                {fmt(item.waste_breakdown[s].qty)}{item.uom ? ` ${item.uom}` : ''}
              </p>
              <p className="text-xs text-gray-500 tabular-nums">{fmtRp(item.waste_breakdown[s].cost)}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
        <a
          href="/food-production/consumption"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          Lihat detail BOM & variance di Analisa Konsumsi <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
