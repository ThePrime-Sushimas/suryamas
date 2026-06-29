import type { RefObject } from 'react'
import { FormField, FileUpload } from '@/components/ui'

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
  const hasPreview = Boolean(receiptPreview || receiptFile)

  return (
    <FormField label="Foto Struk">
      <FileUpload
        inputRef={fileInputRef}
        value={receiptFile}
        onChange={onFileChange}
        accept="image/*"
        display={hasPreview ? 'image' : 'trigger'}
        previewUrl={receiptPreview}
        placeholder="Upload foto struk (opsional)"
        replaceLabel="Ganti foto struk"
        hint="Foto sudah ada. Upload ulang untuk mengganti."
      />
    </FormField>
  )
}
