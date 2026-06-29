import { Camera, Trash2 } from 'lucide-react'
import type { RefObject } from 'react'

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
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Foto Struk</label>
      {(receiptPreview || receiptFile) && (
        <div className="mb-2 relative inline-block">
          <img
            src={receiptFile ? URL.createObjectURL(receiptFile) : receiptPreview ?? ''}
            alt="Receipt"
            className="w-48 h-36 object-cover rounded-lg border border-gray-200"
          />
          {receiptFile && (
            <button
              onClick={() => onFileChange(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {receiptPreview && !receiptFile && (
        <p className="text-xs text-gray-400 mb-1">Foto sudah ada. Upload ulang untuk mengganti.</p>
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
        className="w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
      >
        <Camera className="w-4 h-4" /> {receiptPreview ? 'Ganti foto struk' : 'Upload foto struk (opsional)'}
      </button>
    </div>
  )
}
