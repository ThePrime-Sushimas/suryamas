import { Camera, Trash2 } from 'lucide-react'
import type { RefObject } from 'react'
import { FormField } from '@/components/ui'

export interface ExpenseReceiptEditorProps {
  receiptPreview: string | null
  receiptFile: File | null
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (file: File | null) => void
}

export function ExpenseReceiptEditor({
  receiptPreview,
  receiptFile,
  fileInputRef,
  onFileChange,
}: ExpenseReceiptEditorProps) {
  return (
    <FormField label="Foto Struk">
      {(receiptPreview || receiptFile) && (
        <div className="relative mb-2 inline-block">
          <img
            src={receiptFile ? URL.createObjectURL(receiptFile) : receiptPreview ?? ''}
            alt="Receipt"
            className="h-36 w-48 rounded-lg border border-gray-200 object-cover"
          />
          {receiptFile && (
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {receiptPreview && !receiptFile && (
        <p className="mb-1 text-xs text-gray-400">
          Foto sudah ada. Upload ulang untuk mengganti.
        </p>
      )}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileChange(file)
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-600"
      >
        <Camera className="h-4 w-4" />{' '}
        {receiptPreview ? 'Ganti foto struk' : 'Upload foto struk (opsional)'}
      </button>
    </FormField>
  )
}
