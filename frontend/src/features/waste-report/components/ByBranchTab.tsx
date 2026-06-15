import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
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
import type { WasteBranchGroup } from '../api/wasteReport.api'
import { formatChartAxisRp } from '../utils/chartAxisFormat'
import { EmptyState } from './EmptyState'
import { fmt, fmtRp } from './wasteReport.constants'

export function ByBranchTab({
  groups,
  isLoading,
  branchFiltered,
}: {
  groups: WasteBranchGroup[]
  isLoading: boolean
  branchFiltered: boolean
}) {
  const chartData = useMemo(
    () =>
      [...groups]
        .sort((a, b) => a.total_cost - b.total_cost)
        .map((g) => ({
          name: g.branch_name ?? g.branch_id.slice(0, 8),
          total_cost: g.total_cost,
        })),
    [groups],
  )

  if (branchFiltered) {
    return (
      <EmptyState message="Filter ke 'Semua Cabang' untuk melihat perbandingan antar cabang." />
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  if (groups.length === 0) {
    return <EmptyState message="Tidak ada data waste per cabang pada periode ini." />
  }

  const chartHeight = Math.max(200, groups.length * 44)

  return (
    <div className="space-y-6">
      <div style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={formatChartAxisRp}
            />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
            <Tooltip formatter={(v: number) => fmtRp(v)} />
            <Bar dataKey="total_cost" name="Total Nilai" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={`hsl(${350 - i * 12}, 70%, ${48 + i * 2}%)`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 w-12">Rank</th>
              <th className="px-4 py-3">Cabang</th>
              <th className="px-4 py-3 text-right">Total Nilai</th>
              <th className="px-4 py-3 text-right">Total Qty</th>
              <th className="px-4 py-3 text-right">% dari Total</th>
              <th className="px-4 py-3 text-right">Bongkar Barang</th>
              <th className="px-4 py-3 text-right">Penyesuaian</th>
              <th className="px-4 py-3 text-right">Produksi</th>
              <th className="px-4 py-3 text-right">Opname</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {groups.map((g, i) => (
              <tr key={g.branch_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
                <td className="px-4 py-3 text-gray-500 tabular-nums">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {g.branch_name ?? g.branch_id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtRp(g.total_cost)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(g.total_qty)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {g.percentage_of_total != null ? `${fmt(g.percentage_of_total)}%` : '-'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  {fmtRp(g.breakdown_by_source.GOODS_PROCESSING.cost)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  {fmtRp(g.breakdown_by_source.STOCK_ADJUSTMENT.cost)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  {fmtRp(g.breakdown_by_source.PRODUCTION_ORDER.cost)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  {fmtRp(g.breakdown_by_source.DAILY_OPNAME.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
