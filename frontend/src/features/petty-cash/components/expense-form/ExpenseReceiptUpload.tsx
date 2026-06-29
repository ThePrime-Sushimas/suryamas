import { Camera, X } from 'lucide-react'
import type { RefObject } from 'react'
import { FormField } from '@/components/ui'

export interface ExpenseReceiptUploadProps {
  receiptFile: File | null
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (file: File | null) => void
}

export function ExpenseReceiptUpload({
  receiptFile,
  fileInputRef,
  onFileChange,
}: ExpenseReceiptUploadProps) {
  return (
    <FormField label="Foto Struk">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      {receiptFile ? (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm dark:border-green-800 dark:bg-green-900/20">
          <span className="truncate text-green-700 dark:text-green-300">
            <Camera className="mr-1.5 inline h-3.5 w-3.5" />
            {receiptFile.name}
          </span>
          <button
            type="button"
            onClick={() => {
              onFileChange(null)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          >
            <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-600"
        >
          <Camera className="h-4 w-4" /> Upload foto struk (opsional)
        </button>
      )}
    </FormField>
  )
}
