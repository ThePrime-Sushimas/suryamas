import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCompanyBankAccounts } from '@/features/ap-payments/hooks/useCompanyBankAccounts'
import { useApprovePettyCashRequest } from '../hooks/pettyCash.api'

interface PettyCashApproveModalProps {
  open: boolean
  onClose: () => void
  requestId: string
  defaultAmount: number
}

export function PettyCashApproveModal({ open, onClose, requestId, defaultAmount }: PettyCashApproveModalProps) {
  const toast = useToast()
  const { data: bankAccounts = [] } = useCompanyBankAccounts()
  const approveMutation = useApprovePettyCashRequest()

  const [form, setForm] = useState({ source_bank_account_id: '', amount_disbursed: String(defaultAmount), notes: '' })

  const handleApprove = async () => {
    if (!form.source_bank_account_id || !form.amount_disbursed) return
    try {
      await approveMutation.mutateAsync({
        id: requestId,
        source_bank_account_id: Number(form.source_bank_account_id),
        amount_disbursed: Number(form.amount_disbursed),
        notes: form.notes || undefined,
      })
      toast.success('Request disetujui & dicairkan')
      onClose()
    } catch (err) { toast.error(parseApiError(err, 'Gagal approve request')) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Approve & Cairkan</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sumber Bank *</label>
            <select value={form.source_bank_account_id} onChange={(e) => setForm(f => ({ ...f, source_bank_account_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="">Pilih rekening</option>
              {bankAccounts.map((ba) => <option key={ba.id} value={ba.id}>{ba.bank_name} · {ba.account_number} · {ba.account_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah Dicairkan *</label>
            <input type="number" value={form.amount_disbursed} onChange={(e) => setForm(f => ({ ...f, amount_disbursed: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Catatan</label>
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
          <button onClick={handleApprove} disabled={approveMutation.isPending} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve & Cairkan'}
          </button>
        </div>
      </div>
    </div>
  )
}
