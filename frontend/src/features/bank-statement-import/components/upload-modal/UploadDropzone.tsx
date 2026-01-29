import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileSpreadsheet, AlertCircle, Loader2, FileCheck, FileType } from 'lucide-react'

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  selectedFile: File | null
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  isLoading?: boolean
  uploadProgress?: number
  error?: string | null
  accept?: string
  maxSize?: number // in bytes
}

export function UploadDropzone({
  onFileSelect,
  onFileRemove,
  selectedFile,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  isLoading = false,
  uploadProgress = 0,
  error,
  accept = '.xlsx,.xls,.csv',
  maxSize = 50 * 1024 * 1024, // 50MB
}: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const handleClick = () => {
    if (!selectedFile && !isLoading) {
      fileInputRef.current?.click()
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      return <FileType className="w-10 h-10 text-green-500" />
    }
    return <FileSpreadsheet className="w-10 h-10 text-blue-500" />
  }

  const getFileTypeLabel = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext === 'csv') return 'CSV File'
    if (ext === 'xlsx') return 'Excel File'
    if (ext === 'xls') return 'Excel File'
    return 'Spreadsheet'
  }

  return (
    <div className="w-full">
      {/* Dropzone Area */}
      {!selectedFile ? (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={handleClick}
          className={`
            relative group
            border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer
            transition-all duration-300 ease-out
            ${isDragOver
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-[0.99]'
              : 'border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30 hover:border-blue-400/50 hover:bg-gray-100/50 dark:hover:bg-gray-700/50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileChange}
            disabled={isLoading}
          />

          {/* Icon with glow effect */}
          <div className="relative mb-6">
            <div className={`
              absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full blur-xl
              transition-opacity duration-300
              ${isDragOver ? 'bg-blue-400/30 opacity-100' : 'bg-gray-200/50 dark:bg-gray-700/50 opacity-0 group-hover:opacity-100'}
            `} />
            <div className={`
              relative inline-flex items-center justify-center w-16 h-16 rounded-2xl
              transition-all duration-300 shadow-sm
              ${isDragOver 
                ? 'bg-blue-600 text-white shadow-blue-500/30 scale-110 rotate-3' 
                : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 group-hover:scale-105'
              }
            `}>
              {isDragOver ? (
                <Upload className="w-8 h-8" />
              ) : (
                <FileSpreadsheet className="w-8 h-8" />
              )}
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2 relative z-10">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {isDragOver ? 'Lepaskan file sekarang' : 'Klik atau seret file ke sini'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              Format yang didukung: 
              <span className="font-medium text-gray-700 dark:text-gray-300"> .xlsx, .xls, .csv </span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Maksimal ukuran file: {formatFileSize(maxSize)}
            </p>
          </div>
        </div>
      ) : (
        /* Selected File Display */
        <div className={`
          relative rounded-2xl p-5 border shadow-sm overflow-hidden group
          transition-all duration-300
          ${error 
            ? 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10' 
            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
          }
        `}>
          <div className="flex items-center gap-4 relative z-10">
            {/* File Icon */}
            <div className={`
              shrink-0 w-14 h-14 rounded-xl flex items-center justify-center shadow-sm border relative
              ${error
                ? 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-800'
                : 'bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-gray-100 dark:border-gray-700'
              }
            `}>
              {getFileIcon(selectedFile.name)}
              {!isLoading && !error && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                  <FileCheck className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {selectedFile.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                  {getFileTypeLabel(selectedFile.name)}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                  {formatFileSize(selectedFile.size)}
                </span>
              </div>

              {/* Progress Bar */}
              {isLoading && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-blue-600 dark:text-blue-400">Mengupload...</span>
                    <span className="text-blue-600 dark:text-blue-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status Icon / Remove Button */}
            <div className="shrink-0 pl-2">
              {isLoading ? (
                <div className="w-8 h-8 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
              ) : error ? (
                <div className="w-8 h-8 flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded-full text-red-500">
                  <AlertCircle className="w-5 h-5" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFileRemove()
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-500 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all transform hover:scale-105"
                  disabled={isLoading}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 pl-18 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5 animate-in slide-in-from-top-1 fade-in duration-200">
               <AlertCircle className="w-3.5 h-3.5" />
               <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Simplified version for inline use
export function UploadDropzoneSimple({
  onFileSelect,
  disabled = false,
}: {
  onFileSelect: (file: File) => void
  disabled?: boolean
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
        ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={() => !disabled && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <Upload className={`w-6 h-6 mx-auto mb-2 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
      <p className="text-sm text-gray-600">
        {isDragOver ? 'Lepaskan file' : 'Klik atau seret file'}
      </p>
    </div>
  )
}

