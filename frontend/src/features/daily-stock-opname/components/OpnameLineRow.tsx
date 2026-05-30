import { useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { OpnamePhotoUpload } from './OpnamePhotoUpload'
import { VarianceIndicator } from './VarianceIndicator'
import type { DailyClosingCountLine } from '../types'

const fmtQty = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v)

interface OpnameLineRowProps {
  line: DailyClosingCountLine
  sessionId: string
  isEditable: boolean
  threshold: number
  localActual: number | null
  onActualChange: (lineId: string, value: number | null) => void
}

export function OpnameLineRow({
  line,
  sessionId,
  isEditable,
  threshold,
  localActual,
  onActualChange,
}: OpnameLineRowProps) {
  // Client-side variance calculation for immediate feedback
  const actualQty = localActual ?? line.actual_qty
  const varianceQty =
    actualQty != null ? actualQty - line.expected_qty : line.variance_qty
  const variancePct =
    actualQty != null && line.expected_qty > 0
      ? ((actualQty - line.expected_qty) / line.expected_qty) * 100
      : line.variance_pct

  // Determine if row exceeds threshold
  const exceedsThreshold =
    variancePct != null && line.expected_qty > 0 && Math.abs(variancePct) > threshold

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (raw === '') {
        onActualChange(line.id, null)
        return
      }
      const parsed = parseFloat(raw)
      if (!isNaN(parsed) && parsed >= 0) {
        onActualChange(line.id, parsed)
      }
    },
    [line.id, onActualChange],
  )

  // Row highlight for exceeding threshold
  const rowBg = exceedsThreshold
    ? 'bg-red-50/60 dark:bg-red-900/10'
    : ''

  return (
    <tr className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors ${rowBg}`}>
      {/* Product Code */}
      <td className="px-3 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {line.product_code}
      </td>

      {/* Product Name + indicators */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-900 dark:text-white font-medium truncate max-w-[180px]">
            {line.product_name}
          </span>
          {line.is_high_risk && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              HIGH
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {!line.has_recipe && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              ⚠️ No recipe
            </span>
          )}
          {line.has_warning && line.warning_message && (
            <span
              className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5"
              title={line.warning_message}
            >
              <AlertTriangle className="w-3 h-3" />
              {line.warning_message}
            </span>
          )}
        </div>
      </td>

      {/* Expected Qty */}
      <td className="px-3 py-3 text-sm text-right text-gray-700 dark:text-gray-300 font-mono whitespace-nowrap">
        {fmtQty(line.expected_qty)} <span className="text-xs text-gray-400">{line.uom}</span>
      </td>

      {/* Actual Qty (input or display) */}
      <td className="px-3 py-3 text-right">
        {isEditable ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={localActual ?? ''}
            onChange={handleInputChange}
            placeholder="0"
            className="w-20 text-right text-sm font-mono px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        ) : (
          <span className="text-sm font-mono text-gray-900 dark:text-white">
            {fmtQty(line.actual_qty)}
          </span>
        )}
      </td>

      {/* Variance Qty */}
      <td className="px-3 py-3 text-sm text-right font-mono whitespace-nowrap">
        <span
          className={
            varianceQty == null
              ? 'text-gray-400'
              : varianceQty < 0
                ? 'text-red-600 dark:text-red-400'
                : varianceQty > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-600 dark:text-gray-300'
          }
        >
          {varianceQty != null
            ? `${varianceQty >= 0 ? '+' : ''}${fmtQty(varianceQty)}`
            : '—'}
        </span>
      </td>

      {/* Variance % */}
      <td className="px-3 py-3 text-center">
        <VarianceIndicator variancePct={variancePct} threshold={threshold} />
      </td>

      {/* Photo */}
      <td className="px-3 py-3 text-center">
        <OpnamePhotoUpload
          sessionId={sessionId}
          lineId={line.id}
          photoUrl={line.photo_url}
          isHighRisk={line.is_high_risk}
          requiresPhoto={line.requires_photo}
          disabled={!isEditable}
        />
      </td>

      {/* MAIN Balance */}
      <td className="px-3 py-3 text-sm text-right text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
        {fmtQty(line.main_balance)} <span className="text-xs text-gray-400">{line.uom}</span>
      </td>
    </tr>
  )
}
