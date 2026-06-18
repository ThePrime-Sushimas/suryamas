import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, AlertCircle, Upload, ExternalLink, HelpCircle } from 'lucide-react'
import {
  useCreateGeneralInvoice,
  useUpdateGeneralInvoice,
  useUploadGeneralInvoiceAttachment,
  useVendors,
} from '../api/generalApi.api'
import { INVOICE_DATE_FIELD_HELP } from '../constants'
import { FieldHint } from '../components/FieldHint'
import { InvoiceSummaryPanel } from '../components/InvoiceSummaryPanel'
import { AccountSelector } from '@/features/accounting/journals/shared/AccountSelector'
import { useChartOfAccountsStore } from '@/features/accounting/chart-of-accounts/store/chartOfAccounts.store'
import { getSignedStorageUrl } from '@/lib/storage'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { GeneralInvoiceDetail, TransactionType } from '../api/generalApi.api'

interface LineForm {
  line_number: number
  account_id: string
  description: string
  amount: string
  tax_amount: string
  tax_account_id: string
  transaction_type: TransactionType
  expense_account_id: string
  total_periods: string
  amortization_start_date: string
}

interface Props {
  open: boolean
  onClose: () => void
  invoice?: GeneralInvoiceDetail | null
  initialVendorId?: string
  initialNotes?: string
  initialAccountCode?: string
}

const emptyLine = (n: number): LineForm => ({
  line_number: n,
  account_id: '',
  description: '',
  amount: '',
  tax_amount: '0',
  tax_account_id: '',
  transaction_type: 'EXPENSE',
  expense_account_id: '',
  total_periods: '',
  amortization_start_date: '',
})

export default function InvoiceFormModal({ open, onClose, invoice, initialVendorId, initialNotes, initialAccountCode }: Props) {
  const isEdit = !!invoice
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const createMutation = useCreateGeneralInvoice()
  const updateMutation = useUpdateGeneralInvoice()
  const uploadAttachment = useUploadGeneralInvoiceAttachment()
  const { data: vendorsData } = useVendors({ is_active: true, limit: 200 })
  const vendors = vendorsData?.data ?? []
  const { fetchPostableAccounts } = useChartOfAccountsStore()

  const [vendorId, setVendorId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [isConfidential, setIsConfidential] = useState(false)
  const [notes, setNotes] = useState('')
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [lines, setLines] = useState<LineForm[]>([emptyLine(1)])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    if (invoice) {
      setVendorId(invoice.vendor_id)
      setInvoiceDate(invoice.invoice_date)
      setDueDate(invoice.due_date ?? '')
      setPeriodStart(invoice.period_start ?? '')
      setPeriodEnd(invoice.period_end ?? '')
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
          tax_account_id: l.tax_account_id ?? '',
          transaction_type: l.transaction_type ?? 'EXPENSE',
          expense_account_id: l.expense_account_id ?? '',
          total_periods: l.total_periods ? String(l.total_periods) : '',
          amortization_start_date: l.amortization_start_date ?? '',
        })),
      )
    } else {
      resetForm()
    }
    setErrors({})
  }, [open, invoice])

  const resetForm = () => {
    setVendorId(initialVendorId ?? '')
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setDueDate('')
    setPeriodStart('')
    setPeriodEnd('')
    setIsConfidential(false)
    setNotes(initialNotes ?? '')
    setAttachmentPath(null)
    setPendingFile(null)

    // Pre-fill first line with account if code provided (e.g. from maintenance)
    if (initialAccountCode) {
      const existing = useChartOfAccountsStore.getState().postableAccounts
      const resolve = (accounts: typeof existing) => {
        const account = accounts.find((a) => a.account_code === initialAccountCode)
        setLines([{ ...emptyLine(1), account_id: account?.id ?? '', description: initialNotes ?? '' }])
      }
      if (existing.length > 0) {
        resolve(existing)
      } else {
        fetchPostableAccounts().then(() => resolve(useChartOfAccountsStore.getState().postableAccounts))
      }
    } else {
      setLines([emptyLine(1)])
    }
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
    if (lines.length === 0) errs.lines = 'Minimal 1 baris diperlukan'
    lines.forEach((l, i) => {
      if (!l.account_id) errs[`line_${i}_account`] = 'COA wajib dipilih'
      if (!l.amount || parseFloat(l.amount) <= 0) errs[`line_${i}_amount`] = 'Nominal wajib diisi'
      if (l.transaction_type === 'PREPAID') {
        if (!l.expense_account_id) errs[`line_${i}_expense_account`] = 'COA beban wajib untuk PREPAID'
        if (!l.total_periods || parseInt(l.total_periods) <= 0) errs[`line_${i}_periods`] = 'Jumlah periode wajib'
        if (!l.amortization_start_date) errs[`line_${i}_start_date`] = 'Tanggal mulai amortisasi wajib'
      }
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
      is_confidential: isConfidential,
      notes: notes || null,
      attachment_url: attachmentPath,
      lines: lines.map((l) => ({
        line_number: l.line_number,
        account_id: l.account_id,
        description: l.description || null,
        amount: parseFloat(l.amount) || 0,
        tax_amount: parseFloat(l.tax_amount) || 0,
        tax_account_id: l.tax_account_id || null,
        transaction_type: l.transaction_type,
        ...(l.transaction_type === 'PREPAID' ? {
          expense_account_id: l.expense_account_id,
          total_periods: parseInt(l.total_periods) || undefined,
          amortization_start_date: l.amortization_start_date || undefined,
        } : {}),
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
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Baris Invoice *</label>
                <div className="relative group">
                  <button type="button" className="p-0.5 text-gray-400 hover:text-blue-600 transition-colors" aria-label="Panduan penggunaan akun">
                    <HelpCircle size={14} />
                  </button>
                  <div className="absolute left-0 bottom-full mb-2 w-80 p-3 bg-gray-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    <p className="font-semibold mb-2">Pilih akun beban sesuai jenis tagihan:</p>
                    <div className="space-y-1.5 text-gray-200">
                      <div>
                        <p className="text-gray-400 font-medium text-[10px] uppercase tracking-wider">Tempat Usaha</p>
                        <p><span className="font-mono text-green-300">610301</span> Sewa Tempat</p>
                        <p><span className="font-mono text-green-300">610303</span> Listrik</p>
                        <p><span className="font-mono text-green-300">610304</span> Air (PDAM)</p>
                        <p><span className="font-mono text-green-300">610305</span> Gas</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium text-[10px] uppercase tracking-wider">Pemeliharaan</p>
                        <p><span className="font-mono text-green-300">610601</span> Perbaikan & Pemeliharaan</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium text-[10px] uppercase tracking-wider">Jasa & Umum</p>
                        <p><span className="font-mono text-green-300">610504</span> Biaya Teknologi</p>
                        <p><span className="font-mono text-green-300">610705</span> Telekomunikasi</p>
                        <p><span className="font-mono text-green-300">610701</span> Asuransi</p>
                      </div>
                    </div>
                    <p className="mt-2 text-gray-400 border-t border-gray-700 pt-1.5">Akun hutang (AP) otomatis saat invoice di-post. Cukup pilih akun beban saja.</p>
                    <div className="absolute left-3 -bottom-1.5 w-3 h-3 bg-gray-900 rotate-45" />
                  </div>
                </div>
              </div>
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
              {lines.map((line, idx) => {
                // Compute end date helper for PREPAID
                const endDateHint = (() => {
                  if (line.transaction_type !== 'PREPAID' || !line.amortization_start_date || !line.total_periods) return null
                  const periods = parseInt(line.total_periods)
                  if (!periods || periods <= 0) return null
                  const start = new Date(line.amortization_start_date)
                  if (isNaN(start.getTime())) return null
                  const end = new Date(start)
                  end.setMonth(end.getMonth() + periods - 1)
                  return end.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
                })()

                return (
                  <div key={idx} className="p-3 space-y-2">
                    {/* Header: type badge + delete */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-gray-400">#{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => updateLine(idx, 'transaction_type', line.transaction_type === 'PREPAID' ? 'EXPENSE' : 'PREPAID')}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                            line.transaction_type === 'PREPAID'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {line.transaction_type === 'PREPAID' ? '⏱ Prepaid' : '⚡ Expense'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 1}
                        className="p-1 text-red-400 disabled:opacity-30 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Main fields: COA + Description + Amount + Tax */}
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <label className="text-[10px] text-gray-500">
                          {line.transaction_type === 'PREPAID' ? 'Akun Prepaid (Aset)' : 'Akun Beban'}
                        </label>
                        <AccountSelector
                          value={line.account_id}
                          onChange={(accountId) => updateLine(idx, 'account_id', accountId)}
                          placeholder={line.transaction_type === 'PREPAID' ? 'Pilih akun prepaid (1xxx)...' : 'Pilih akun beban (6xxx)...'}
                          priorityPrefix={line.transaction_type === 'PREPAID' ? ['1'] : ['6', '5']}
                          accountInfo={
                            invoice?.lines[idx]
                              ? {
                                  account_code: invoice.lines[idx].account_code,
                                  account_name: invoice.lines[idx].account_name,
                                  account_type: line.transaction_type === 'PREPAID' ? 'ASSET' : 'EXPENSE',
                                }
                              : undefined
                          }
                        />
                        {errors[`line_${idx}_account`] && (
                          <p className="text-xs text-red-500 mt-0.5">{errors[`line_${idx}_account`]}</p>
                        )}
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-gray-500">Keterangan</label>
                        <input
                          type="text"
                          placeholder="Opsional"
                          value={line.description}
                          onChange={(e) => updateLine(idx, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-gray-500">Nominal</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={line.amount}
                          onChange={(e) => updateLine(idx, 'amount', e.target.value)}
                          min={0}
                          className={`w-full px-2 py-1.5 text-xs border rounded-lg text-right ${errors[`line_${idx}_amount`] ? 'border-red-400' : 'border-gray-200'}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-gray-500">Pajak</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={line.tax_amount}
                          onChange={(e) => updateLine(idx, 'tax_amount', e.target.value)}
                          min={0}
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-right"
                        />
                      </div>
                    </div>

                    {/* Tax account selector — muncul jika pajak > 0 */}
                    {parseFloat(line.tax_amount) > 0 && (
                      <div className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-5">
                          <label className="text-[10px] text-gray-500">Akun Pajak (opsional)</label>
                          <AccountSelector
                            value={line.tax_account_id}
                            onChange={(id) => updateLine(idx, 'tax_account_id', id)}
                            placeholder="Kosong = pajak ikut akun utama"
                            priorityPrefix={['1106', '11']}
                          />
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Isi jika PPN bisa dikreditkan (mis. PPN Masukan)
                          </p>
                        </div>
                      </div>
                    )}

                    {/* PREPAID expand section */}
                    {line.transaction_type === 'PREPAID' && (
                      <div className="border-l-2 border-amber-300 pl-3 ml-1 pt-1 space-y-2 animate-in slide-in-from-top-1 duration-200">
                        <p className="text-[10px] text-amber-600 font-medium">Jadwal Amortisasi</p>
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-5">
                            <label className="text-[10px] text-gray-500">Akun Beban (amortisasi ke)</label>
                            <AccountSelector
                              value={line.expense_account_id}
                              onChange={(id) => updateLine(idx, 'expense_account_id', id)}
                              placeholder="Pilih akun beban (6xxx)..."
                              priorityPrefix={['6', '5']}
                            />
                            {errors[`line_${idx}_expense_account`] && (
                              <p className="text-xs text-red-500 mt-0.5">{errors[`line_${idx}_expense_account`]}</p>
                            )}
                          </div>
                          <div className="col-span-3">
                            <label className="text-[10px] text-gray-500">Jumlah Periode</label>
                            <input
                              type="number"
                              placeholder="12"
                              value={line.total_periods}
                              onChange={(e) => updateLine(idx, 'total_periods', e.target.value)}
                              min={1}
                              className={`w-full px-2 py-1.5 text-xs border rounded-lg ${errors[`line_${idx}_periods`] ? 'border-red-400' : 'border-gray-200'}`}
                            />
                            <p className="text-[10px] text-gray-400 mt-0.5">bulan</p>
                          </div>
                          <div className="col-span-4">
                            <label className="text-[10px] text-gray-500">Mulai Amortisasi</label>
                            <input
                              type="date"
                              value={line.amortization_start_date}
                              onChange={(e) => updateLine(idx, 'amortization_start_date', e.target.value)}
                              className={`w-full px-2 py-1.5 text-xs border rounded-lg ${errors[`line_${idx}_start_date`] ? 'border-red-400' : 'border-gray-200'}`}
                            />
                            {endDateHint && (
                              <p className="text-[10px] text-amber-600 mt-0.5">selesai {endDateHint}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-900 flex justify-between">
                <span>Total</span>
                <span>Rp {new Intl.NumberFormat('id-ID').format(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Ringkasan naratif — muncul setelah data terisi */}
          <InvoiceSummaryPanel
            vendorName={vendors.find((v) => v.id === vendorId)?.vendor_name ?? ''}
            invoiceDate={invoiceDate}
            dueDate={dueDate}
            periodStart={periodStart}
            periodEnd={periodEnd}
            lines={lines}
            totalAmount={totalAmount}
          />

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
