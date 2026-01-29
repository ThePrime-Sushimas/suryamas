import { FileText, Upload, RefreshCw, Search, Inbox } from 'lucide-react'

interface EmptyStateProps {
  variant?: 'default' | 'upload' | 'search' | 'no-results' | 'error'
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ComponentType<{ className?: string }>
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const variantConfig = {
  default: {
    icon: FileText,
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    iconColor: 'text-gray-400',
  },
  upload: {
    icon: Upload,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    iconColor: 'text-blue-500',
  },
  search: {
    icon: Search,
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    iconColor: 'text-gray-400',
  },
  'no-results': {
    icon: Inbox,
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    iconColor: 'text-gray-400',
  },
  error: {
    icon: RefreshCw,
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    iconColor: 'text-red-500',
  },
}

export function EmptyState({
  variant = 'default',
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${config.bgColor} mb-4`}>
        <Icon className={`w-10 h-10 ${config.iconColor}`} />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">
        {title}
      </h3>
      
      {description && (
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
          {description}
        </p>
      )}

      <div className="flex items-center gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className="btn btn-primary gap-2"
          >
            {action.icon && <action.icon className="w-4 h-4" />}
            {action.label}
          </button>
        )}
        
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="btn btn-ghost gap-2"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}

// Specialized Empty States
export function EmptyUploadState({ onUpload }: { onUpload: () => void }) {
  return (
    <EmptyState
      variant="upload"
      title="Mulai Upload Bank Statement"
      description="Upload file Excel atau CSV mutasi bank untuk diimport ke dalam sistem."
      action={{
        label: 'Upload File',
        onClick: onUpload,
        icon: Upload,
      }}
    />
  )
}

export function EmptySearchState({ onClear, searchTerm }: { onClear: () => void; searchTerm: string }) {
  return (
    <EmptyState
      variant="search"
      title="Pencarian Tidak Ditemukan"
      description={`Tidak ada hasil untuk "${searchTerm}". Coba kata kunci lain atau清除 filter.`}
      action={{
        label: 'Hapus Pencarian',
        onClick: onClear,
        icon: Search,
      }}
    />
  )
}

export function EmptyDataState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <EmptyState
      variant="default"
      title="Tidak Ada Data Import"
      description="Upload file bank statement untuk memulai proses import."
      action={{
        label: 'Refresh Data',
        onClick: onRefresh,
        icon: RefreshCw,
      }}
    />
  )
}

