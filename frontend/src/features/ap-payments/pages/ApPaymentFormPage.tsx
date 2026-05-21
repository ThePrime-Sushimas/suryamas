import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, AlertCircle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useSuppliers } from '@/features/suppliers/api/suppliers.api'
import { bankAccountsApi } from '@/features/bank-accounts/api/bankAccounts.api'
import type { BankAccount } from '@/features/bank-accounts/types'
import {
  useApPayment,
  useCreateApPayment,
  useUpdateApPayment,
  useOutstandingInvoices,
  type ApOutstandingInvoice,
  type ApPaymentMethod,
} from '../api/apPayments.api'
import { AP_PAYMENTS_LIST_PATH, AP_PAYMENT_METHOD_LABELS } from '../constants'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v)

type LineDraft = {
  purchase_invoice_id: string
  invoice_number: string
  outstanding: number
  amount_paid: string
  notes: string
}

const inputCls =
  'w-full px-3 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white'

export default function ApPaymentFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const branch = useBranchContextStore((s) => s.currentBranch)

  const { data: existing, isLoading: loadingExisting } = useApPayment(id ?? '')
  const createPayment = useCreateApPayment()
  const updatePayment = useUpdateApPayment()

  const { data: suppliersData } = useSuppliers({ limit: 100, is_active: true })

  const [supplierId, setSupplierId] = useState('')
  const [bankAccountId, setBankAccountId] = useState<number | ''>('')
  const [paymentMethod, setPaymentMethod] = useState<ApPaymentMethod>('TRANSFER')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loadingBanks, setLoadingBanks] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')

  const outstandingSupplierId = supplierId || existing?.supplier_id

  const { data: outstanding = [], isFetching: loadingOutstanding } = useOutstandingInvoices({
    supplier_id: outstandingSupplierId || undefined,
    branch_id: branch?.branch_id,
  })

  useEffect(() => {
    if (!branch?.company_id) return
    setLoadingBanks(true)
    bankAccountsApi
      .getByOwner('company', branch.company_id)
      .then(setBankAccounts)
      .catch(() => setBankAccounts([]))
      .finally(() => setLoadingBanks(false))
  }, [branch?.company_id])

  useEffect(() => {
    if (!existing || !isEdit) return
    setSupplierId(existing.supplier_id)
    setBankAccountId(existing.bank_account_id)
    setPaymentMethod(existing.payment_method)
    setNotes(existing.notes ?? '')
    setLines(
      (existing.lines ?? []).map((l) => ({
        purchase_invoice_id: l.purchase_invoice_id,
        invoice_number: l.invoice_number,
        outstanding: Number(l.invoice_outstanding) + Number(l.amount_paid),
        amount_paid: String(l.amount_paid),
        notes: l.notes ?? '',
      })),
    )
  }, [existing, isEdit])

  const linesTotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const n = parseFloat(l.amount_paid.replace(/,/g, ''))
        return sum + (Number.isFinite(n) ? n : 0)
      }, 0),
    [lines],
  )

  const availableToAdd = useMemo(
    () =>
      outstanding.filter(
        (inv) => !lines.some((l) => l.purchase_invoice_id === inv.id),
      ),
    [outstanding, lines],
  )

  const addLine = (inv: ApOutstandingInvoice) => {
    const out = parseFloat(String(inv.outstanding))
    setLines((prev) => [
      ...prev,
      {
        purchase_invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        outstanding: out,
        amount_paid: String(out),
        notes: '',
      },
    ])
    setSelectedInvoiceId('')
  }

  const handleAddSelected = () => {
    const inv = availableToAdd.find((i) => i.id === selectedInvoiceId)
    if (inv) addLine(inv)
  }

  const handleSave = async () => {
    if (!supplierId || !bankAccountId || lines.length === 0) {
      toast.error('Lengkapi supplier, rekening bank, dan minimal 1 invoice')
      return
    }

    const payloadLines = lines.map((l) => ({
      purchase_invoice_id: l.purchase_invoice_id,
      amount_paid: parseFloat(l.amount_paid.replace(/,/g, '')) || 0,
      notes: l.notes.trim() || null,
    }))

    if (payloadLines.some((l) => l.amount_paid <= 0)) {
      toast.error('Nominal bayar harus lebih dari 0')
      return
    }

    try {
      if (isEdit && id) {
        await updatePayment.mutateAsync({
          id,
          body: {
            bank_account_id: Number(bankAccountId),
            payment_method: paymentMethod,
            total_amount: linesTotal,
            notes: notes.trim() || null,
            lines: payloadLines,
          },
        })
        toast.success('Pembayaran diperbarui')
        navigate(`${AP_PAYMENTS_LIST_PATH}/${id}`)
      } else {
        const created = await createPayment.mutateAsync({
          supplier_id: supplierId,
          bank_account_id: Number(bankAccountId),
          payment_method: paymentMethod,
          total_amount: linesTotal,
          notes: notes.trim() || null,
          lines: payloadLines,
        })
        toast.success('Pembayaran dibuat')
        navigate(`${AP_PAYMENTS_LIST_PATH}/${created.id}`)
      }
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyimpan'))
    }
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-500">Memuat...</div>
      </div>
    )
  }

  if (isEdit && existing && existing.status !== 'DRAFT') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-900 p-6">
        <AlertCircle className="w-10 h-10 text-amber-500" />
        <p className="text-gray-600 dark:text-gray-400 text-center">
          Hanya pembayaran berstatus Draft yang dapat diedit.
        </p>
        <button
          type="button"
          onClick={() => navigate(`${AP_PAYMENTS_LIST_PATH}/${id}`)}
          className="text-blue-600 text-sm font-medium"
        >
          Kembali ke detail
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => navigate(isEdit ? `${AP_PAYMENTS_LIST_PATH}/${id}` : AP_PAYMENTS_LIST_PATH)}
            className="p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Pembayaran AP' : 'Buat Pembayaran AP'}
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
            Informasi pembayaran
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value)
                  setLines([])
                }}
                disabled={isEdit}
                className={inputCls}
              >
                <option value="">Pilih supplier</option>
                {(suppliersData?.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplier_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Metode bayar *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as ApPaymentMethod)}
                className={inputCls}
              >
                {(Object.keys(AP_PAYMENT_METHOD_LABELS) as ApPaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {AP_PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Rekening bank (sumber) *</label>
              <select
                value={bankAccountId === '' ? '' : String(bankAccountId)}
                onChange={(e) => setBankAccountId(e.target.value ? Number(e.target.value) : '')}
                className={inputCls}
                disabled={loadingBanks}
              >
                <option value="">Pilih rekening</option>
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>
                    {ba.account_name} — {ba.account_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Catatan</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
            Invoice (POSTED)
          </h2>

          {!outstandingSupplierId ? (
            <p className="text-sm text-gray-500">Pilih supplier terlebih dahulu.</p>
          ) : loadingOutstanding && lines.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">Memuat invoice outstanding...</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className={`${inputCls} flex-1`}
                  disabled={loadingOutstanding || availableToAdd.length === 0}
                >
                  <option value="">
                    {loadingOutstanding
                      ? 'Memuat invoice...'
                      : availableToAdd.length === 0
                        ? 'Tidak ada invoice outstanding'
                        : 'Pilih invoice'}
                  </option>
                  {availableToAdd.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — outstanding {fmtCurrency(parseFloat(String(inv.outstanding)))}
                      {inv.is_overdue ? ' (overdue)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={!selectedInvoiceId}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Tambah
                </button>
              </div>

              {lines.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Belum ada invoice dipilih.</p>
              ) : (
                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div
                      key={line.purchase_invoice_id}
                      className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 space-y-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {line.invoice_number}
                          </p>
                          <p className="text-xs text-gray-500">
                            Outstanding: {fmtCurrency(line.outstanding)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLines((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Jumlah dibayar *</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.amount_paid}
                          onChange={(e) => {
                            const v = e.target.value
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, amount_paid: v } : l,
                              ),
                            )
                          }}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total pembayaran</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {fmtCurrency(linesTotal)}
            </span>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="max-w-4xl mx-auto flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={createPayment.isPending || updatePayment.isPending}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Simpan draft
          </button>
        </div>
      </div>
    </div>
  )
}
