import { useState } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import type { CreateCashCountDto } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (dto: CreateCashCountDto) => Promise<void>
  branches: { id: string; branch_name: string }[]
  paymentMethods: { id: number; name: string }[]
  isLoading: boolean
}

export function CashCountCreateModal({ isOpen, onClose, onSubmit, branches, paymentMethods, isLoading }: Props) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState(0)
  const [notes, setNotes] = useState('')

  if (!isOpen) return null

  const canSubmit = startDate && endDate && paymentMethodId > 0

  const toggleBranch = (id: string) => {
    setSelectedBranches((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    await onSubmit({
      start_date: startDate,
      end_date: endDate,
      branch_ids: selectedBranches.length > 0 ? selectedBranches : undefined,
      payment_method_id: paymentMethodId,
      notes: notes || undefined,
    })
    setStartDate('')
    setEndDate('')
    setSelectedBranches([])
    setPaymentMethodId(0)
    setNotes('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Buat Cash Count</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Dari Tanggal *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Sampai Tanggal *</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Branch multi-select chips */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Cabang {selectedBranches.length > 0 && <span className="text-blue-600">({selectedBranches.length})</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {branches.map((b) => {
                const isActive = selectedBranches.includes(b.id)
                return (
                  <button key={b.id} type="button" onClick={() => toggleBranch(b.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}>
                    {isActive && <Check size={12} />}
                    {b.branch_name}
                  </button>
                )
              })}
              {branches.length === 0 && <span className="text-[10px] text-gray-400">Tidak ada cabang</span>}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Kosong = semua cabang</p>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Payment Method *</label>
            <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={0}>Pilih payment method</option>
              {paymentMethods.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Catatan</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Opsional..." />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Batal</button>
          <button onClick={handleSubmit} disabled={!canSubmit || isLoading}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Buat Cash Count
          </button>
        </div>
      </div>
    </div>
  )
}
