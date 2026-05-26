import { useEffect, useMemo, useState } from 'react'
import { Upload, X, FileText, Image, ExternalLink } from 'lucide-react'
import { apTheme } from '../ap-payments.theme'
import {
  PROOF_ACCEPT_STRING,
  formatProofFileSize,
  isProofImageFile,
  isProofImagePath,
  validateProofFile,
} from './proof-upload.utils'

export interface PaymentProofUploadProps {
  groupKey: string
  file: File | null
  batchFile: File | null
  onFileChange: (file: File | null) => void
  error: string | null
  /** Already stored proof (R2 path) — e.g. General AP payment detail */
  existingProofPath?: string | null
  existingProofViewUrl?: string | null
  loadingExistingProof?: boolean
  onOpenExistingProof?: () => void
  /** AP rose theme vs neutral (General AP modal) */
  variant?: 'ap' | 'plain'
}

export function PaymentProofUpload({
  groupKey,
  file,
  batchFile,
  onFileChange,
  error,
  existingProofPath = null,
  existingProofViewUrl = null,
  loadingExistingProof = false,
  onOpenExistingProof,
  variant = 'ap',
}: PaymentProofUploadProps) {
  const [validationError, setValidationError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const isPlain = variant === 'plain'
  const filledBorder = isPlain
    ? 'border-gray-200 bg-gray-50/80'
    : 'border-rose-200/80 bg-[#fff9f7] dark:border-gray-600 dark:bg-gray-700/50'
  const batchBorder = 'border-violet-200/80 bg-violet-50/40 dark:border-violet-700/50 dark:bg-violet-900/10'

  useEffect(() => {
    if (file && isProofImageFile(file)) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [file])

  const displayFile = file ?? batchFile
  const isBatchFallback = !file && !!batchFile

  const batchPreviewUrl = useMemo(() => {
    if (isBatchFallback && batchFile && isProofImageFile(batchFile)) {
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
    e.target.value = ''

    const validationResult = validateProofFile(selectedFile)
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
  const inputId = `proof-upload-${groupKey}`

  const renderImagePreview = (src: string, alt: string) => (
    <img
      src={src}
      alt={alt}
      className={`max-h-[120px] w-auto rounded-xl border object-contain shrink-0 ${
        isPlain ? 'border-gray-200' : 'border-rose-100 dark:border-gray-600'
      }`}
    />
  )

  if (displayFile) {
    return (
      <div className="space-y-2">
        <div
          className={`flex items-center gap-3 p-3 rounded-2xl border ${
            isBatchFallback ? batchBorder : filledBorder
          }`}
        >
          {isProofImageFile(displayFile) && activePreviewUrl ? (
            renderImagePreview(activePreviewUrl, `Bukti pembayaran ${groupKey}`)
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileText className={`w-5 h-5 shrink-0 ${isPlain ? 'text-gray-400' : 'text-rose-500 dark:text-gray-400'}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {displayFile.name}
                </p>
                <p className={`text-xs ${isPlain ? 'text-gray-500' : apTheme.muted}`}>
                  {formatProofFileSize(displayFile.size)}
                </p>
              </div>
            </div>
          )}

          {isProofImageFile(displayFile) && activePreviewUrl && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {displayFile.name}
              </p>
              <p className={`text-xs ${isPlain ? 'text-gray-500' : apTheme.muted}`}>
                {formatProofFileSize(displayFile.size)}
              </p>
            </div>
          )}

          {isBatchFallback && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              Batch
            </span>
          )}

          {!isBatchFallback && (
            <button
              type="button"
              onClick={handleRemove}
              className="shrink-0 p-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label={`Hapus bukti pembayaran ${groupKey}`}
            >
              <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
            </button>
          )}
        </div>

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
              accept={PROOF_ACCEPT_STRING}
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        )}

        {displayError && (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {displayError}
          </p>
        )}
      </div>
    )
  }

  if (existingProofPath) {
    const labelName = existingProofPath.split('/').pop() ?? 'Bukti pembayaran'
    const showExistingImage =
      !!existingProofViewUrl && isProofImagePath(existingProofPath)

    return (
      <div className="space-y-2">
        <div className={`flex items-start gap-3 p-3 rounded-2xl border ${filledBorder}`}>
          {showExistingImage ? (
            renderImagePreview(existingProofViewUrl!, 'Bukti pembayaran')
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-xl border border-gray-200 bg-white shrink-0">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-gray-900 truncate">{labelName}</p>
            {loadingExistingProof && !existingProofViewUrl && (
              <p className="text-xs text-gray-500">Memuat preview…</p>
            )}
            {onOpenExistingProof && (
              <button
                type="button"
                onClick={onOpenExistingProof}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Buka file
              </button>
            )}
          </div>
        </div>
        <label
          htmlFor={inputId}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 cursor-pointer hover:underline"
        >
          <Upload className="w-3.5 h-3.5" />
          Ganti bukti
          <input
            id={inputId}
            type="file"
            accept={PROOF_ACCEPT_STRING}
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>
        {displayError && (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {displayError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className={
          isPlain
            ? 'flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors'
            : apTheme.uploadZone
        }
      >
        <Image className="w-6 h-6 text-gray-400 dark:text-gray-500" />
        <span className={`text-xs font-medium ${isPlain ? 'text-gray-700' : 'text-gray-600 dark:text-gray-400'}`}>
          Upload bukti bayar
        </span>
        <span className={`text-xs ${isPlain ? 'text-gray-500' : apTheme.muted}`}>
          JPG, PNG, WEBP, HEIC, PDF · Maks 10MB
        </span>
        <input
          id={inputId}
          type="file"
          accept={PROOF_ACCEPT_STRING}
          className="hidden"
          onChange={handleFileSelect}
        />
      </label>
      {displayError && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {displayError}
        </p>
      )}
    </div>
  )
}
