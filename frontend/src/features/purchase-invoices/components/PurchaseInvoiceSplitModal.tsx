import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, AlertCircle, Scissors } from 'lucide-react'
import type { PurchaseInvoiceDetail } from '../api/purchaseInvoices.api'
import { bankAccountsApi } from '@/features/bank-accounts/api/bankAccounts.api'

export interface SplitNotaDraft {
  key: string
  invoice_number: string
  invoice_date: string
  notes: string
  gr_line_ids: string[]
  supplier_bank_account_id: number | null
}

export interface PurchaseInvoiceSplitModalProps {
  open: boolean
  invoice: PurchaseInvoiceDetail
  onClose: () => void
  onSubmit: (splits: Array<{
    invoice_number: string
    invoice_date: string
    notes: string | null
    gr_line_ids: string[]
    supplier_bank_account_id?: number | null
  }>) => void
  isSubmitting?: boolean
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v)

function newNotaKey() {
  return `nota-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function createEmptyNota(invoiceDate: string, defaultBankId: number | null = null): SplitNotaDraft {
  return {
    key: newNotaKey(),
    invoice_number: '',
    invoice_date: invoiceDate.slice(0, 10),
    notes: '',
    gr_line_ids: [],
    supplier_bank_account_id: defaultBankId,
  }
}

export function PurchaseInvoiceSplitModal({
  open,
  invoice,
  onClose,
  onSubmit,
  isSubmitting = false,
}: PurchaseInvoiceSplitModalProps) {
  const defaultDate = invoice.invoice_date.slice(0, 10)

  const { data: supplierBankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts', 'supplier', invoice.supplier_id],
    queryFn: () => bankAccountsApi.getByOwner('supplier', invoice.supplier_id),
    enabled: !!invoice.supplier_id,
    staleTime: 60_000,
  })

  const defaultBankId =
    invoice.supplier_bank_account_id ??
    (supplierBankAccounts.length === 1 ? supplierBankAccounts[0].id : null)

  const [notas, setNotas] = useState<SplitNotaDraft[]>(() => [
    createEmptyNota(defaultDate, defaultBankId),
    createEmptyNota(defaultDate, defaultBankId),
  ])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const bankId =
      invoice.supplier_bank_account_id ??
      (supplierBankAccounts.length === 1 ? supplierBankAccounts[0].id : null)
    setNotas([createEmptyNota(defaultDate, bankId), createEmptyNota(defaultDate, bankId)])
    setError(null)
    // Reset draft only when modal opens — not on supplierBankAccounts refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const assignmentMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const nota of notas) {
      for (const gid of nota.gr_line_ids) {
        map.set(gid, nota.key)
      }
    }
    return map
  }, [notas])

  const unassignedLines = invoice.lines.filter((l) => !assignmentMap.has(l.gr_line_id))
  const allAssigned = unassignedLines.length === 0

  const toggleLine = (notaKey: string, grLineId: string) => {
    setNotas((prev) =>
      prev.map((n) => {
        if (n.key === notaKey) {
          const has = n.gr_line_ids.includes(grLineId)
          return {
            ...n,
            gr_line_ids: has
              ? n.gr_line_ids.filter((id) => id !== grLineId)
              : [...n.gr_line_ids, grLineId],
          }
        }
        return {
          ...n,
          gr_line_ids: n.gr_line_ids.filter((id) => id !== grLineId),
        }
      }),
    )
    setError(null)
  }

  const addNota = () => {
    setNotas((prev) => [...prev, createEmptyNota(defaultDate, defaultBankId)])
  }

  const removeNota = (key: string) => {
    if (notas.length <= 2) return
    setNotas((prev) => prev.filter((n) => n.key !== key))
  }

  const updateNota = (key: string, patch: Partial<SplitNotaDraft>) => {
    setNotas((prev) => prev.map((n) => (n.key === key ? { ...n, ...patch } : n)))
    setError(null)
  }

  const handleSubmit = () => {
    if (notas.length < 2) {
      setError('Minimal 2 nota supplier.')
      return
    }
    if (!allAssigned) {
      setError(`${unassignedLines.length} baris belum dialokasi ke nota manapun.`)
      return
    }
    for (const nota of notas) {
      if (nota.gr_line_ids.length === 0) {
        setError('Setiap nota wajib memiliki minimal 1 baris item.')
        return
      }
      if (!nota.invoice_number.trim()) {
        setError('Isi nomor invoice supplier untuk setiap nota.')
        return
      }
    }

    const numbers = notas.map((n) => n.invoice_number.trim().toLowerCase())
    if (new Set(numbers).size !== numbers.length) {
      setError('Nomor invoice tidak boleh duplikat antar nota.')
      return
    }

    onSubmit(
      notas.map((n) => ({
        invoice_number: n.invoice_number.trim(),
        invoice_date: n.invoice_date,
        notes: n.notes.trim() || null,
        gr_line_ids: n.gr_line_ids,
        supplier_bank_account_id: n.supplier_bank_account_id,
      })),
    )
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30">
              <Scissors className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pecah Invoice</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {invoice.lines.length} baris — semua baris wajib dialokasi ke tepat satu nota
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Tutup
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!allAssigned && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {unassignedLines.length} baris belum dipilih — semua harus masuk ke salah satu nota
              sebelum simpan.
            </span>
          </div>
        )}

        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {notas.map((nota, index) => {
            const lines = invoice.lines.filter((l) => nota.gr_line_ids.includes(l.gr_line_id))
            const subtotal = lines.reduce((s, l) => s + Number(l.total), 0)

            return (
              <div
                key={nota.key}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-4"
              >
                <NotaHeader
                  index={index}
                  canRemove={notas.length > 2}
                  onRemove={() => removeNota(nota.key)}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      No. Invoice Supplier
                    </span>
                    <input
                      type="text"
                      value={nota.invoice_number}
                      onChange={(e) => updateNota(nota.key, { invoice_number: e.target.value })}
                      placeholder="INV/SUP/001"
                      className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Tanggal Invoice
                    </span>
                    <input
                      type="date"
                      value={nota.invoice_date}
                      onChange={(e) => updateNota(nota.key, { invoice_date: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </label>
                  {supplierBankAccounts.length > 0 && (
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        Rekening Tujuan Supplier
                      </span>
                      <select
                        value={nota.supplier_bank_account_id ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          updateNota(nota.key, {
                            supplier_bank_account_id: v === '' ? null : Number(v),
                          })
                        }}
                        className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      >
                        <option value="">Pilih rekening tujuan...</option>
                        {supplierBankAccounts.map((ba) => (
                          <option key={ba.id} value={ba.id}>
                            {ba.bank_name} — {ba.account_number}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-3 py-2 w-10" />
                        <th className="px-3 py-2 text-left">Barang</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lines.map((line) => {
                        const assignedElsewhere =
                          assignmentMap.get(line.gr_line_id) &&
                          assignmentMap.get(line.gr_line_id) !== nota.key
                        const checked = nota.gr_line_ids.includes(line.gr_line_id)

                        return (
                          <tr
                            key={line.gr_line_id}
                            className={`border-t border-gray-100 dark:border-gray-800 ${
                              assignedElsewhere ? 'opacity-40' : ''
                            }`}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!!assignedElsewhere}
                                onChange={() => toggleLine(nota.key, line.gr_line_id)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {line.product_name}
                              </div>
                              <div className="text-xs text-gray-500">{line.product_code}</div>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {fmtCurrency(Number(line.total))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-gray-500">{lines.length} item dipilih</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {fmtCurrency(subtotal)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={addNota}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Tambah nota
        </button>

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !allAssigned}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Memproses...' : 'Simpan & Pecah'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NotaHeader({
  index,
  canRemove,
  onRemove,
}: {
  index: number
  canRemove: boolean
  onRemove: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Nota {index + 1}</h3>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus nota
        </button>
      )}
    </div>
  )
}
