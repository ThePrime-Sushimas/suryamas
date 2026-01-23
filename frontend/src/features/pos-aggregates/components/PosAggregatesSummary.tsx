/**
 * PosAggregatesSummary.tsx
 * 
 * Summary statistics component for aggregated transactions.
 * Displays key metrics in a card layout.
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
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
        <div className="h-6 bg-gray-200 rounded w-3/4" />
      </div>
    ))}
  </div>
)

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Summary statistics component
 * Displays key metrics for aggregated transactions
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

  const statCards = [
    {
      label: 'Total Transaksi',
      value: formatNumber(summary.total_count),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Total Penjualan Kotor',
      value: formatCurrency(summary.total_gross_amount),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Total Pajak',
      value: formatCurrency(summary.total_tax_amount),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      label: 'Total Discount',
      value: formatCurrency(summary.total_discount_amount),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
      {
        label: 'Total Penjualan Bersih',
        value: formatCurrency(summary.total_net_amount),
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
      },  
  ]

  return (
    <div className={className}>
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <span className={`p-1.5 rounded-lg ${card.bgColor} ${card.color}`}>
                {card.icon}
              </span>
            </div>
            <div className="text-xl font-bold text-gray-900">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesSummary

