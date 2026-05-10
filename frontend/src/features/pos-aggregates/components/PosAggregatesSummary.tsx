/**
 * PosAggregatesSummary.tsx
 *
 * Summary statistics — horizontal scrollable table (slide).
 * Compact styling matching pos-sync-aggregates.
 */

import React from 'react'
import type { AggregatedTransactionSummary } from '../types'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)

interface PosAggregatesSummaryProps {
  summary: AggregatedTransactionSummary | null
  isLoading?: boolean
  className?: string
}

const SummarySkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
            {Array.from({ length: 12 }).map((_, i) => (
              <th key={i} className="px-3 py-2.5">
                <div className="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {Array.from({ length: 12 }).map((_, i) => (
              <td key={i} className="px-3 py-2.5">
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  </div>
)

export const PosAggregatesSummary: React.FC<PosAggregatesSummaryProps> = ({
  summary,
  isLoading = false,
  className = '',
}) => {
  if (isLoading) return <SummarySkeleton />
  if (!summary) return null

  return (
    <div className={className}>
      <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                {[
                  { label: 'Total Transaksi', align: 'left' },
                  { label: 'Gross Amount', align: 'right' },
                  { label: 'Tax', align: 'right' },
                  { label: 'Discount', align: 'right' },
                  { label: 'Service Charge', align: 'right' },
                  { label: 'Bill After Disc', align: 'right' },
                  { label: 'Fee (%)', align: 'right' },
                  { label: 'Fixed Fee', align: 'right' },
                  { label: 'Total Fee', align: 'right' },
                  { label: 'Nett Amount', align: 'right' },
                  { label: 'Selisih Fee', align: 'right' },
                  { label: 'Nett Aktual', align: 'right' },
                ].map((col) => (
                  <th
                    key={col.label}
                    className={`px-3 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {new Intl.NumberFormat('id-ID').format(summary.total_count)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {fmt(summary.total_gross_amount)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    +{fmt(summary.total_tax_amount)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className="text-sm text-red-600 dark:text-red-400">
                    -{fmt(summary.total_discount_amount)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    +{fmt(summary.total_service_charge_amount)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {fmt(summary.total_bill_after_discount)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className="text-sm text-purple-600 dark:text-purple-400">
                    -{fmt(summary.total_percentage_fee_amount)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className="text-sm text-purple-600 dark:text-purple-400">
                    -{fmt(summary.total_fixed_fee_amount)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                    -{fmt(summary.total_fee_amount)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className="text-sm font-bold text-green-700 dark:text-green-400">
                    {fmt(summary.total_nett_amount)}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className={`text-sm font-bold ${
                    summary.total_fee_discrepancy > 0
                      ? 'text-red-600 dark:text-red-400'
                      : summary.total_fee_discrepancy < 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {summary.total_fee_discrepancy !== 0 ? fmt(summary.total_fee_discrepancy) : '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                    {fmt(summary.total_actual_nett_amount)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PosAggregatesSummary
