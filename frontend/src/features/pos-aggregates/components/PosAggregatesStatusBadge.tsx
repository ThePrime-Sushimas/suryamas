/**
 * PosAggregatesStatusBadge.tsx
 * 
 * Status badge component for aggregated transactions.
 * Provides visual indicators for different transaction statuses.
 */

import React from 'react'
import type { AggregatedTransactionStatus } from '../types'

// =============================================================================
// CONFIGURATION
// =============================================================================

const STATUS_CONFIG: Record<AggregatedTransactionStatus, { label: string; colorClass: string; bgClass: string }> = {
  READY: {
    label: 'READY',
    colorClass: 'text-blue-700 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  PENDING: {
    label: 'PENDING',
    colorClass: 'text-yellow-700 dark:text-yellow-400',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  PROCESSING: {
    label: 'PROCESSING',
    colorClass: 'text-purple-700 dark:text-purple-400',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
  },
  COMPLETED: {
    label: 'COMPLETED',
    colorClass: 'text-green-700 dark:text-green-400',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
  },
  CANCELLED: {
    label: 'CANCELLED',
    colorClass: 'text-red-700 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
  FAILED: {
    label: 'FAILED',
    colorClass: 'text-gray-700 dark:text-gray-400',
    bgClass: 'bg-gray-100 dark:bg-gray-700',
  },
}

// =============================================================================
// PROPS
// =============================================================================

interface PosAggregatesStatusBadgeProps {
  status: AggregatedTransactionStatus
  showReconciled?: boolean
  isReconciled?: boolean
  className?: string
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Status badge component for aggregated transactions
 * Displays transaction status with appropriate color coding
 * Can optionally show reconciled indicator
 */
export const PosAggregatesStatusBadge: React.FC<PosAggregatesStatusBadgeProps> = ({
  status,
  showReconciled = false,
  isReconciled = false,
  className = '',
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.READY

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`
          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          ${config.bgClass} ${config.colorClass}
        `}
      >
        {config.label}
      </span>
      
      {showReconciled && (
        <span
          className={`
            inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
            ${isReconciled 
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' 
              : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
            }
          `}
        >
          {isReconciled ? '✓ Rekonsiliasi' : 'Belum'}
        </span>
      )}
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesStatusBadge

