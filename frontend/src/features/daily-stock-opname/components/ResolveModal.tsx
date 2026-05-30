import { useState } from 'react'
import { AlertTriangle, X, Loader2 } from 'lucide-react'
import { useResolveOpname } from '../api/dailyStockOpname'

interface ResolveModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
}

export const ResolveModal = ({ isOpen, onClose, sessionId }: ResolveModalProps) => {
  const [resolutionNote, setResolutionNote] = useState('')
  const [validationError, setValidationError] = useState('')
  const resolveOpname = useResolveOpname()

  if (!isOpen) return null

  const isValid = resolutionNote.trim().length >= 10

  const handleSubmit = async () => {
    if (resolutionNote.trim().length < 10) {
      setValidationError('Catatan resolusi minimal 10 karakter')
      return
    }
    setValidationError('')
    resolveOpname.mutate(
      { id: sessionId, body: { resolution_note: resolutionNote.trim() } },
      {
        onSuccess: () => {
          setResolutionNote('')
          setValidationError('')
          onClose()
        },
      },
    )
  }

  const handleClose = () => {
    if (resolveOpname.isPending) return
    setResolutionNote('')
    setValidationError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold">Resolve Opname</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={resolveOpname.isPending}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Sesi opname ini memiliki varians melebihi batas. Berikan catatan penjelasan untuk menyelesaikan flagging.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Catatan Resolusi <span className="text-red-500">*</span>
            </label>
            <textarea
              value={resolutionNote}
              onChange={(e) => {
                setResolutionNote(e.target.value)
                if (validationError) setValidationError('')
              }}
              placeholder="Jelaskan alasan varians (minimal 10 karakter)..."
              rows={4}
              disabled={resolveOpname.isPending}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none disabled:opacity-50"
            />
            {validationError && (
              <p className="text-xs text-red-500 mt-1">{validationError}</p>
            )}
            {!validationError && resolutionNote.length > 0 && resolutionNote.trim().length < 10 && (
              <p className="text-xs text-red-500 mt-1">Minimal 10 karakter</p>
            )}
          </div>

          {resolveOpname.isError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
              {resolveOpname.error instanceof Error
                ? resolveOpname.error.message
                : 'Gagal menyelesaikan opname'}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={resolveOpname.isPending}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || resolveOpname.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {resolveOpname.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Resolve
          </button>
        </div>
      </div>
    </div>
  )
}
