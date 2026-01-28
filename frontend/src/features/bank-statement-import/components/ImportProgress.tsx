import { Clock, Loader2, XCircle, CheckCircle, AlertTriangle } from 'lucide-react'

interface ImportProgressProps {
  importId: string
  totalRows: number
  processedRows: number
  status: 'PENDING' | 'ANALYZED' | 'IMPORTING' | 'COMPLETED' | 'FAILED'
  estimatedTimeRemaining?: number
  errorMessage?: string
}

export function ImportProgress({
  importId,
  totalRows,
  processedRows,
  status,
  estimatedTimeRemaining,
  errorMessage,
}: ImportProgressProps) {
  const progress = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0

  const getStatusConfig = () => {
    switch (status) {
      case 'PENDING':
        return { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Menunggu', animate: false }
      case 'IMPORTING':
        return { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Sedang Import', animate: true }
      case 'COMPLETED':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Selesai', animate: false }
      case 'FAILED':
        return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Gagal', animate: false }
      case 'ANALYZED':
        return { icon: AlertTriangle, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Siap Import', animate: false }
      default:
        return { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700', label: status, animate: false }
    }
  }

  const config = getStatusConfig()
  const StatusIcon = config.icon

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bg}`}>
            <StatusIcon className={`w-5 h-5 ${config.color} ${config.animate ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {config.label}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ID: {importId}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {progress}%
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600 dark:text-gray-400">
            {processedRows.toLocaleString()} / {totalRows.toLocaleString()} baris
          </span>
          {typeof estimatedTimeRemaining === 'number' && estimatedTimeRemaining > 0 && (
            <span className="text-gray-500 dark:text-gray-400">
              ~{Math.round(estimatedTimeRemaining / 1000)}s tersisa
            </span>
          )}
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
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

      {/* Error Message */}
      {status === 'FAILED' && errorMessage && (
        <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {errorMessage}
          </p>
        </div>
      )}
    </div>
  )
}

