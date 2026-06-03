import { useState, useEffect } from 'react'
import { X, ClipboardCheck } from 'lucide-react'
import { useOpnamePositions } from '../api/dailyStockOpname'
import { useUserBranches } from '@/hooks/_shared/useUserBranches'
import type { OpnamePosition } from '../api/dailyStockOpname'

function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

interface CreateOpnameDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { branch_id: string; closing_date: string; position_id: string; notes?: string }) => void
  isLoading?: boolean
  defaultBranchId?: string
}

export function CreateOpnameDialog({ isOpen, onClose, onSubmit, isLoading = false, defaultBranchId }: CreateOpnameDialogProps) {
  const userBranches = useUserBranches()

  const [branchId, setBranchId] = useState('')
  const [closingDate, setClosingDate] = useState(todayJakarta())
  const [positionId, setPositionId] = useState('')
  const [notes, setNotes] = useState('')

  const { data: positions = [], isLoading: loadingPositions } = useOpnamePositions(branchId)

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      const initialBranch = defaultBranchId || (userBranches.length === 1 ? userBranches[0].id : '')
      setBranchId(initialBranch)
      setClosingDate(todayJakarta())
      setPositionId('')
      setNotes('')
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset position when branch changes
  useEffect(() => {
    setPositionId('')
  }, [branchId])

  // Auto-select position if only one
  useEffect(() => {
    if (positions.length === 1) {
      setPositionId(positions[0].id)
    }
  }, [positions])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, isLoading, onClose])

  if (!isOpen) return null

  const canSubmit = branchId && closingDate && positionId && !isLoading && !loadingPositions

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({ branch_id: branchId, closing_date: closingDate, position_id: positionId, notes: notes || undefined })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (!isLoading && e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-opname-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 id="create-opname-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Mulai Stock Opname
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Branch selector — always visible */}
          <div>
            <label htmlFor="opname-branch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Cabang
            </label>
            <select
              id="opname-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Pilih cabang...</option>
              {userBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </select>
          </div>

          {/* Date picker */}
          <div>
            <label htmlFor="opname-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Tanggal Opname
            </label>
            <input
              id="opname-date"
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Position selector */}
          <div>
            <label htmlFor="opname-position" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Position / Station
            </label>
            {!branchId ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Pilih cabang terlebih dahulu</p>
            ) : loadingPositions ? (
              <div className="w-full h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : positions.length === 0 ? (
              <p className="text-sm text-red-500 dark:text-red-400">
                Tidak ada position yang tersedia untuk cabang ini. Pastikan user sudah di-assign position.
              </p>
            ) : (
              <select
                id="opname-position"
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Pilih position...</option>
                {positions.map((pos: OpnamePosition) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.position_name} ({pos.department_name})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Notes (optional) */}
          <div>
            <label htmlFor="opname-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Catatan <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <textarea
              id="opname-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Catatan tambahan..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Membuat...' : 'Mulai Opname'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
