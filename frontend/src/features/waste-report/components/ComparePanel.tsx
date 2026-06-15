import { useMemo } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WasteCompareResponse, WasteSource } from '../api/wasteReport.api'
import { formatChartAxisRp } from '../utils/chartAxisFormat'
import { fmt, fmtRp, SOURCE_LABELS } from './wasteReport.constants'

interface ComparePanelProps {
  embedded?: boolean
  open: boolean
  onToggle: () => void
  periodALabel: string
  compareBStart: string
  compareBEnd: string
  onCompareBStartChange: (v: string) => void
  onCompareBEndChange: (v: string) => void
  onCompare: () => void
  compareData?: WasteCompareResponse
  isLoading: boolean
  hasCompareB: boolean
}

export function ComparePanel({
  embedded = false,
  open,
  onToggle,
  periodALabel,
  compareBStart,
  compareBEnd,
  onCompareBStartChange,
  onCompareBEndChange,
  onCompare,
  compareData,
  isLoading,
  hasCompareB,
}: ComparePanelProps) {
  const diffColor =
    compareData == null
      ? 'text-gray-900 dark:text-white'
      : compareData.diff_cost > 0
        ? 'text-red-600 dark:text-red-400'
        : compareData.diff_cost < 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-gray-900 dark:text-white'

  const compareChartData = useMemo(() => {
    if (!compareData) return []
    return (Object.keys(SOURCE_LABELS) as WasteSource[]).map((s) => ({
      source: SOURCE_LABELS[s],
      period_a: compareData.period_a.breakdown_by_source[s].cost,
      period_b: compareData.period_b.breakdown_by_source[s].cost,
    }))
  }, [compareData])

  return (
    <div
      className={
        embedded
          ? 'mt-6 pt-5 border-t border-gray-100 dark:border-gray-700'
          : 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-sm overflow-hidden'
      }
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors ${
          embedded ? 'py-1' : 'px-5 py-4'
        }`}
      >
        <span>Bandingkan dengan periode lain</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className={`space-y-5 ${embedded ? 'pt-4' : 'px-5 pb-5 border-t border-gray-100 dark:border-gray-700'}`}>
          <div className={`flex flex-wrap gap-4 items-end ${embedded ? '' : 'pt-4'}`}>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Periode pembanding — Dari
              </label>
              <input
                type="date"
                value={compareBStart}
                onChange={(e) => onCompareBStartChange(e.target.value)}
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Sampai
              </label>
              <input
                type="date"
                value={compareBEnd}
                onChange={(e) => onCompareBEndChange(e.target.value)}
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={onCompare}
              disabled={!compareBStart || !compareBEnd || isLoading}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Bandingkan
            </button>
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-red-500" />
            </div>
          )}

          {!isLoading && hasCompareB && compareData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Periode ini
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{periodALabel}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-3">
                    {fmtRp(compareData.period_a.total_cost)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Qty: {fmt(compareData.period_a.total_qty)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Periode pembanding
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-3">
                    {fmtRp(compareData.period_b.total_cost)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Qty: {fmt(compareData.period_b.total_qty)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Selisih
                  </p>
                  <p className={`text-xl font-bold mt-3 tabular-nums ${diffColor}`}>
                    {compareData.diff_cost >= 0 ? '+' : ''}
                    {fmtRp(compareData.diff_cost)}
                  </p>
                  <p className={`text-xs mt-1 tabular-nums ${diffColor}`}>
                    {compareData.diff_cost_pct != null
                      ? `${compareData.diff_cost_pct >= 0 ? '+' : ''}${fmt(compareData.diff_cost_pct)}%`
                      : '—'}
                    {' · '}
                    Qty {compareData.diff_qty >= 0 ? '+' : ''}
                    {fmt(compareData.diff_qty)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Breakdown per Modul
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="h-[220px]">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Periode ini</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="source" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartAxisRp} />
                        <Tooltip formatter={(v: number) => fmtRp(v)} />
                        <Bar dataKey="period_a" name="Nilai" fill="#dc2626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[220px]">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Periode pembanding</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="source" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={formatChartAxisRp} />
                        <Tooltip formatter={(v: number) => fmtRp(v)} />
                        <Bar dataKey="period_b" name="Nilai" fill="#64748b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {!isLoading && hasCompareB && !compareData && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Gagal memuat data perbandingan.</p>
          )}
        </div>
      )}
    </div>
  )
}
