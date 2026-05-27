import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useCompanyBankAccounts, useOwnerCreditCards } from '../api/marketplacePo.api'
import { fmtCurrency, todayIso } from '../utils/format'
import {
  formatBankAccountOption,
  findOwnerCard,
  resolveSessionSettlementBank,
} from '../utils/settlementBank'
import type { MarketplaceCheckoutSession } from '../types/marketplacePo.types'

export function SettleModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  session,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: {
    bank_account_id: number
    amount: number
    reference_number: string
    settled_date: string
    notes?: string | null
  }) => void
  isLoading: boolean
  session: MarketplaceCheckoutSession
}) {
  const headerCompanyId = useBranchContextStore((s) => s.currentBranch?.company_id)
  const companyId = session.company_id ?? headerCompanyId
  const { data: banks = [], isLoading: banksLoading, isFetching: banksFetching } =
    useCompanyBankAccounts(companyId)
  const { data: ownerCards = [], isLoading: cardsLoading } = useOwnerCreditCards()

  const [bankAccountId, setBankAccountId] = useState<number | ''>('')
  const [amount, setAmount] = useState(String(session.total_amount))
  const [referenceNumber, setReferenceNumber] = useState('')
  const [settledDate, setSettledDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [orphanBankLabel, setOrphanBankLabel] = useState<string | null>(null)

  const ccLabel = session.card_label ?? session.cc_label ?? '-'
  const coaCode = session.coa_code ?? '210602'
  const banksReady = !banksLoading && !banksFetching && !cardsLoading

  const configuredCc = useMemo(
    () => findOwnerCard(ownerCards, session.cc_id),
    [ownerCards, session.cc_id],
  )

  useEffect(() => {
    if (!isOpen) return
    setAmount(String(session.total_amount))
    setSettledDate(todayIso())
    setReferenceNumber('')
    setNotes('')
    if (!banksReady) return

    const configuredId =
      session.cc_settlement_bank_account_id ??
      configuredCc?.settlement_bank_account_id ??
      null

    if (configuredId != null && banks.some((b) => b.id === configuredId)) {
      setBankAccountId(configuredId)
      setOrphanBankLabel(null)
      return
    }

    const resolved = resolveSessionSettlementBank(session.cc_id, ownerCards, banks)
    setBankAccountId(resolved.bankAccountId)
    setOrphanBankLabel(resolved.orphanLabel)
  }, [
    isOpen,
    session.total_amount,
    session.cc_id,
    session.cc_settlement_bank_account_id,
    banksReady,
    banks,
    ownerCards,
    configuredCc?.settlement_bank_account_id,
  ])

  if (!isOpen) return null

  const selectedBank = banks.find((b) => b.id === bankAccountId)
  const banksSelectLoading = banksLoading || banksFetching || cardsLoading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pelunasan CC Owner</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
            <p>Session: {session.session_number}</p>
            <p>CC: {ccLabel}</p>
            <p className="col-span-2 font-semibold text-gray-900 dark:text-white">
              Total: {fmtCurrency(session.total_amount)}
            </p>
          </div>
          {configuredCc?.settlement_bank_account_id != null && (
            <p className="text-[11px] text-teal-600 dark:text-teal-400">
              Rekening default dari pengaturan kartu kredit
              {banksSelectLoading ? ' (memuat…)' : ''}
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
              disabled={banksSelectLoading || !companyId}
              className="w-full h-9 px-3 border rounded-lg bg-white dark:bg-gray-800 text-sm disabled:opacity-60"
            >
              <option value="">
                {banksSelectLoading
                  ? 'Memuat rekening…'
                  : !companyId
                    ? 'Konteks perusahaan tidak tersedia'
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
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 font-mono text-xs space-y-1">
            <p className="font-semibold mb-1">Journal yang akan di-post:</p>
            <p>
              Dr {coaCode} Hutang CC Owner {fmtCurrency(Number(amount) || 0)}
            </p>
            <p>
              Cr {selectedBank ? formatBankAccountOption(selectedBank) : 'Bank'}{' '}
              {fmtCurrency(Number(amount) || 0)}
            </p>
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
              })
            }
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : 'Konfirmasi Pelunasan'}
          </button>
        </div>
      </div>
    </div>
  )
}
