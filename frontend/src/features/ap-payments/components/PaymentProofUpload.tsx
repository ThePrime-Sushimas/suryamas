import { useEffect, useMemo, useState } from 'react'
import { Upload, X, FileText, Image } from 'lucide-react'
import { apTheme } from '../ap-payments.theme'

const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ACCEPT_STRING = ACCEPTED_MIME_TYPES.join(',')

export interface PaymentProofUploadProps {
  groupIndex: number
  file: File | null
  batchFile: File | null
  onFileChange: (file: File | null) => void
  error: string | null
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return 'Format file tidak didukung. Gunakan JPG, PNG, WEBP, HEIC, atau PDF.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Ukuran file melebihi 10MB.'
  }
  return null
}

/**
 * File upload area for payment proof per payment group.
 *
 * - Accepts image (JPG, PNG, WEBP, HEIC, HEIF) and PDF files up to 10MB
 * - Shows image preview thumbnail (max 120px height) for image files
 * - Shows filename + file size for PDF files
 * - Remove button to clear uploaded file
 * - Falls back to showing batch file info when no individual file is uploaded
 * - Displays inline error message for invalid files
 */
export function PaymentProofUpload({
  groupIndex,
  file,
  batchFile,
  onFileChange,
  error,
}: PaymentProofUploadProps) {
  const [validationError, setValidationError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Generate preview URL for image files
  useEffect(() => {
    if (file && isImageFile(file)) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [file])

  // Determine which file to display (individual takes priority over batch)
  const displayFile = file ?? batchFile
  const isBatchFallback = !file && !!batchFile

  const batchPreviewUrl = useMemo(() => {
    if (isBatchFallback && batchFile && isImageFile(batchFile)) {
      return URL.createObjectURL(batchFile)
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBatchFallback, batchFile])

  useEffect(() => {
    return () => {
      if (batchPreviewUrl) URL.revokeObjectURL(batchPreviewUrl)
    }
  }, [batchPreviewUrl])

  const activePreviewUrl = file ? previewUrl : batchPreviewUrl

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Reset input so the same file can be re-selected
    e.target.value = ''

    const validationResult = validateFile(selectedFile)
    if (validationResult) {
      setValidationError(validationResult)
      return
    }

    setValidationError(null)
    onFileChange(selectedFile)
  }

  const handleRemove = () => {
    setValidationError(null)
    onFileChange(null)
  }

  const displayError = error ?? validationError
  const inputId = `proof-upload-${groupIndex}`

  // Show file preview/info when a file is present
  if (displayFile) {
    return (
      <div className="space-y-2">
        <div
          className={`flex items-center gap-3 p-3 rounded-2xl border ${
            isBatchFallback
              ? 'border-violet-200/80 bg-violet-50/40 dark:border-violet-700/50 dark:bg-violet-900/10'
              : 'border-rose-200/80 bg-[#fff9f7] dark:border-gray-600 dark:bg-gray-700/50'
          }`}
        >
          {/* Preview / icon */}
          {isImageFile(displayFile) && activePreviewUrl ? (
            <img
              src={activePreviewUrl}
              alt={`Bukti pembayaran grup ${groupIndex + 1}`}
              className="max-h-[120px] w-auto rounded-xl border border-rose-100 dark:border-gray-600 object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileText className="w-5 h-5 shrink-0 text-rose-500 dark:text-gray-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {displayFile.name}
                </p>
                <p className={`text-xs ${apTheme.muted}`}>
                  {formatFileSize(displayFile.size)}
                </p>
              </div>
            </div>
          )}

          {/* File info for images (shown beside thumbnail) */}
          {isImageFile(displayFile) && activePreviewUrl && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {displayFile.name}
              </p>
              <p className={`text-xs ${apTheme.muted}`}>
                {formatFileSize(displayFile.size)}
              </p>
            </div>
          )}

          {/* Batch indicator */}
          {isBatchFallback && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              Batch
            </span>
          )}

          {/* Remove button (only for individual files) */}
          {!isBatchFallback && (
            <button
              type="button"
              onClick={handleRemove}
              className="shrink-0 p-1.5 rounded-xl hover:bg-rose-100/80 dark:hover:bg-gray-600 transition-colors"
              aria-label={`Hapus bukti pembayaran grup ${groupIndex + 1}`}
            >
              <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
            </button>
          )}
        </div>

        {/* Allow uploading individual file even when batch is shown */}
        {isBatchFallback && (
          <label
            htmlFor={inputId}
            className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-blue-400 cursor-pointer hover:underline"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload bukti individual
            <input
              id={inputId}
              type="file"
              accept={ACCEPT_STRING}
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        )}

        {/* Error message */}
        {displayError && (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {displayError}
          </p>
        )}
      </div>
    )
  }

  // Empty state — upload zone
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className={apTheme.uploadZone}>
        <Image className="w-6 h-6 text-gray-400 dark:text-gray-500" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Upload bukti bayar
        </span>
        <span className={`text-xs ${apTheme.muted}`}>
          JPG, PNG, WEBP, HEIC, PDF · Maks 10MB
        </span>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT_STRING}
          className="hidden"
          onChange={handleFileSelect}
        />
      </label>

      {/* Error message */}
      {displayError && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {displayError}
        </p>
      )}
    </div>
  )
}
