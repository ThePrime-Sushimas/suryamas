import { useState, useEffect } from 'react'
import { bankVouchersApi } from '../api/bankVouchers.api'
import { useBankVouchersStore } from '../store/bankVouchers.store'
import type { BankAccountOption, ManualVoucherLineInput, VoucherType } from '../types/bank-vouchers.types'

const emptyLine = (): ManualVoucherLineInput => ({
  description: '',
  bank_account_id: 0,
  bank_account_name: '',
  bank_account_number: '',
  is_fee_line: false,
  gross_amount: 0,
  tax_amount: 0,
  actual_fee_amount: 0,
  nett_amount: 0,
})

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const ManualVoucherModal = ({ isOpen, onClose, onSuccess }: Props) => {
  const { bankAccounts } = useBankVouchersStore()

  const [voucherType, setVoucherType] = useState<VoucherType>('BM')
  const [bankDate, setBankDate] = useState('')
  const [bankAccountId, setBankAccountId] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<ManualVoucherLineInput[]>([emptyLine()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setVoucherType('BM')
      setBankDate('')
      setBankAccountId('')
      setDescription('')
      setNotes('')
      setLines([emptyLine()])
    }
  }, [isOpen])

  // Auto-fill bank info on lines when header bank changes
  useEffect(() => {
    if (!bankAccountId) return
    const bank = bankAccounts.find(b => b.id === bankAccountId)
    if (!bank) return
    setLines(prev => prev.map(l => l.bank_account_id === 0 ? {
      ...l,
      bank_account_id: bank.id,
      bank_account_name: bank.account_name,
      bank_account_number: bank.account_number,
    } : l))
  }, [bankAccountId, bankAccounts])

  const updateLine = (idx: number, patch: Partial<ManualVoucherLineInput>) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }

  const addLine = () => {
    const bank = bankAccounts.find(b => b.id === bankAccountId)
    setLines(prev => [...prev, {
      ...emptyLine(),
      bank_account_id: bank?.id || 0,
      bank_account_name: bank?.account_name || '',
      bank_account_number: bank?.account_number || '',
    }])
  }

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  const totalNett = lines.reduce((s, l) => s + (l.nett_amount || 0), 0)

  const canSave = bankDate && bankAccountId && lines.length > 0 &&
    lines.every(l => l.description && l.nett_amount !== 0 && l.bank_account_id > 0)

  const handleSave = async () => {
    if (!canSave || !bankAccountId) return
    setSaving(true)
    try {
      const result = await bankVouchersApi.createManual({
        voucher_type: voucherType,
        bank_date: bankDate,
        bank_account_id: bankAccountId as number,
        description: description || undefined,
        notes: notes || undefined,
        lines,
      })
      alert(`Voucher ${result.voucher_number} berhasil dibuat`)
      onSuccess()
      onClose()
    } catch { /* handled by axios */ }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-10 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 mb-10" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Buat Voucher Manual</h3>
          <p className="text-xs text-gray-500 mt-1">Nomor voucher akan di-generate otomatis oleh sistem</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Row 1: Type + Date + Bank */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tipe</label>
              <select
                value={voucherType}
                onChange={e => setVoucherType(e.target.value as VoucherType)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="BM">BM — Bank Masuk</option>
                <option value="BK">BK — Bank Keluar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tanggal Bank</label>
              <input
                type="date"
                value={bankDate}
                onChange={e => setBankDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rekening Bank</label>
              <select
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="">Pilih bank...</option>
                {bankAccounts.map((b: BankAccountOption) => (
                  <option key={b.id} value={b.id}>{b.account_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description + Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Keterangan</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Opsional"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Catatan Internal</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Opsional"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Detail Baris</label>
              <button onClick={addLine} className="text-xs text-blue-600 hover:underline">+ Tambah Baris</button>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700 text-[10px] text-gray-400 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Uraian</th>
                    <th className="px-3 py-2 text-right w-28">Gross</th>
                    <th className="px-3 py-2 text-right w-28">Nett</th>
                    <th className="px-3 py-2 text-center w-16">Fee?</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="bg-white dark:bg-gray-800">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={e => updateLine(idx, { description: e.target.value })}
                          placeholder="Contoh: SETORAN TUNAI"
                          className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={line.gross_amount || ''}
                          onChange={e => updateLine(idx, { gross_amount: parseFloat(e.target.value) || 0 })}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs text-right font-mono border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={line.nett_amount || ''}
                          onChange={e => updateLine(idx, { nett_amount: parseFloat(e.target.value) || 0 })}
                          placeholder="0"
                          className="w-full px-2 py-1 text-xs text-right font-mono border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={line.is_fee_line}
                          onChange={e => updateLine(idx, { is_fee_line: e.target.checked })}
                          className="w-3.5 h-3.5 rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        {lines.length > 1 && (
                          <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600 text-sm">×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                  <tr className="font-bold text-xs">
                    <td className="px-3 py-2 text-right">Total Nett:</td>
                    <td />
                    <td className="px-3 py-2 text-right font-mono text-blue-600">
                      {new Intl.NumberFormat('id-ID').format(totalNett)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Buat Voucher'}
          </button>
        </div>
      </div>
    </div>
  )
}
