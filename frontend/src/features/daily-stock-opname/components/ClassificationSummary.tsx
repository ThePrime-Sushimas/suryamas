import { CheckCircle2 } from 'lucide-react'
import { useOpnameClassifications } from '../api/dailyStockOpname'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClassificationSummaryProps {
  sessionId: string
  enabled: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ClassificationSummary = ({ sessionId, enabled }: ClassificationSummaryProps) => {
  const { data } = useOpnameClassifications(sessionId, enabled)

  if (!data?.summary) return null
  if (!data.summary.is_complete) return null

  const { waste_total, shortage_total } = data.summary

  // Count unique assigned employees from shortage entries
  const assignedEmployees = new Set(
    data.entries
      .filter((e) => e.variance_category === 'SHORTAGE' && e.shortage_assigned_to)
      .map((e) => e.shortage_assigned_to),
  )

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Classified
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Waste: {waste_total.toFixed(2)} | Shortage: {shortage_total.toFixed(2)} | {assignedEmployees.size} karyawan assigned
      </span>
    </div>
  )
}
