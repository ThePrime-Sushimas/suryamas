import { 
  Clock, 
  FileCheck, 
  Loader2, 
  CheckCircle, 
  XCircle 
} from 'lucide-react'
import type { BankStatementImportStatus } from '../types/bank-statement-import.types'
import { BANK_STATEMENT_IMPORT_STATUS_LABELS, BANK_STATEMENT_IMPORT_STATUS_COLORS } from '../constants/bank-statement-import.constants'

interface BankStatementImportStatusBadgeProps {
  status: BankStatementImportStatus
  className?: string
}

const statusIcons: Record<BankStatementImportStatus, React.ReactNode> = {
  PENDING: <Clock size={12} />,
  ANALYZED: <FileCheck size={12} />,
  IMPORTING: <Loader2 size={12} className="animate-spin" />,
  COMPLETED: <CheckCircle size={12} />,
  FAILED: <XCircle size={12} />,
}

const colorClasses = {
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  info: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  primary: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
}

export const BankStatementImportStatusBadge = ({ 
  status, 
  className = '' 
}: BankStatementImportStatusBadgeProps) => {
  const label = BANK_STATEMENT_IMPORT_STATUS_LABELS[status]
  const color = BANK_STATEMENT_IMPORT_STATUS_COLORS[status] ?? 'gray'

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        colorClasses[color as keyof typeof colorClasses]
      } ${className}`}
    >
      {statusIcons[status]}
      {label}
    </span>
  )
}

