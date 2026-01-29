import { Trash2, Download, RefreshCw, CheckCircle, X } from 'lucide-react'

interface BulkActionsBarProps {
  selectedCount: number
  onDelete: () => void
  onExport?: () => void
  onRetry?: () => void
  onConfirmAll?: () => void
  onClearSelection: () => void
  isLoading?: boolean
}

export function BulkActionsBar({
  selectedCount,
  onDelete,
  onExport,
  onRetry,
  onConfirmAll,
  onClearSelection,
  isLoading = false,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-lg border border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">{selectedCount}</span>
                </div>
                <span className="font-medium">Item dipilih</span>
              </div>
              
              <div className="h-6 w-px bg-gray-600" />
              
              <div className="flex items-center gap-2">
                {onDelete && (
                  <button
                    onClick={onDelete}
                    disabled={isLoading}
                    className="btn btn-sm btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/20 gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus
                  </button>
                )}
                
                {onConfirmAll && (
                  <button
                    onClick={onConfirmAll}
                    disabled={isLoading}
                    className="btn btn-sm btn-ghost text-green-400 hover:text-green-300 hover:bg-green-500/20 gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Konfirmasi
                  </button>
                )}
                
                {onRetry && (
                  <button
                    onClick={onRetry}
                    disabled={isLoading}
                    className="btn btn-sm btn-ghost text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Coba Lagi
                  </button>
                )}
                
                {onExport && (
                  <button
                    onClick={onExport}
                    disabled={isLoading}
                    className="btn btn-sm btn-ghost text-gray-300 hover:text-white hover:bg-gray-700 gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={onClearSelection}
              disabled={isLoading}
              className="btn btn-sm btn-ghost text-gray-400 hover:text-white gap-1"
            >
              <X className="w-4 h-4" />
              Batalkan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Simplified version for inline use
export function BulkActionsBarInline({
  selectedCount,
  onDelete,
  onClearSelection,
  isLoading = false,
}: {
  selectedCount: number
  onDelete: () => void
  onClearSelection: () => void
  isLoading?: boolean
}) {
  if (selectedCount === 0) return null

  return (
    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2 mb-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {selectedCount} item dipilih
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onDelete}
          disabled={isLoading}
          className="btn btn-sm btn-error btn-outline gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus
        </button>
        <button
          onClick={onClearSelection}
          disabled={isLoading}
          className="btn btn-sm btn-ghost"
        >
          Batal
        </button>
      </div>
    </div>
  )
}

