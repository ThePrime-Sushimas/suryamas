import { useMemo, useState } from 'react'
import { CreditCard, Plus, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import {
  useOwnerCreditCards,
  useCreateOwnerCreditCard,
  useUpdateOwnerCreditCard,
  useDeleteOwnerCreditCard,
  useCompanyBankAccounts,
} from '@/features/marketplace-po/api/marketplacePo.api'
import { CC_COA_OPTIONS } from '@/features/marketplace-po/utils/constants'
import type { OwnerCreditCard } from '@/features/marketplace-po/types/marketplacePo.types'

function formatBankAccountLabel(b: {
  bank_name?: string | null
  account_name: string
  account_number?: string | null
}) {
  const prefix = b.bank_name ? `${b.bank_name} — ` : ''
  const number = b.account_number?.trim() ? b.account_number : '—'
  return `${prefix}${b.account_name} · ${number}`
}

function formatCardSettlementDisplay(c: OwnerCreditCard): string {
  if (c.settlement_bank_account_name) {
    return formatBankAccountLabel({
      bank_name: c.settlement_bank_name,
      account_name: c.settlement_bank_account_name,
      account_number: c.settlement_bank_account_number,
    })
  }
  if (c.settlement_bank_account_id != null) {
    return `Rekening #${c.settlement_bank_account_id} (tidak tersedia)`
  }
  return '—'
}

export default function OwnerCreditCardSettingsPage() {
  const toast = useToast()
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canInsert = hasPermission('owner_credit_cards', 'insert')
  const canUpdate = hasPermission('owner_credit_cards', 'update')
  const canDelete = hasPermission('owner_credit_cards', 'delete')

  const { data: cards = [], isLoading } = useOwnerCreditCards()
  const {
    data: bankAccounts = [],
    isLoading: banksLoading,
    isFetching: banksFetching,
  } = useCompanyBankAccounts()
  const createCard = useCreateOwnerCreditCard()
  const updateCard = useUpdateOwnerCreditCard()
  const deleteCard = useDeleteOwnerCreditCard()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [cardLabel, setCardLabel] = useState('')
  const [bankName, setBankName] = useState('')
  const [last4, setLast4] = useState('')
  const [coaCode, setCoaCode] = useState(CC_COA_OPTIONS[0].code)
  const [isActive, setIsActive] = useState(true)
  const [sortOrder, setSortOrder] = useState(0)
  const [settlementBankAccountId, setSettlementBankAccountId] = useState<number | ''>('')
  const [deleteTarget, setDeleteTarget] = useState<OwnerCreditCard | null>(null)

  const editingCard = useMemo(
    () => (editId ? cards.find((c) => c.id === editId) : undefined),
    [cards, editId],
  )

  const orphanSettlementOption = useMemo(() => {
    if (settlementBankAccountId === '' || typeof settlementBankAccountId !== 'number') return null
    if (bankAccounts.some((b) => b.id === settlementBankAccountId)) return null
    if (editingCard?.settlement_bank_account_name) {
      return {
        id: settlementBankAccountId,
        label: `${formatBankAccountLabel({
          bank_name: editingCard.settlement_bank_name,
          account_name: editingCard.settlement_bank_account_name,
          account_number: editingCard.settlement_bank_account_number,
        })} (tidak tersedia)`,
      }
    }
    return {
      id: settlementBankAccountId,
      label: `Rekening #${settlementBankAccountId} (tidak tersedia / dihapus)`,
    }
  }, [settlementBankAccountId, bankAccounts, editingCard])

  const resetForm = () => {
    setShowForm(false)
    setEditId(null)
    setCardLabel('')
    setBankName('')
    setLast4('')
    setCoaCode(CC_COA_OPTIONS[0].code)
    setIsActive(true)
    setSortOrder(0)
    setSettlementBankAccountId('')
  }

  const startEdit = (c: OwnerCreditCard) => {
    setEditId(c.id)
    setCardLabel(c.card_label)
    setBankName(c.bank_name)
    setLast4(c.last4 ?? '')
    setCoaCode(c.coa_code)
    setIsActive(c.is_active)
    setSortOrder(c.sort_order)
    setSettlementBankAccountId(c.settlement_bank_account_id ?? '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!cardLabel.trim() || !bankName.trim() || !coaCode) {
      toast.warning('Label, bank, dan COA wajib diisi')
      return
    }
    const body = {
      card_label: cardLabel.trim(),
      bank_name: bankName.trim(),
      last4: last4.trim() || null,
      coa_code: coaCode,
      is_active: isActive,
      sort_order: sortOrder,
      settlement_bank_account_id: settlementBankAccountId === '' ? null : settlementBankAccountId,
    }
    try {
      if (editId) {
        await updateCard.mutateAsync({ id: editId, ...body })
        toast.success('Kartu diupdate')
      } else {
        await createCard.mutateAsync(body)
        toast.success('Kartu ditambahkan')
      }
      resetForm()
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyimpan kartu'))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCard.mutateAsync(deleteTarget.id)
      toast.success('Kartu dihapus')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menghapus kartu'))
    } finally {
      setDeleteTarget(null)
    }
  }

  const banksSelectLoading = banksLoading || banksFetching

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-teal-600 rounded-xl">
          <CreditCard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Kartu Kredit</h1>
          <p className="text-xs text-gray-400">Kelola CC yang dipakai untuk checkout marketplace</p>
        </div>
        {canInsert && (
          <button
            type="button"
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Kartu
          </button>
        )}
      </div>

      {showForm && (canInsert || canUpdate) && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase">
            {editId ? 'Edit Kartu' : 'Tambah Kartu'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Label *</label>
              <input
                value={cardLabel}
                onChange={(e) => setCardLabel(e.target.value)}
                placeholder="BCA Michael Mulyadi - 1234"
                className="w-full h-9 px-3 text-sm border rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bank *</label>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="BCA"
                className="w-full h-9 px-3 text-sm border rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">4 Digit Terakhir</label>
              <input
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                placeholder="1234"
                className="w-full h-9 px-3 text-sm border rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">COA Hutang CC *</label>
              <select
                value={coaCode}
                onChange={(e) => setCoaCode(e.target.value)}
                className="w-full h-9 px-3 text-sm border rounded-lg bg-white dark:bg-gray-700"
              >
                {CC_COA_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Rekening Pelunasan
              </label>
              <select
                value={settlementBankAccountId}
                onChange={(e) =>
                  setSettlementBankAccountId(e.target.value ? Number(e.target.value) : '')
                }
                disabled={banksSelectLoading}
                className="w-full h-9 px-3 text-sm border rounded-lg bg-white dark:bg-gray-700 disabled:opacity-60"
              >
                <option value="">
                  {banksSelectLoading ? 'Memuat rekening…' : '— Tidak dipilih —'}
                </option>
                {orphanSettlementOption && (
                  <option value={orphanSettlementOption.id}>{orphanSettlementOption.label}</option>
                )}
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {formatBankAccountLabel(b)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-400">
                Rekening bank default untuk pelunasan kartu ini (opsional).
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Urutan</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm border rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Aktif
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={createCard.isPending || updateCard.isPending}
              className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {editId ? 'Update' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm border rounded-lg text-gray-600"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">Belum ada kartu kredit</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Label</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Bank</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Last4</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">COA</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500 hidden md:table-cell">
                  Rek. Pelunasan
                </th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-2 font-medium text-gray-500">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {cards.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30">
                  <td className="px-4 py-3 font-medium">{c.card_label}</td>
                  <td className="px-4 py-3">{c.bank_name}</td>
                  <td className="px-4 py-3 font-mono">{c.last4 ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.coa_code}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 hidden md:table-cell max-w-[200px] truncate">
                    {formatCardSettlementDisplay(c)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        c.is_active
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="p-1.5 text-gray-400 hover:text-teal-600"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 text-gray-400 hover:text-red-600 ml-1"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleteCard.isPending}
        title="Hapus Kartu Kredit"
        message={`Hapus kartu "${deleteTarget?.card_label}"?`}
        confirmText="Hapus"
        variant="danger"
      />
    </div>
  )
}
