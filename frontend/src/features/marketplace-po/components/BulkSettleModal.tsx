import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useCompanyBankAccounts, useOwnerCreditCards } from '../api/marketplacePo.api'
import { fmtCurrency, todayIso } from '../utils/format'
import { formatBankAccountOption, resolveBulkSettlementBank } from '../utils/settlementBank'
import type { MarketplaceCheckoutSession } from '../types/marketplacePo.types'
import { useUnreconciledStatements } from '../api/marketplacePo.api'

export function BulkSettleModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  selectedCount,
  selectedTotal,
  selectedSessions,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: {
    bank_account_id: number
    amount: number
    reference_number: string
    settled_date: string
    notes?: string | null
    bank_statement_id?: number | null  // ← tambah ini
  }) => void
  isLoading: boolean
  selectedCount: number
  selectedTotal: number
  selectedSessions: Pick<MarketplaceCheckoutSession, 'id' | 'cc_id'>[]
}) {
  const { data: banks = [], isLoading: banksLoading, isFetching: banksFetching } =
    useCompanyBankAccounts()
  const { data: ownerCards = [], isLoading: cardsLoading } = useOwnerCreditCards()
  const [bankStatementId, setBankStatementId] = useState<number | null>(null)

  const [bankAccountId, setBankAccountId] = useState<number | ''>('')
  const [amount, setAmount] = useState(String(selectedTotal))
  const [referenceNumber, setReferenceNumber] = useState('')
  const [settledDate, setSettledDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [orphanBankLabel, setOrphanBankLabel] = useState<string | null>(null)

  const banksReady = !banksLoading && !banksFetching && !cardsLoading
  const banksSelectLoading = banksLoading || banksFetching || cardsLoading
  const uniqueCcCount = new Set(selectedSessions.map((s) => s.cc_id)).size
  // tambah hook — fetch statements saat bank account dipilih
  const { data: unreconciledStatements = [], isLoading: statementsLoading } =
    useUnreconciledStatements({
      bank_account_id: bankAccountId !== '' ? Number(bankAccountId) : undefined,
      date_from: settledDate
        ? new Date(new Date(settledDate).setMonth(new Date(settledDate).getMonth() - 2))
            .toISOString()
            .slice(0, 10)
        : undefined,
      date_to: settledDate || undefined,
    })

  // reset statement saat bank account berubah
  useEffect(() => {
    setBankStatementId(null)
  }, [bankAccountId])

  useEffect(() => {
    if (!isOpen) return
    setAmount(String(selectedTotal))
    setSettledDate(todayIso())
    setReferenceNumber('')
    setNotes('')
    if (!banksReady) return

    const resolved = resolveBulkSettlementBank(
      selectedSessions.map((s) => s.cc_id),
      ownerCards,
      banks,
    )
    setBankAccountId(resolved.bankAccountId)
    setOrphanBankLabel(resolved.orphanLabel)
  }, [isOpen, selectedTotal, selectedSessions, banksReady, banks, ownerCards])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Pelunasan Bulk CC Owner
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700">
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">
              {selectedCount} sesi dipilih
              {uniqueCcCount > 1 ? ` · ${uniqueCcCount} kartu berbeda` : ''}
            </p>
            <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
              {fmtCurrency(selectedTotal)}
            </p>
            <p className="text-xs text-purple-500 mt-1">
              Jurnal akan dibuat per kartu kredit secara otomatis
            </p>
          </div>

          {uniqueCcCount === 1 && (
            <p className="text-[11px] text-teal-600 dark:text-teal-400">
              Rekening default dari pengaturan kartu kredit
              {banksSelectLoading ? ' (memuat…)' : bankAccountId !== '' ? ' — sudah dipilih' : ''}
            </p>
          )}
          {uniqueCcCount > 1 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Beberapa kartu dipilih — pilih rekening bayar secara manual jika default tidak sama
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Rekening Bayar *</label>
            <select
              value={bankAccountId}
              onChange={(e) => {
                setBankAccountId(e.target.value ? Number(e.target.value) : '')
                setOrphanBankLabel(null)
              }}
              disabled={banksSelectLoading}
              className="w-full h-9 px-3 border rounded-lg bg-white dark:bg-gray-800 text-sm disabled:opacity-60"
            >
              <option value="">
                {banksSelectLoading
                  ? 'Memuat rekening…'
                  : 'Pilih rekening'}
              </option>
              {orphanBankLabel && bankAccountId !== '' && (
                <option value={bankAccountId}>{orphanBankLabel}</option>
              )}
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {formatBankAccountOption(b)}
                </option>
              ))}
            </select>
          </div>
          <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Mutasi Bank <span className="text-gray-400">(opsional)</span>
          </label>
          <select
            value={bankStatementId ?? ''}
            onChange={(e) => setBankStatementId(e.target.value ? Number(e.target.value) : null)}
            disabled={!bankAccountId || statementsLoading}
            className="w-full h-9 px-3 border rounded-lg bg-white dark:bg-gray-800 text-sm disabled:opacity-60"
          >
            <option value="">
              {!bankAccountId
                ? 'Pilih rekening dulu'
                : statementsLoading
                  ? 'Memuat mutasi...'
                  : unreconciledStatements.length === 0
                    ? 'Tidak ada mutasi yang belum direkonsiliasi'
                    : '— Pilih mutasi bank (opsional) —'}
            </option>
            {unreconciledStatements.map((s) => (
              <option key={s.id} value={s.id}>
                {s.transaction_date} ·{' '}
                {Number(s.credit_amount) > 0
                  ? `CR ${fmtCurrency(Number(s.credit_amount))}`
                  : `DR ${fmtCurrency(Number(s.debit_amount))}`}
                {s.reference_number ? ` · ${s.reference_number}` : ''}
                {s.description ? ` · ${s.description.slice(0, 40)}` : ''}
              </option>
            ))}
          </select>
          {bankStatementId && (
            <p className="text-[11px] text-teal-600 mt-1">
              ✓ Statement ini akan ditandai sebagai sudah direkonsiliasi setelah settlement
            </p>
          )}
        </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah Bayar *</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-9 px-3 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">No. Referensi *</label>
            <input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Nomor transfer"
              className="w-full h-9 px-3 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Bayar</label>
            <input
              type="date"
              value={settledDate}
              onChange={(e) => setSettledDate(e.target.value)}
              className="w-full h-9 px-3 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Catatan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isLoading || !bankAccountId || !referenceNumber.trim()}
            onClick={() =>
              onConfirm({
                bank_account_id: Number(bankAccountId),
                amount: Number(amount),
                reference_number: referenceNumber.trim(),
                settled_date: settledDate,
                notes: notes.trim() || null,
                bank_statement_id: bankStatementId || null,  // ← tambah ini
              })
            }
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : `Lunasi ${selectedCount} Sesi`}
          </button>
        </div>
      </div>
    </div>
  )
}
