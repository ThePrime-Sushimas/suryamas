import { Clock, Loader2, XCircle, CheckCircle } from 'lucide-react'
import type { BankStatementImportStatus } from '../types/bank-statement-import.types'
import { formatImportStatus } from '../utils/format'

interface ImportProgressProps {
  importId: string
  totalRows: number
  processedRows: number
  status: BankStatementImportStatus
  estimatedTimeRemaining?: number
}

export function ImportProgress({
  importId,
  totalRows,
  processedRows,
  status,
  estimatedTimeRemaining,
}: ImportProgressProps) {
  const progress = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0

  const statusConfig: Record<BankStatementImportStatus, { icon: typeof Clock; color: string; bg: string; animate?: boolean }> = {
    PENDING: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    IMPORTING: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', animate: true },
    COMPLETED: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
    FAILED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
    ANALYZED: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  }

  const config = statusConfig[status] || statusConfig.PENDING
  const StatusIcon = config.icon

  return (
    <div className="alert bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <StatusIcon className={`w-5 h-5 ${config.color} ${config.animate ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatImportStatus(status)}
              </span>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-mono">ID: {importId}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {progress}%
            </span>
          </div>
        </div>

        <div className="w-full">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400">
              {processedRows.toLocaleString()} dari {totalRows.toLocaleString()} baris
            </span>
            {typeof estimatedTimeRemaining === 'number' && (
              <span className="text-gray-500 dark:text-gray-400">
                Sisa: ~{Math.round(estimatedTimeRemaining / 1000)} detik
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                status === 'FAILED' 
                  ? 'bg-red-500' 
                  : status === 'COMPLETED'
                  ? 'bg-green-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {status === 'FAILED' && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <XCircle className="w-4 h-4" />
            <span>Import gagal. Silakan coba lagi.</span>
          </div>
        )}
      </div>
    </div>
  )
}

