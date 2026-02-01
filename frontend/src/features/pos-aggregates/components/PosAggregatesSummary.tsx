/**
 * PosAggregatesSummary.tsx
 * 
 * Summary statistics component for aggregated transactions.
 * Displays key metrics in a table layout matching the main table columns.
 */

import React from 'react'
import type { AggregatedTransactionSummary } from '../types'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency to Indonesian Rupiah format
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format number with thousand separators
 */
const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('id-ID').format(value)
}

// =============================================================================
// PROPS
// =============================================================================

interface PosAggregatesSummaryProps {
  summary: AggregatedTransactionSummary | null
  isLoading?: boolean
  className?: string
}

// =============================================================================
// SKELETON
// =============================================================================

const SummarySkeleton: React.FC = () => (
  <div className="w-full overflow-x-auto">
    <table className="w-full border-collapse bg-white rounded-lg shadow">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Transaksi</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Amount</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tax</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Service Charge</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Bill After Discount</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee (%)</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fixed Fee</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fee</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Nett Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        <tr>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <td key={i} className="px-4 py-3">
              <div className="h-6 bg-gray-200 rounded w-full animate-pulse" />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  </div>
)

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Summary statistics component
 * Displays key metrics in a table layout matching the main table columns
 */
export const PosAggregatesSummary: React.FC<PosAggregatesSummaryProps> = ({
  summary,
  isLoading = false,
  className = '',
}) => {
  if (isLoading) {
    return <SummarySkeleton />
  }

  if (!summary) {
    return null
  }

  return (
    <div className={className}>
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-lg shadow">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Total Transaksi
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gross Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tax
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Discount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service Charge
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bill After Discount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fee (%)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fixed Fee
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Fee
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nett Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-sm font-bold text-gray-900">
                  {formatNumber(summary.total_count)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(summary.total_gross_amount)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="text-sm text-gray-600">
                  +{formatCurrency(summary.total_tax_amount)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="text-sm text-red-600">
                  -{formatCurrency(summary.total_discount_amount)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="text-sm text-gray-600">
                  +{formatCurrency(summary.total_service_charge_amount)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="text-sm font-bold text-gray-900">
                  {formatCurrency(summary.total_bill_after_discount)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="text-sm text-purple-600">
                  -{formatCurrency(summary.total_percentage_fee_amount)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="text-sm text-purple-600">
                  -{formatCurrency(summary.total_fixed_fee_amount)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="text-sm font-medium text-purple-700">
                  -{formatCurrency(summary.total_fee_amount)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="text-sm font-bold text-green-700">
                  {formatCurrency(summary.total_nett_amount)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesSummary

