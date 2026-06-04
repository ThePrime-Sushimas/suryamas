import { Loader2, AlertTriangle } from 'lucide-react'
import { useOpnameAnalysis } from '../api/dailyStockOpname'
import type { AnalysisLineItem } from '../types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AnalysisTabProps {
  sessionId: string
  enabled: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toFixed(2)

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalysisTab({ sessionId, enabled }: AnalysisTabProps) {
  const { data, isLoading, isError, error } = useOpnameAnalysis(sessionId, enabled)

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin mr-2" />
        <span className="text-sm text-gray-500">Memuat analisis...</span>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <span className="text-sm text-red-600">
          {(error as Error)?.message || 'Gagal memuat data analisis'}
        </span>
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!data || data.lines.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm text-gray-400">Tidak ada data analisis</span>
      </div>
    )
  }

  const { lines, summary } = data

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Produk
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Stok Kemarin
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Barang Masuk
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Stok Hari Ini
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Waste
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Konversi
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Pemakaian Riil
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Pemakaian POS
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Gap
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700/60">
          {lines.map((line: AnalysisLineItem) => (
            <tr key={line.product_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
              <td className="px-3 py-3 text-gray-900 dark:text-gray-100">
                <div className="font-medium">{line.product_name}</div>
                <div className="text-xs text-gray-400">{line.product_code} · {line.uom}</div>
              </td>
              <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                {fmt(line.stok_kemarin)}
              </td>
              <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                {fmt(line.barang_masuk)}
              </td>
              <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                {fmt(line.stok_hari_ini)}
              </td>
              <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                {fmt(line.waste)}
              </td>
              <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                {fmt(line.total_konversi)}
              </td>
              <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                {fmt(line.pemakaian_riil)}
              </td>
              <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                {fmt(line.pemakaian_pos)}
              </td>
              <td
                className={`px-3 py-3 text-right font-mono ${
                  line.gap > 0
                    ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {fmt(line.gap)}
              </td>
            </tr>
          ))}

          {/* Summary row */}
          <tr className="font-semibold bg-gray-50 dark:bg-gray-800/60">
            <td className="px-3 py-3 text-gray-900 dark:text-gray-100">
              Total
            </td>
            <td className="px-3 py-3" />
            <td className="px-3 py-3" />
            <td className="px-3 py-3" />
            <td className="px-3 py-3" />
            <td className="px-3 py-3" />
            <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100 font-mono">
              {fmt(summary.total_pemakaian_riil)}
            </td>
            <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100 font-mono">
              {fmt(summary.total_pemakaian_pos)}
            </td>
            <td
              className={`px-3 py-3 text-right font-mono ${
                summary.total_gap > 0
                  ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {fmt(summary.total_gap)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
