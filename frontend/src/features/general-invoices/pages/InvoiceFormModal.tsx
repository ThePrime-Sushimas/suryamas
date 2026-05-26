import { useState, useEffect } from 'react'
import { X, Plus, Trash2, AlertCircle } from 'lucide-react'
import { useCreateGeneralInvoice, useUpdateGeneralInvoice, useVendors } from '../api/generalApi.api'
import { EXPENSE_TYPE_OPTIONS } from '../constants'
import type { GeneralInvoiceDetail, ExpenseType } from '../api/generalApi.api'


// Note: Replace this with your actual COA selector component/hook
// that fetches from your chart_of_accounts endpoint
interface CoaOption {
  id: string
  account_code: string
  account_name: string
}

interface LineForm {
  line_number: number
  account_id: string
  account_label: string  // for display only
  description: string
  amount: string
  tax_amount: string
}

interface Props {
  open: boolean
  onClose: () => void
  invoice?: GeneralInvoiceDetail | null  // null = create mode
  // Inject your COA options here (from your existing COA hook)
  coaOptions?: CoaOption[]
  coaLoading?: boolean
}

const emptyLine = (n: number): LineForm => ({
  line_number: n,
  account_id: '',
  account_label: '',
  description: '',
  amount: '',
  tax_amount: '0',
})

export default function InvoiceFormModal({
  open,
  onClose,
  invoice,
  coaOptions = [],
}: Props) {

  const isEdit = !!invoice

  const createMutation = useCreateGeneralInvoice()
  const updateMutation = useUpdateGeneralInvoice()
  const { data: vendorsData } = useVendors({ is_active: true, limit: 200 })
  const vendors = vendorsData?.data ?? []

  // ─── Form state ───────────────────────────────────────────
  const [vendorId, setVendorId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [expenseType, setExpenseType] = useState<ExpenseType>('OTHER')
  const [isConfidential, setIsConfidential] = useState(false)
  const [notes, setNotes] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [lines, setLines] = useState<LineForm[]>([emptyLine(1)])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Populate form when editing
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
      setAttachmentUrl(invoice.attachment_url ?? '')
      setLines(
    invoice.lines.map((l: any) => ({
          line_number: l.line_number,

          account_id: l.account_id,
          account_label: `${l.account_code} — ${l.account_name}`,
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

  const resetForm = () => {
    setVendorId('')
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setDueDate('')
    setPeriodStart('')
    setPeriodEnd('')
    setExpenseType('OTHER')
    setIsConfidential(false)
    setNotes('')
    setAttachmentUrl('')
    setLines([emptyLine(1)])
  }

  const addLine = () => setLines((prev) => [...prev, emptyLine(prev.length + 1)])
  const removeLine = (idx: number) => {
    setLines((prev) =>
      prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, line_number: i + 1 })),
    )
  }
  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  // ─── Computed totals ──────────────────────────────────────
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
      attachment_url: attachmentUrl || null,
      lines: lines.map((l) => ({
        line_number: l.line_number,
        account_id: l.account_id,
        description: l.description || null,
        amount: parseFloat(l.amount) || 0,
        tax_amount: parseFloat(l.tax_amount) || 0,
      })),
    }

    if (isEdit && invoice) {
      await updateMutation.mutateAsync({ id: invoice.id, body: payload })

    } else {
      await createMutation.mutateAsync(payload)
    }
    onClose()
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Edit Invoice' : 'Buat Invoice Baru'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Row 1: Vendor + Expense Type */}
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
            </div>
          </div>

          {/* Row 2: Dates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Tgl Invoice *</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.invoiceDate ? 'border-red-400' : 'border-gray-200'}`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Jatuh Tempo</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Periode Awal</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Periode Akhir</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-600">Baris Invoice *</label>
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

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Lines header */}
              <div className="hidden sm:grid grid-cols-12 gap-2 bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500">
                <div className="col-span-4">COA / Akun</div>
                <div className="col-span-3">Keterangan</div>
                <div className="col-span-2 text-right">Nominal</div>
                <div className="col-span-2 text-right">Pajak</div>
                <div className="col-span-1" />
              </div>

              <div className="divide-y divide-gray-100">
                {lines.map((line, idx) => (
                  <div key={idx} className="p-3 sm:grid sm:grid-cols-12 sm:gap-2 space-y-2 sm:space-y-0 sm:items-center">
                    {/* COA */}
                    <div className="sm:col-span-4">
                      <label className="sm:hidden text-xs text-gray-500">COA</label>
                      <select
                        value={line.account_id}
                        onChange={(e) => {
                          const opt = coaOptions.find((c) => c.id === e.target.value)
                          updateLine(idx, 'account_id', e.target.value)
                          updateLine(idx, 'account_label', opt ? `${opt.account_code} — ${opt.account_name}` : '')
                        }}
                        className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors[`line_${idx}_account`] ? 'border-red-400' : 'border-gray-200'}`}
                      >
                        <option value="">-- Pilih COA --</option>
                        {coaOptions.map((c) => (
                          <option key={c.id} value={c.id}>{c.account_code} — {c.account_name}</option>
                        ))}
                      </select>
                      {errors[`line_${idx}_account`] && (
                        <p className="text-xs text-red-500 mt-0.5">{errors[`line_${idx}_account`]}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div className="sm:col-span-3">
                      <label className="sm:hidden text-xs text-gray-500">Keterangan</label>
                      <input
                        type="text"
                        placeholder="Keterangan (opsional)"
                        value={line.description}
                        onChange={(e) => updateLine(idx, 'description', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Amount */}
                    <div className="sm:col-span-2">
                      <label className="sm:hidden text-xs text-gray-500">Nominal</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={line.amount}
                        onChange={(e) => updateLine(idx, 'amount', e.target.value)}
                        min={0}
                        className={`w-full px-2 py-1.5 text-xs border rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors[`line_${idx}_amount`] ? 'border-red-400' : 'border-gray-200'}`}
                      />
                    </div>

                    {/* Tax */}
                    <div className="sm:col-span-2">
                      <label className="sm:hidden text-xs text-gray-500">Pajak</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={line.tax_amount}
                        onChange={(e) => updateLine(idx, 'tax_amount', e.target.value)}
                        min={0}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Remove */}
                    <div className="sm:col-span-1 flex justify-end sm:justify-center">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 1}
                        className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="bg-gray-50 border-t border-gray-200 px-3 py-2.5 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span>{new Intl.NumberFormat('id-ID').format(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Total Pajak</span>
                  <span>{new Intl.NumberFormat('id-ID').format(totalTax)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-1.5 mt-1">
                  <span>Total</span>
                  <span>Rp {new Intl.NumberFormat('id-ID').format(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes + Confidential */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Catatan</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Catatan tambahan (opsional)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">URL Lampiran</label>
                <input
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isConfidential}
                  onChange={(e) => setIsConfidential(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Konfidensial 🔒</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}