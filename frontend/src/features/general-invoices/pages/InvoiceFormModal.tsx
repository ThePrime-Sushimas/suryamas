import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, AlertCircle, Upload, ExternalLink } from 'lucide-react'
import {
  useCreateGeneralInvoice,
  useUpdateGeneralInvoice,
  useUploadGeneralInvoiceAttachment,
  useVendors,
  useSuggestExpenseCoa,
} from '../api/generalApi.api'
import { EXPENSE_TYPE_OPTIONS, EXPENSE_TYPE_FIELD_HELP, INVOICE_DATE_FIELD_HELP } from '../constants'
import { FieldHint } from '../components/FieldHint'
import { AccountSelector } from '@/features/accounting/journals/shared/AccountSelector'
import { getSignedStorageUrl } from '@/lib/storage'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { GeneralInvoiceDetail, ExpenseType } from '../api/generalApi.api'

interface LineForm {
  line_number: number
  account_id: string
  description: string
  amount: string
  tax_amount: string
}

interface Props {
  open: boolean
  onClose: () => void
  invoice?: GeneralInvoiceDetail | null
}

const emptyLine = (n: number): LineForm => ({
  line_number: n,
  account_id: '',
  description: '',
  amount: '',
  tax_amount: '0',
})

export default function InvoiceFormModal({ open, onClose, invoice }: Props) {
  const isEdit = !!invoice
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const createMutation = useCreateGeneralInvoice()
  const updateMutation = useUpdateGeneralInvoice()
  const uploadAttachment = useUploadGeneralInvoiceAttachment()
  const { data: vendorsData } = useVendors({ is_active: true, limit: 200 })
  const vendors = vendorsData?.data ?? []

  const [vendorId, setVendorId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [expenseType, setExpenseType] = useState<ExpenseType>('OTHER')
  const [isConfidential, setIsConfidential] = useState(false)
  const [notes, setNotes] = useState('')
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [lines, setLines] = useState<LineForm[]>([emptyLine(1)])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: suggestedCoa } = useSuggestExpenseCoa(expenseType, open && !isEdit)

  useEffect(() => {
    if (!open) return
    if (invoice) {
      setVendorId(invoice.vendor_id)
      setInvoiceDate(invoice.invoice_date)
      setDueDate(invoice.due_date ?? '')
      setPeriodStart(invoice.period_start ?? '')
      setPeriodEnd(invoice.period_end ?? '')
      setExpenseType(invoice.expense_type)
      setIsConfidential(invoice.is_confidential)
      setNotes(invoice.notes ?? '')
      setAttachmentPath(invoice.attachment_url ?? null)
      setPendingFile(null)
      setLines(
        invoice.lines.map((l) => ({
          line_number: l.line_number,
          account_id: l.account_id,
          description: l.description ?? '',
          amount: String(l.amount),
          tax_amount: String(l.tax_amount),
        })),
      )
    } else {
      resetForm()
    }
    setErrors({})
  }, [open, invoice])

  useEffect(() => {
    if (!open || isEdit || !suggestedCoa?.account_id) return
    setLines((prev) =>
      prev.map((l, i) => (i === 0 ? { ...l, account_id: suggestedCoa.account_id! } : l)),
    )
  }, [open, isEdit, suggestedCoa?.account_id, expenseType])

  const resetForm = () => {
    setVendorId('')
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setDueDate('')
    setPeriodStart('')
    setPeriodEnd('')
    setExpenseType('OTHER')
    setIsConfidential(false)
    setNotes('')
    setAttachmentPath(null)
    setPendingFile(null)
    setLines([emptyLine(1)])
  }

  const addLine = () => setLines((prev) => [...prev, emptyLine(prev.length + 1)])
  const removeLine = (idx: number) => {
    setLines((prev) =>
      prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, line_number: i + 1 })),
    )
  }
  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const totalTax = lines.reduce((s, l) => s + (parseFloat(l.tax_amount) || 0), 0)
  const totalAmount = subtotal + totalTax

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!vendorId) errs.vendorId = 'Vendor wajib dipilih'
    if (!invoiceDate) errs.invoiceDate = 'Tanggal invoice wajib diisi'
    if (!expenseType) errs.expenseType = 'Kategori wajib dipilih'
    if (lines.length === 0) errs.lines = 'Minimal 1 baris diperlukan'
    lines.forEach((l, i) => {
      if (!l.account_id) errs[`line_${i}_account`] = 'COA wajib dipilih'
      if (!l.amount || parseFloat(l.amount) <= 0) errs[`line_${i}_amount`] = 'Nominal wajib diisi'
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const uploadFileIfNeeded = async (invoiceId: string) => {
    if (!pendingFile) return
    await uploadAttachment.mutateAsync({ id: invoiceId, file: pendingFile })
  }

  const handleSubmit = async () => {
    if (!validate()) return

    const payload = {
      vendor_id: vendorId,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      expense_type: expenseType,
      is_confidential: isConfidential,
      notes: notes || null,
      attachment_url: attachmentPath,
      lines: lines.map((l) => ({
        line_number: l.line_number,
        account_id: l.account_id,
        description: l.description || null,
        amount: parseFloat(l.amount) || 0,
        tax_amount: parseFloat(l.tax_amount) || 0,
      })),
    }

    try {
      if (isEdit && invoice) {
        await updateMutation.mutateAsync({ id: invoice.id, body: payload })
        await uploadFileIfNeeded(invoice.id)
      } else {
        const created = await createMutation.mutateAsync(payload)
        await uploadFileIfNeeded(created.id)
      }
      onClose()
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyimpan invoice'))
    }
  }

  const openAttachment = async () => {
    if (!attachmentPath) return
    try {
      const url = await getSignedStorageUrl(attachmentPath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Gagal membuka lampiran')
    }
  }

  const isPending =
    createMutation.isPending || updateMutation.isPending || uploadAttachment.isPending

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Edit Invoice' : 'Buat Invoice Baru'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Vendor *</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.vendorId ? 'border-red-400' : 'border-gray-200'}`}
              >
                <option value="">-- Pilih Vendor --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.vendor_name}</option>
                ))}
              </select>
              {errors.vendorId && <p className="text-xs text-red-500">{errors.vendorId}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Kategori Beban *</label>
              <select
                value={expenseType}
                onChange={(e) => setExpenseType(e.target.value as ExpenseType)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EXPENSE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <FieldHint text={EXPENSE_TYPE_FIELD_HELP} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Tgl Tagihan *</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.invoiceDate ? 'border-red-400' : 'border-gray-200'}`}
              />
              <FieldHint text={INVOICE_DATE_FIELD_HELP.invoiceDate} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Jatuh Tempo</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FieldHint text={INVOICE_DATE_FIELD_HELP.dueDate} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Periode Awal</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FieldHint text={INVOICE_DATE_FIELD_HELP.periodStart} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Periode Akhir</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FieldHint text={INVOICE_DATE_FIELD_HELP.periodEnd} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-600">Baris Invoice (COA beban) *</label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={12} /> Tambah Baris
              </button>
            </div>
            {errors.lines && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.lines}
              </p>
            )}

            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {lines.map((line, idx) => (
                <div key={idx} className="p-3 space-y-2 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-start sm:space-y-0">
                  <div className="sm:col-span-4">
                    <label className="text-xs text-gray-500 sm:sr-only">COA</label>
                    <AccountSelector
                      value={line.account_id}
                      onChange={(accountId) => updateLine(idx, 'account_id', accountId)}
                      placeholder="Pilih akun beban..."
                      accountInfo={
                        invoice?.lines[idx]
                          ? {
                              account_code: invoice.lines[idx].account_code,
                              account_name: invoice.lines[idx].account_name,
                              account_type: 'EXPENSE',
                            }
                          : undefined
                      }
                    />
                    {errors[`line_${idx}_account`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errors[`line_${idx}_account`]}</p>
                    )}
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Keterangan"
                      value={line.description}
                      onChange={(e) => updateLine(idx, 'description', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      placeholder="Nominal"
                      value={line.amount}
                      onChange={(e) => updateLine(idx, 'amount', e.target.value)}
                      min={0}
                      className={`w-full px-2 py-1.5 text-xs border rounded-lg text-right ${errors[`line_${idx}_amount`] ? 'border-red-400' : 'border-gray-200'}`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      placeholder="Pajak"
                      value={line.tax_amount}
                      onChange={(e) => updateLine(idx, 'tax_amount', e.target.value)}
                      min={0}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-right"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length <= 1}
                      className="p-1 text-red-400 disabled:opacity-30"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-900 flex justify-between">
                <span>Total</span>
                <span>Rp {new Intl.NumberFormat('id-ID').format(totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Catatan</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none"
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                  <Upload size={12} /> Foto / PDF Tagihan
                </label>
                {attachmentPath && !pendingFile && (
                  <button
                    type="button"
                    onClick={openAttachment}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Lihat lampiran saat ini
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf,.heic,.heif"
                  className="w-full text-xs"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-[11px] text-gray-500">JPG, PNG, WEBP, PDF, HEIC · maks. 10MB · disimpan di R2</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isConfidential}
                  onChange={(e) => setIsConfidential(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Konfidensial</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm border rounded-lg">
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium disabled:opacity-60"
          >
            {isPending ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Buat Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
