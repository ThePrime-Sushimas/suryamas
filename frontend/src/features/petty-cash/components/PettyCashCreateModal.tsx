import { X, Loader2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { CreatePettyCashRequestForm } from '../hooks/useCreatePettyCashRequestForm'

interface BranchOption {
  id: string
  branch_name: string
}

interface CoaOption {
  id: string
  account_code: string
  account_name: string
}

export interface PettyCashCreateModalProps {
  onClose: () => void
  form: CreatePettyCashRequestForm
  setForm: Dispatch<SetStateAction<CreatePettyCashRequestForm>>
  onSubmit: () => void
  isPending: boolean
  branches: BranchOption[]
  pettyCashCoaOptions: CoaOption[]
}

export function PettyCashCreateModal({
  onClose,
  form,
  setForm,
  onSubmit,
  isPending,
  branches,
  pettyCashCoaOptions,
}: PettyCashCreateModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Buat Request Kas Kecil</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cabang *</label>
            <select value={form.branch_id} onChange={(e) => setForm(f => ({ ...f, branch_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="">Pilih cabang</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah Diajukan *</label>
            <input type="number" value={form.amount_requested} onChange={(e) => setForm(f => ({ ...f, amount_requested: e.target.value }))} placeholder="500000" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">COA Kas Kecil *</label>
            <select value={form.petty_cash_coa_id} onChange={(e) => setForm(f => ({ ...f, petty_cash_coa_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="">Pilih akun</option>
              {pettyCashCoaOptions.map(c => <option key={c.id} value={c.id}>{c.account_code} — {c.account_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Keterangan</label>
            <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">Batal</button>
          <button onClick={onSubmit} disabled={isPending} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buat Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
