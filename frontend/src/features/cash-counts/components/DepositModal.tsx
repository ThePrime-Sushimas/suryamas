import { useState } from 'react'
import { X, Loader2, Banknote, Info } from 'lucide-react'
import type { CashCountPreviewRow } from '../api/cashCounts.api'

const fmt = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (depositDate: string, bankAccountId: number, reference: string, notes: string) => Promise<void>
  selectedRows: CashCountPreviewRow[]
  bankAccounts: { id: number; account_name: string; account_number: string; bank_name: string; bank_code: string }[]
  isLoading: boolean
}

export function DepositModal({ isOpen, onClose, onConfirm, selectedRows, bankAccounts, isLoading }: Props) {
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0])
  const [bankAccountId, setBankAccountId] = useState(0)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  if (!isOpen) return null

  const totalLarge = selectedRows.reduce((s, r) => s + (r.large_denomination || 0), 0)
  const totalSmall = selectedRows.reduce((s, r) => s + (r.small_denomination || 0), 0)
  const totalDeposit = totalLarge + totalSmall
  const branchName = selectedRows[0]?.branch_name || ''
  const canSubmit = depositDate && bankAccountId > 0 && totalLarge > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-purple-600" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Buat Setoran</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cabang</span>
              <span className="font-medium text-gray-900 dark:text-white">{branchName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Jumlah item</span>
              <span className="font-medium text-gray-900 dark:text-white">{selectedRows.length} hari</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Periode</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {fmtDate(selectedRows[0]?.transaction_date)} — {fmtDate(selectedRows[selectedRows.length - 1]?.transaction_date)}
              </span>
            </div>

            {/* Breakdown */}
            <div className="border-t border-purple-200 dark:border-purple-700 pt-2 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pecahan Besar (Kasir)</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{fmt(totalLarge)}</span>
              </div>
              {totalSmall > 0 && (
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Top Up Modal</span>
                    <span title="Dana tambahan yang ditransfer untuk melengkapi setoran. Tercatat sebagai piutang perusahaan.">
                      <Info className="w-3 h-3 text-gray-400 cursor-help" />
                    </span>
                  </div>
                  <span className="font-mono text-orange-600 dark:text-orange-400">{fmt(totalSmall)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-purple-200 dark:border-purple-700 pt-1.5">
                <span className="text-gray-700 dark:text-gray-200">Total Setor ke Bank</span>
                <span className="font-mono text-purple-700 dark:text-purple-300">{fmt(totalDeposit)}</span>
              </div>
            </div>
          </div>

          {/* Detail rows */}
          <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-400">
                  <th className="px-2 py-1.5 text-left">Tanggal</th>
                  <th className="px-2 py-1.5 text-right">Besar</th>
                  <th className="px-2 py-1.5 text-right">Top Up Modal</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Total Setor</th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.map((r) => (
                  <tr key={`${r.branch_name}|${r.transaction_date}`} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">{fmtDate(r.transaction_date)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-900 dark:text-white">{fmt(r.large_denomination || 0)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-orange-600 dark:text-orange-400">{fmt(r.small_denomination || 0)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-medium text-purple-700 dark:text-purple-300">
                      {fmt((r.large_denomination || 0) + (r.small_denomination || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tambahan modal info box */}
          {totalSmall > 0 && (
            <div className="flex items-start gap-2 p-2.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <Info className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-700 dark:text-orange-300">
                {fmt(totalSmall)} merupakan dana tambahan yang ditransfer untuk melengkapi setoran ke bank.
                Jumlah ini tercatat sebagai <strong>piutang perusahaan</strong> dan akan menjadi modal cabang dalam bentuk uang kecil.
              </p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Tanggal Setor *</label>
              <input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Bank Tujuan *</label>
              <select value={bankAccountId} onChange={(e) => setBankAccountId(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value={0}>Pilih bank</option>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.bank_name} ({b.bank_code}) - {b.account_name} · {b.account_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Referensi / Slip</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No. slip setoran"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Catatan</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Batal</button>
          <button onClick={() => onConfirm(depositDate, bankAccountId, reference, notes)} disabled={!canSubmit || isLoading}
            className="px-5 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Banknote className="w-3.5 h-3.5" />}
            Setor {fmt(totalDeposit)}
          </button>
        </div>
      </div>
    </div>
  )
}
