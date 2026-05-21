import { useState } from 'react'
import { X, Upload, Loader2, Image } from 'lucide-react'
import { apTheme } from '../ap-payments.theme'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (file: File) => Promise<void>
  isLoading?: boolean
}

export function ApPaymentProofModal({ isOpen, onClose, onSubmit, isLoading }: Props) {
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
  }

  const reset = () => {
    setProofFile(null)
    setPreviewUrl(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!proofFile) return
    setUploading(true)
    try {
      await onSubmit(proofFile)
      reset()
      onClose()
    } catch {
      /* caller shows toast */
    } finally {
      setUploading(false)
    }
  }

  const busy = isLoading || uploading

  return (
    <div
      className={apTheme.modalOverlay}
      onClick={handleClose}
    >
      <div
        className={`${apTheme.modal} max-w-md`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className={apTheme.titleSm}>Upload bukti bayar</h3>
          <button type="button" onClick={handleClose} className={apTheme.btnGhost}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload screenshot atau PDF bukti transfer. Maks. 10MB (JPG, PNG, WEBP, PDF, HEIC).
          </p>
          <label className={apTheme.uploadZone}>
            <Upload className="w-8 h-8 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {proofFile ? proofFile.name : 'Pilih file bukti'}
            </span>
            <input
              type="file"
              accept="image/*,.pdf,.heic,.heif"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          {previewUrl && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Image className="w-4 h-4" />
              <span>Preview</span>
            </div>
          )}
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview bukti"
              className="w-full max-h-48 object-contain rounded-2xl border border-gray-200 dark:border-gray-600"
            />
          )}
          {proofFile && !previewUrl && (
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{proofFile.name}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            className={apTheme.btnSecondary}
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!proofFile || busy}
            onClick={() => void handleSubmit()}
            className={apTheme.btnPrimary}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan bukti
          </button>
        </div>
      </div>
    </div>
  )
}
