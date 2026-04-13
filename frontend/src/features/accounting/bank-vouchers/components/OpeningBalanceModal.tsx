import { useState, useEffect } from 'react'
import { bankVouchersApi } from '../api/bankVouchers.api'
import { useBankVouchersStore } from '../store/bankVouchers.store'
import type { BankAccountOption, OpeningBalanceData } from '../types/bank-vouchers.types'

const formatIDR = (n: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)

interface Props {
  isOpen: boolean
  onClose: () => void
}

export const OpeningBalanceModal = ({ isOpen, onClose }: Props) => {
  const { bankAccounts, filter } = useBankVouchersStore()
  const [selectedBank, setSelectedBank] = useState<number | ''>('')
  const [balance, setBalance] = useState<OpeningBalanceData | null>(null)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingBalance, setLoadingBalance] = useState(false)

  // Load balance when bank selected
  useEffect(() => {
    if (!selectedBank || !isOpen) return
    setLoadingBalance(true)
    bankVouchersApi.getOpeningBalance({
      bank_account_id: selectedBank as number,
      period_month: filter.period_month,
      period_year: filter.period_year,
    }).then(data => {
      setBalance(data)
      setAmount(data.opening_balance > 0 ? String(data.opening_balance) : '')
    }).catch(() => setBalance(null))
      .finally(() => setLoadingBalance(false))
  }, [selectedBank, isOpen, filter.period_month, filter.period_year])

  // Reset on close
  useEffect(() => {
    if (!isOpen) { setSelectedBank(''); setBalance(null); setAmount('') }
  }, [isOpen])

  const handleSave = async () => {
    if (!selectedBank || !amount) return
    setSaving(true)
    try {
      await bankVouchersApi.setOpeningBalance({
        bank_account_id: selectedBank as number,
        period_month: filter.period_month,
        period_year: filter.period_year,
        opening_balance: parseFloat(amount),
      })
      onClose()
    } catch { /* handled by axios */ }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Saldo Awal Periode
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Periode: {filter.period_month}/{filter.period_year}
        </p>

        {/* Bank selector */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rekening Bank</label>
          <select
            value={selectedBank}
            onChange={e => setSelectedBank(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Pilih bank...</option>
            {bankAccounts.map((b: BankAccountOption) => (
              <option key={b.id} value={b.id}>{b.account_name} ({b.account_number})</option>
            ))}
          </select>
        </div>

        {/* Balance info */}
        {loadingBalance && <div className="text-xs text-gray-400 mb-4">Memuat data saldo...</div>}

        {balance && !loadingBalance && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Closing bulan lalu:</span>
              <span className="font-mono font-semibold">{formatIDR(balance.previous_month_closing)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Masuk (BM):</span>
              <span className="font-mono text-green-600">{formatIDR(balance.total_masuk)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Keluar (BK):</span>
              <span className="font-mono text-red-600">{formatIDR(balance.total_keluar)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2">
              <span className="text-gray-700 dark:text-gray-300 font-semibold">Closing Balance:</span>
              <span className="font-mono font-bold text-blue-600">{formatIDR(balance.closing_balance)}</span>
            </div>
            {balance.is_locked && (
              <div className="text-amber-600 font-semibold mt-1">⚠ Periode ini sudah dikunci</div>
            )}
          </div>
        )}

        {/* Input */}
        {selectedBank && !balance?.is_locked && (
          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Opening Balance (Rp)
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Masukkan saldo awal dari rekening koran / buku bank fisik
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
            Tutup
          </button>
          {selectedBank && !balance?.is_locked && (
            <button
              onClick={handleSave}
              disabled={saving || !amount}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
