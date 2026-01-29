import { Clock, Loader2, XCircle, CheckCircle, AlertTriangle, Pause, RefreshCw } from 'lucide-react'
import type { BankStatementImport } from '../types/bank-statement-import.types'

interface ImportProgressCardProps {
  importData: BankStatementImport
  onCancel?: (id: number) => void
  onRetry?: (id: number) => void
  showErrorMessage?: boolean
}

export function ImportProgressCard({
  importData,
  onCancel,
  onRetry,
  showErrorMessage = true,
}: ImportProgressCardProps) {
  const {
    id,
    status,
    total_rows,
    processed_rows,
    failed_rows,
    file_name,
    error_message,
  } = importData

  const progress = total_rows > 0 
    ? Math.round((processed_rows / total_rows) * 100)
    : 0

  const getStatusConfig = () => {
    switch (status) {
      case 'PENDING':
        return { 
          icon: Clock, 
          color: 'text-yellow-600', 
          bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
          label: 'Menunggu',
          animate: false,
        }
      case 'ANALYZED':
        return { 
          icon: AlertTriangle, 
          color: 'text-blue-600', 
          bg: 'bg-blue-100 dark:bg-blue-900/30', 
          label: 'Siap Import',
          animate: false,
        }
      case 'IMPORTING':
        return { 
          icon: Loader2, 
          color: 'text-blue-600', 
          bg: 'bg-blue-100 dark:bg-blue-900/30', 
          label: 'Sedang Import',
          animate: true,
        }
      case 'COMPLETED':
        return { 
          icon: CheckCircle, 
          color: 'text-green-600', 
          bg: 'bg-green-100 dark:bg-green-900/30', 
          label: 'Selesai',
          animate: false,
        }
      case 'FAILED':
        return { 
          icon: XCircle, 
          color: 'text-red-600', 
          bg: 'bg-red-100 dark:bg-red-900/30', 
          label: 'Gagal',
          animate: false,
        }
      default:
        return { 
          icon: Clock, 
          color: 'text-gray-600', 
          bg: 'bg-gray-100 dark:bg-gray-700', 
          label: status,
          animate: false,
        }
    }
  }

  const config = getStatusConfig()
  const StatusIcon = config.icon

  // Calculate time remaining
  const remainingRows = total_rows - processed_rows
  const progressPerSecond = processed_rows > 0 ? processed_rows / 10 : 0
  const estimatedSeconds = progressPerSecond > 0 ? remainingRows / progressPerSecond : 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <StatusIcon className={`w-5 h-5 ${config.color} ${config.animate ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                {file_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ID: {id}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {status === 'IMPORTING' && onCancel && (
              <button
                onClick={() => onCancel(id)}
                className="btn btn-sm btn-ghost btn-circle text-gray-500 hover:text-red-500"
                title="Batalkan"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            {status === 'FAILED' && onRetry && (
              <button
                onClick={() => onRetry(id)}
                className="btn btn-sm btn-ghost btn-circle text-gray-500 hover:text-blue-500"
                title="Coba Lagi"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
              {config.label}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-400">
            {processed_rows.toLocaleString()} dari {total_rows.toLocaleString()} baris
          </span>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {progress}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              status === 'FAILED' 
                ? 'bg-red-500' 
                : status === 'COMPLETED'
                ? 'bg-green-500'
                : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {status === 'IMPORTING' && estimatedSeconds > 0 && estimatedSeconds < 3600 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Sekitar {Math.round(estimatedSeconds)} detik tersisa
          </p>
        )}
      </div>

      {/* Error Message */}
      {showErrorMessage && status === 'FAILED' && error_message && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">
              {error_message}
            </p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {processed_rows.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Berhasil</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
              0
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Duplikat</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {failed_rows.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gagal</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Mini progress indicator for table rows
export function ImportProgressMini({
  status,
  progress,
}: {
  status: BankStatementImport['status']
  progress: number
}) {
  const getColor = () => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500'
      case 'FAILED': return 'bg-red-500'
      case 'IMPORTING': return 'bg-blue-500'
      default: return 'bg-gray-300'
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8">{progress}%</span>
    </div>
  )
}

