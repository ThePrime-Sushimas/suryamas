import { useRef, useState, useEffect } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { apTheme } from '../ap-payments.theme'
import {
  PROOF_ACCEPT_STRING,
  formatProofFileSize,
  isProofImageFile,
  validateProofFile,
} from './proof-upload.utils'

export interface BatchProofUploadProps {
  file: File | null
  onFileChange: (file: File | null) => void
  error: string | null
}

export function BatchProofUpload({ file, onFileChange, error }: BatchProofUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (file && isProofImageFile(file)) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [file])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    e.target.value = ''

    const validationError = validateProofFile(selected)
    if (validationError) {
      setLocalError(validationError)
      return
    }

    setLocalError(null)
    onFileChange(selected)
  }

  const handleRemove = () => {
    setLocalError(null)
    onFileChange(null)
  }

  const displayError = error || localError

  return (
    <div className={`${apTheme.card} p-4`}>
      <label className="block text-sm font-semibold text-rose-950 dark:text-white mb-3">
        Upload untuk semua
      </label>

      {!file ? (
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={apTheme.uploadZone}
            aria-label="Upload bukti pembayaran untuk semua grup"
          >
            <Upload className="w-6 h-6 text-rose-400 dark:text-gray-400" />
            <span className="text-sm text-rose-700/75 dark:text-gray-400">
              Pilih file bukti pembayaran
            </span>
            <span className="text-xs text-rose-500/60 dark:text-gray-500">
              JPG, PNG, WEBP, HEIC, PDF — maks. 10MB
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={PROOF_ACCEPT_STRING}
            className="hidden"
            onChange={handleFileSelect}
            aria-hidden="true"
          />
        </div>
      ) : (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-rose-200/90 dark:border-gray-600 bg-[#fff9f7] dark:bg-gray-700">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview bukti"
              className="rounded-lg object-cover border border-rose-100 dark:border-gray-600"
              style={{ maxHeight: 120, maxWidth: 120 }}
            />
          ) : (
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-rose-100/60 dark:bg-gray-600">
              <FileText className="w-6 h-6 text-rose-500 dark:text-gray-300" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
            <p className="text-xs text-rose-600/70 dark:text-gray-400 mt-0.5">
              {formatProofFileSize(file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-gray-600 transition-colors"
            aria-label="Hapus file"
          >
            <X className="w-4 h-4 text-rose-500 dark:text-gray-400" />
          </button>
        </div>
      )}

      {displayError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{displayError}</p>
      )}
    </div>
  )
}
