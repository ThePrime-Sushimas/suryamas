import { useState, useEffect, useMemo } from 'react'
import { bankVouchersApi } from '../api/bankVouchers.api'
import { useBankVouchersStore } from '../store/bankVouchers.store'
import type {
  BankAccountOption, PaymentMethodOption, ManualVoucherLineInput,
  VoucherType, AvailableAggregate,
} from '../types/bank-vouchers.types'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n)
const fmtDate = (s: string) => {
  const dateStr = s.length > 10 ? s.slice(0, 10) : s
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

interface SelectedLine extends ManualVoucherLineInput {
  _source: 'aggregate' | 'manual'
  _aggregate_id?: string
  _coa_code?: string
  _fee_coa_code?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const ManualVoucherModal = ({ isOpen, onClose, onSuccess }: Props) => {
  const { bankAccounts } = useBankVouchersStore()

  // Data
  const [aggregates, setAggregates] = useState<AvailableAggregate[]>([])
  const [, setPaymentMethods] = useState<PaymentMethodOption[]>([])
  const [loadingAgg, setLoadingAgg] = useState(false)

  // Filters for aggregate picker
  const [aggDateStart, setAggDateStart] = useState('')
  const [aggDateEnd, setAggDateEnd] = useState('')
  const [aggSearch, setAggSearch] = useState('')

  // Header
  const [voucherType, setVoucherType] = useState<VoucherType>('BM')
  const [bankDate, setBankDate] = useState('')
  const [bankAccountId, setBankAccountId] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')

  // Lines
  const [lines, setLines] = useState<SelectedLine[]>([])
  const [saving, setSaving] = useState(false)

  // Load data on open
  useEffect(() => {
    if (isOpen) {
      bankVouchersApi.getPaymentMethods().then(setPaymentMethods).catch(() => {})
      fetchAggregates()
    } else {
      // Reset
      setAggregates([])
      setAggDateStart('')
      setAggDateEnd('')
      setAggSearch('')
      setVoucherType('BM')
      setBankDate('')
      setBankAccountId('')
      setDescription('')
      setNotes('')
      setLines([])
    }
  }, [isOpen]) // eslint-disable-line

  const fetchAggregates = async () => {
    setLoadingAgg(true)
    try {
      const data = await bankVouchersApi.getAvailableAggregates({
        date_start: aggDateStart || undefined,
        date_end: aggDateEnd || undefined,
        search: aggSearch || undefined,
      })
      setAggregates(data)
    } catch { /* */ }
    setLoadingAgg(false)
  }

  // Re-fetch when filters change
  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(fetchAggregates, 300)
    return () => clearTimeout(t)
  }, [aggDateStart, aggDateEnd, aggSearch, isOpen]) // eslint-disable-line

  // Already-selected aggregate IDs
  const selectedAggIds = useMemo(() => new Set(lines.filter(l => l._aggregate_id).map(l => l._aggregate_id!)), [lines])

  const addAggregate = (agg: AvailableAggregate) => {
    if (selectedAggIds.has(agg.id)) return
    const fee = Number(agg.actual_fee_amount) + Number(agg.fee_discrepancy)
    const txDate = agg.transaction_date.length > 10 ? agg.transaction_date.slice(0, 10) : agg.transaction_date

    const newLine: SelectedLine = {
      _source: 'aggregate',
      _aggregate_id: agg.id,
      _coa_code: agg.coa_code || undefined,
      _fee_coa_code: agg.fee_coa_code || undefined,
      description: agg.payment_method_name.toUpperCase(),
      bank_account_id: agg.bank_account_id || 0,
      bank_account_name: agg.bank_account_name || '',
      bank_account_number: agg.bank_account_number || '',
      payment_method_id: agg.payment_method_id,
      payment_method_name: agg.payment_method_name,
      is_fee_line: false,
      gross_amount: Number(agg.gross_amount),
      tax_amount: Number(agg.tax_amount),
      actual_fee_amount: fee,
      nett_amount: Number(agg.actual_nett_amount),
      coa_account_id: agg.coa_account_id || undefined,
      fee_coa_account_id: agg.fee_coa_account_id || undefined,
      transaction_date: txDate,
    }

    const newLines = [newLine]

    // Auto-add fee line if fee exists
    if (fee !== 0) {
      newLines.push({
        ...newLine,
        description: fee > 0 ? `BIAYA ADMIN ${agg.payment_method_name.toUpperCase()}` : `LEBIH ${agg.payment_method_name.toUpperCase()}`,
        is_fee_line: true,
        gross_amount: 0,
        tax_amount: 0,
        nett_amount: -fee,
        actual_fee_amount: fee,
      })
    }

    setLines(prev => [...prev, ...newLines])

    // Auto-set header bank if not set
    if (!bankAccountId && agg.bank_account_id) setBankAccountId(agg.bank_account_id)
    // Auto-set bank_date from first aggregate
    if (!bankDate && txDate) setBankDate(txDate)
  }

  const removeAggregate = (aggId: string) => {
    setLines(prev => prev.filter(l => l._aggregate_id !== aggId))
  }

  const addManualLine = () => {
    const bank = bankAccounts.find(b => b.id === bankAccountId)
    setLines(prev => [...prev, {
      _source: 'manual',
      description: '',
      bank_account_id: bank?.id || 0,
      bank_account_name: bank?.account_name || '',
      bank_account_number: bank?.account_number || '',
      is_fee_line: false,
      gross_amount: 0,
      tax_amount: 0,
      actual_fee_amount: 0,
      nett_amount: 0,
    }])
  }

  const updateManualLine = (idx: number, patch: Partial<SelectedLine>) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }

  const removeLine = (idx: number) => {
    const line = lines[idx]
    if (line._aggregate_id) {
      removeAggregate(line._aggregate_id)
    } else {
      setLines(prev => prev.filter((_, i) => i !== idx))
    }
  }

  const totalNett = lines.reduce((s, l) => s + (l.nett_amount || 0), 0)

  const canSave = bankDate && bankAccountId && lines.length > 0 &&
    lines.every(l => l.description && l.bank_account_id > 0)

  const handleSave = async () => {
    if (!canSave || !bankAccountId) return
    setSaving(true)
    try {
      const apiLines: ManualVoucherLineInput[] = lines.map(({ _source, _aggregate_id, _coa_code, _fee_coa_code, ...rest }) => rest)
      const result = await bankVouchersApi.createManual({
        voucher_type: voucherType,
        bank_date: bankDate,
        bank_account_id: bankAccountId as number,
        description: description || undefined,
        notes: notes || undefined,
        lines: apiLines,
      })
      alert(`Voucher ${result.voucher_number} berhasil dibuat`)
      onSuccess()
      onClose()
    } catch { /* handled by axios */ }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl flex flex-col max-h-full" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Buat Voucher Manual</h3>
              <p className="text-xs text-gray-500 mt-0.5">Pilih transaksi dari aggregate atau tambah baris manual</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          {/* Header fields */}
          <div className="grid grid-cols-5 gap-3 mt-4">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">Tipe</label>
              <select value={voucherType} onChange={e => setVoucherType(e.target.value as VoucherType)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                <option value="BM">BM — Bank Masuk</option>
                <option value="BK">BK — Bank Keluar</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">Tanggal Bank</label>
              <input type="date" value={bankDate} onChange={e => setBankDate(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">Rekening Bank</label>
              <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                <option value="">Pilih bank...</option>
                {bankAccounts.map((b: BankAccountOption) => (
                  <option key={b.id} value={b.id}>{b.bank_name} — {b.account_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">Keterangan</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Opsional"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">Catatan</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" />
            </div>
          </div>
        </div>

        {/* Body: 2 panels */}
        <div className="flex flex-1 min-h-0">

          {/* LEFT: Aggregate Picker */}
          <div className="w-[420px] border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 space-y-2">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pilih Aggregate Transaksi</h4>
              <div className="flex gap-2">
                <input type="date" value={aggDateStart} onChange={e => setAggDateStart(e.target.value)} placeholder="Dari"
                  className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700" />
                <input type="date" value={aggDateEnd} onChange={e => setAggDateEnd(e.target.value)} placeholder="Sampai"
                  className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700" />
              </div>
              <input type="text" value={aggSearch} onChange={e => setAggSearch(e.target.value)} placeholder="Cari payment method / cabang..."
                className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700" />
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingAgg ? (
                <div className="p-4 text-xs text-gray-400">Memuat...</div>
              ) : aggregates.length === 0 ? (
                <div className="p-4 text-xs text-gray-400 text-center">Tidak ada aggregate tersedia</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {aggregates.map(agg => {
                    const isSelected = selectedAggIds.has(agg.id)
                    return (
                      <div
                        key={agg.id}
                        onClick={() => !isSelected && addAggregate(agg)}
                        className={`px-4 py-2.5 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-green-50 dark:bg-green-900/20 opacity-50 cursor-not-allowed'
                            : 'hover:bg-blue-50 dark:hover:bg-blue-900/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{agg.payment_method_name}</span>
                            <span className="ml-2 text-[10px] text-gray-400">{agg.payment_type}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-green-600 dark:text-green-400">
                            {fmt(Number(agg.actual_nett_amount))}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                          <span>{fmtDate(agg.transaction_date)}</span>
                          <span>{agg.branch_name}</span>
                          {agg.bank_name && <span>{agg.bank_name}</span>}
                          {agg.coa_code && <span className="font-mono">COA:{agg.coa_code}</span>}
                        </div>
                        {isSelected && <span className="text-[9px] text-green-600 font-bold">✓ DIPILIH</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400">
              {aggregates.length} tersedia · {selectedAggIds.size} dipilih
            </div>
          </div>

          {/* RIGHT: Selected Lines */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Detail Baris Voucher ({lines.length})
              </h4>
              <button onClick={addManualLine} className="text-[10px] text-purple-600 hover:underline font-semibold">
                + Tambah Baris Manual
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {lines.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  Pilih aggregate dari panel kiri, atau tambah baris manual
                </div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-[9px] text-gray-400 uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Sumber</th>
                      <th className="px-3 py-2 text-left">Uraian</th>
                      <th className="px-3 py-2 text-left w-16">COA</th>
                      <th className="px-3 py-2 text-right w-24">Gross</th>
                      <th className="px-3 py-2 text-right w-24">Nett</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {lines.map((line, idx) => (
                      <tr key={idx} className={`${line.is_fee_line ? 'bg-red-50/30 dark:bg-red-900/5' : 'bg-white dark:bg-gray-800'}`}>
                        <td className="px-3 py-2">
                          {line._source === 'aggregate' ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                              AGG
                            </span>
                          ) : (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
                              MANUAL
                            </span>
                          )}
                          {line.transaction_date && (
                            <span className="ml-1 text-[9px] text-gray-400">{fmtDate(line.transaction_date)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {line._source === 'manual' ? (
                            <input type="text" value={line.description} onChange={e => updateManualLine(idx, { description: e.target.value })}
                              placeholder="Uraian..." className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700" />
                          ) : (
                            <span className={line.is_fee_line ? 'text-red-500 italic' : 'text-gray-700 dark:text-gray-300'}>{line.description}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[9px] font-mono text-gray-400">
                            {line.is_fee_line ? (line._fee_coa_code || '-') : (line._coa_code || '-')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">
                          {line._source === 'manual' ? (
                            <input type="number" value={line.gross_amount || ''} onChange={e => updateManualLine(idx, { gross_amount: parseFloat(e.target.value) || 0 })}
                              className="w-full px-1 py-0.5 text-xs text-right font-mono border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700" />
                          ) : (
                            line.is_fee_line ? '-' : fmt(line.gross_amount)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">
                          {line._source === 'manual' ? (
                            <input type="number" value={line.nett_amount || ''} onChange={e => updateManualLine(idx, { nett_amount: parseFloat(e.target.value) || 0 })}
                              className="w-full px-1 py-0.5 text-xs text-right font-mono border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700" />
                          ) : (
                            <span className={line.nett_amount < 0 ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}>
                              {fmt(line.nett_amount)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600 text-sm">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Total bar */}
            {lines.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                <span className="text-xs text-gray-500">{lines.length} baris · {lines.filter(l => l._source === 'aggregate').length} aggregate · {lines.filter(l => l._source === 'manual').length} manual</span>
                <div className="text-right">
                  <span className="text-xs text-gray-400 mr-3">Total Nett:</span>
                  <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">{fmt(totalNett)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
            Batal
          </button>
          <button onClick={handleSave} disabled={saving || !canSave}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Buat Voucher'}
          </button>
        </div>
      </div>
    </div>
  )
}
