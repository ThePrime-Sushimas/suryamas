import type { RefObject } from 'react'
import { FormField, FileUpload } from '@/components/ui'

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
      <FileUpload
        inputRef={fileInputRef}
        value={receiptFile}
        onChange={onFileChange}
        accept="image/*,.pdf"
        display={receiptFile ? 'chip' : 'trigger'}
        placeholder="Upload foto struk (opsional)"
      />
    </FormField>
  )
}
