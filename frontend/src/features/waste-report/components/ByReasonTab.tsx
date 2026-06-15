import { useMemo } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WasteReasonGroup } from '../api/wasteReport.api'
import { OPNAME_REASON_KEY } from '../utils/groupWasteByReason'
import { formatChartAxisRp } from '../utils/chartAxisFormat'
import { EmptyState } from './EmptyState'
import { fmt, fmtRp, SOURCE_LABELS } from './wasteReport.constants'

function ReasonParetoTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: readonly { payload?: WasteReasonGroup & { name: string } }[]
}) {
  if (!active || !payload?.[0]?.payload) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg px-3 py-2.5 text-xs min-w-[200px]">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">{item.reason}</p>
      <p className="text-gray-600 dark:text-gray-300">Nilai: {fmtRp(item.total_cost)}</p>
      <p className="text-gray-600 dark:text-gray-300">Qty: {fmt(item.total_qty)}</p>
      <p className="text-gray-600 dark:text-gray-300">Transaksi: {fmt(item.record_count)}</p>
      <p className="text-gray-600 dark:text-gray-300">% dari total: {fmt(item.percentage_of_total)}%</p>
    </div>
  )
}

export function ByReasonTab({
  groups,
  isLoading,
}: {
  groups: WasteReasonGroup[]
  isLoading: boolean
}) {
  const chartData = useMemo(() => {
    return [...groups]
      .slice(0, 10)
      .sort((a, b) => a.total_cost - b.total_cost)
      .map((g) => ({
        ...g,
        name: g.reason.length > 32 ? `${g.reason.slice(0, 32)}…` : g.reason,
      }))
  }, [groups])

  const onlyOpnameUnspecified =
    groups.length === 1 && groups[0].reason_key === OPNAME_REASON_KEY

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  if (groups.length === 0) {
    return <EmptyState message="Tidak ada waste dengan alasan pada periode ini." />
  }

  const chartHeight = Math.max(240, chartData.length * 40)

  return (
    <div className="space-y-6">
      {onlyOpnameUnspecified && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40">
          <AlertTriangle className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <p className="text-sm text-sky-900 dark:text-sky-200">
            Semua waste pada periode ini berasal dari opname harian tanpa keterangan alasan.
            Tambahkan alasan saat input waste di modul lain untuk analisa lebih detail.
          </p>
        </div>
      )}

      {chartData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Pareto — Top {chartData.length} Alasan
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Berdasarkan total nilai waste
          </p>
          <div style={{ height: chartHeight }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={formatChartAxisRp}
                />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip content={<ReasonParetoTooltip />} />
                <Bar dataKey="total_cost" name="Total Nilai" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.reason_key}
                      fill={entry.is_unspecified ? '#94a3b8' : '#dc2626'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 w-12">Rank</th>
              <th className="px-4 py-3">Alasan</th>
              <th className="px-4 py-3 text-right">Jumlah Transaksi</th>
              <th className="px-4 py-3 text-right">Total Qty</th>
              <th className="px-4 py-3 text-right">Total Nilai</th>
              <th className="px-4 py-3 text-right">% dari Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {groups.map((g, i) => (
              <tr
                key={g.reason_key}
                className={`hover:bg-gray-50/80 dark:hover:bg-gray-900/30 ${
                  g.is_unspecified ? 'text-gray-500 dark:text-gray-400 italic' : ''
                }`}
              >
                <td className="px-4 py-3 tabular-nums">{i + 1}</td>
                <td className="px-4 py-3 font-medium max-w-xs">
                  {g.reason}
                  {g.source_hint && (
                    <span className="ml-2 text-[10px] not-italic font-normal text-gray-400">
                      ({SOURCE_LABELS[g.source_hint]})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(g.record_count)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(g.total_qty)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtRp(g.total_cost)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(g.percentage_of_total)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
