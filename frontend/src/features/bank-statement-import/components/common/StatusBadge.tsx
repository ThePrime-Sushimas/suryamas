import { Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import type { BankStatementImportStatus } from '../../types/bank-statement-import.types'

interface StatusBadgeProps {
  status: BankStatementImportStatus
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
}

const statusConfig: Record<BankStatementImportStatus, { 
  label: string
  className: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  PENDING: { 
    label: 'Menunggu', 
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800', 
    icon: Clock 
  },
  ANALYZED: { 
    label: 'Dianalisis', 
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800', 
    icon: AlertCircle 
  },
  IMPORTING: { 
    label: 'Mengimport', 
    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800', 
    icon: Loader2 
  },
  COMPLETED: { 
    label: 'Selesai', 
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', 
    icon: CheckCircle 
  },
  FAILED: { 
    label: 'Gagal', 
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800', 
    icon: XCircle 
  },
}

export function StatusBadge({ 
  status, 
  showLabel = true, 
  size = 'md',
  animated = false 
}: StatusBadgeProps) {
  const config = statusConfig[status]
  if (!config) return null

  const Icon = config.icon

  const sizeClasses = {
    sm: 'badge-sm gap-1',
    md: 'gap-1.5',
    lg: 'badge-lg gap-2 px-4 py-3',
  }

  return (
    <span className={`inline-flex items-center border rounded-full font-medium transition-colors ${config.className} ${sizeClasses[size]}`}>
      <Icon className={`w-3.5 h-3.5 ${animated && status === 'IMPORTING' ? 'animate-spin' : ''}`} />
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}

// Compact version untuk table cells
export function StatusBadgeCompact({ status }: { status: BankStatementImportStatus }) {
  const config = statusConfig[status]
  if (!config) return null

  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      <Icon className={`w-3 h-3 ${status === 'IMPORTING' ? 'animate-spin' : ''}`} />
    </span>
  )
}

// Large version untuk cards
export function StatusBadgeLarge({ status }: { status: BankStatementImportStatus }) {
  return <StatusBadge status={status} showLabel size="lg" animated={status === 'IMPORTING'} />
}

// Backward compatibility - alias untuk BankStatementImportStatusBadge
export function BankStatementImportStatusBadge({ 
  status, 
  className = '' 
}: { 
  status: BankStatementImportStatus
  className?: string 
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      <StatusBadge status={status} showLabel size="sm" />
    </span>
  )
}

