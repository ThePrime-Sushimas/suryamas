import { Camera, X } from 'lucide-react'
import type { RefObject } from 'react'

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
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Foto Struk</label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      {receiptFile ? (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 text-sm">
          <span className="text-green-700 dark:text-green-300 truncate">
            <Camera className="w-3.5 h-3.5 inline mr-1.5" />{receiptFile.name}
          </span>
          <button type="button" onClick={() => { onFileChange(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
            <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" /> Upload foto struk (opsional)
        </button>
      )}
    </div>
  )
}
