import { useState } from 'react'
import { StatusBadge } from './StatusBadge'
import { ClosePeriodModal } from './ClosePeriodModal'
import type { FiscalPeriodWithDetails } from '../types/fiscal-period.types'

interface FiscalPeriodTableProps {
  periods: FiscalPeriodWithDetails[]
  onEdit: (period: FiscalPeriodWithDetails) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onRefresh?: () => void
  canUpdate: boolean
  canDelete: boolean
}

export function FiscalPeriodTable({ periods, onEdit, onDelete, onRestore, onRefresh, canUpdate, canDelete }: FiscalPeriodTableProps) {
  const [closingPeriod, setClosingPeriod] = useState<FiscalPeriodWithDetails | null>(null)

  const formatDate = (date: string) => {
    const d = new Date(date)
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID')
  }

  const formatDateTime = (date: string) => {
    const d = new Date(date)
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('id-ID')
  }

  const handleCloseSuccess = () => {
    setClosingPeriod(null)
    onRefresh?.()
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Period</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fiscal Year</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Period Start</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Period End</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Year End</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Adjustment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {periods.map((period) => (
              <tr key={period.id} className={period.deleted_at ? 'bg-gray-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{period.period}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{period.fiscal_year}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{formatDate(period.period_start)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{formatDate(period.period_end)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge isOpen={period.is_open} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {period.is_year_end && <span className="text-green-600 dark:text-green-400">✓</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {period.is_adjustment_allowed && <span className="text-blue-600 dark:text-blue-400">✓</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatDateTime(period.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  {period.deleted_at ? (
                    canUpdate && (
                      <button
                        onClick={() => onRestore(period.id)}
                        aria-label={`Restore fiscal period ${period.period}`}
                        className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                      >
                        Restore
                      </button>
                    )
                  ) : (
                    <>
                      {canUpdate && period.is_open && (
                        <>
                          <button
                            onClick={() => onEdit(period)}
                            aria-label={`Edit fiscal period ${period.period}`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setClosingPeriod(period)}
                            aria-label={`Close fiscal period ${period.period}`}
                            className="text-orange-600 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-300"
                          >
                            Close
                          </button>
                        </>
                      )}
                      {canDelete && period.is_open && (
                        <button
                          onClick={() => onDelete(period.id)}
                          aria-label={`Delete fiscal period ${period.period}`}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {closingPeriod && (
        <ClosePeriodModal
          period={closingPeriod}
          isOpen={true}
          onClose={() => setClosingPeriod(null)}
          onSuccess={handleCloseSuccess}
        />
      )}
    </>
  )
}
