import { useId, useRef, type RefObject } from 'react'
import { Camera, X, Trash2 } from 'lucide-react'

export type FileUploadDisplay = 'trigger' | 'chip' | 'image'

export interface FileUploadProps {
  value: File | null
  onChange: (file: File | null) => void
  accept?: string
  display?: FileUploadDisplay
  /** Existing remote preview URL (e.g. signed URL on edit) */
  previewUrl?: string | null
  placeholder?: string
  replaceLabel?: string
  hint?: string
  disabled?: boolean
  className?: string
  /** Ref to the hidden file input — use when parent needs programmatic access (reset, etc.) */
  inputRef?: RefObject<HTMLInputElement | null>
}

export function FileUpload({
  value,
  onChange,
  accept = 'image/*',
  display = 'trigger',
  previewUrl = null,
  placeholder = 'Upload file',
  replaceLabel,
  hint,
  disabled = false,
  className = '',
  inputRef,
}: FileUploadProps) {
  const fallbackId = useId()
  const inputId = `file-upload-${fallbackId}`
  const internalRef = useRef<HTMLInputElement>(null)
  const resolvedRef = inputRef ?? internalRef

  const clearFile = () => {
    onChange(null)
    if (resolvedRef.current) resolvedRef.current.value = ''
  }

  const openPicker = () => {
    if (disabled) return
    resolvedRef.current?.click()
  }

  const triggerClasses = [
    'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-500 transition-colors',
    'hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-900 dark:hover:border-blue-500',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const hasImagePreview = display === 'image' && (value || previewUrl)
  const showReplace = display === 'image' && previewUrl && !value

  return (
    <div className="space-y-2">
      <input
        ref={resolvedRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />

      {display === 'chip' && value ? (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm dark:border-green-800 dark:bg-green-900/20">
          <span className="truncate text-green-700 dark:text-green-300">
            <Camera className="mr-1.5 inline h-3.5 w-3.5" />
            {value.name}
          </span>
          <button
            type="button"
            onClick={clearFile}
            disabled={disabled}
            className="text-gray-400 hover:text-red-500 disabled:opacity-50"
            aria-label="Hapus file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : hasImagePreview ? (
        <div className="space-y-2">
          <div className="relative inline-block">
            <img
              src={value ? URL.createObjectURL(value) : previewUrl ?? ''}
              alt="Preview"
              className="h-36 w-48 rounded-xl border border-gray-200 object-cover dark:border-gray-700"
            />
            {value && (
              <button
                type="button"
                onClick={clearFile}
                disabled={disabled}
                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white disabled:opacity-50"
                aria-label="Hapus file"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {showReplace && hint && (
            <p className="text-xs text-gray-400">{hint}</p>
          )}
          <button type="button" onClick={openPicker} disabled={disabled} className={triggerClasses}>
            <Camera className="h-4 w-4" />
            {replaceLabel ?? placeholder}
          </button>
        </div>
      ) : (
        <button type="button" onClick={openPicker} disabled={disabled} className={triggerClasses}>
          <Camera className="h-4 w-4" />
          {placeholder}
        </button>
      )}
    </div>
  )
}
