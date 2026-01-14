import { useState } from 'react'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import type { FiscalPeriodWithDetails } from '../types/fiscal-period.types'

interface ClosePeriodModalProps {
  period: FiscalPeriodWithDetails
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ClosePeriodModal({ period, isOpen, onClose, onSuccess }: ClosePeriodModalProps) {
  const { closePeriod } = useFiscalPeriodsStore()
  const [closeReason, setCloseReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = async () => {
    setLoading(true)
    setError(null)
    try {
      await closePeriod(period.id, { close_reason: closeReason || undefined })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="close-period-title">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 id="close-period-title" className="text-xl font-bold mb-4">⚠️ Close Fiscal Period?</h2>
        
        <div className="mb-4">
          <p className="font-medium mb-2">Period: {period.period}</p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
            <p className="font-medium text-yellow-800 mb-2">Warning: Closing this period will:</p>
            <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
              <li>Prevent new journal entries</li>
              <li>Make this period read-only</li>
              <li>Cannot be reopened</li>
            </ul>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Close Reason (optional)
          </label>
          <textarea
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full border rounded px-3 py-2"
            placeholder="Enter reason for closing this period..."
          />
          <p className="text-xs text-gray-500 mt-1">{closeReason.length}/500</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleClose}
            disabled={loading}
            aria-label="Confirm close fiscal period"
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Closing...' : 'Close Period'}
          </button>
        </div>
      </div>
    </div>
  )
}
