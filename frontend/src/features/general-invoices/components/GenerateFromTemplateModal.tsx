import { useState, useEffect } from 'react'
import { X, Zap, FileText } from 'lucide-react'
import { useGenerateFromTemplate, type GeneralInvoiceTemplate } from '../api/generalApi.api'
import { formatRupiah } from '../constants'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useNavigate } from 'react-router-dom'

interface Props {
  open: boolean
  onClose: () => void
  template: GeneralInvoiceTemplate | null
}

export function GenerateFromTemplateModal({ open, onClose, template }: Props) {
  const toast = useToast()
  const navigate = useNavigate()
  const generate = useGenerateFromTemplate()

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open || !template) return
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setNotes('')
  }, [open, template])

  // Nominal diambil langsung dari template
  // Logic: jika amount_ratio ada → pakai ratio × default_amount
  //        jika ratio null tapi default_amount ada → single line pakai full default_amount
  //        jika keduanya null → 0 (template belum dikonfigurasi)
  const computedLines = (template?.lines ?? []).map((line) => {
    let amount = 0
    if (template?.default_amount != null) {
      if (line.amount_ratio != null && line.amount_ratio > 0) {
        amount = Math.round(template.default_amount * line.amount_ratio)
      } else if ((template?.lines ?? []).length === 1) {
        // Single line tanpa ratio → pakai full default_amount
        amount = Math.round(template.default_amount)
      }
    }
    return { line_number: line.line_number, amount, description: line.description || line.account_name }
  })

  const totalAmount = computedLines.reduce((sum, l) => sum + l.amount, 0)

  const handleSubmit = async () => {
    if (!template) return

    if (totalAmount <= 0) {
      toast.warning('Template belum memiliki nominal. Hubungi admin untuk mengatur nominal di template.')
      return
    }

    const line_amounts = computedLines
      .filter((l) => l.amount > 0)
      .map((l) => ({ line_number: l.line_number, amount: l.amount }))

    try {
      const inv = await generate.mutateAsync({
        template_id: template.id,
        invoice_date: invoiceDate,
        line_amounts,
        notes: notes || null,
      })
      toast.success(`Request berhasil! Invoice ${inv.invoice_number} dibuat.`)
      onClose()
      navigate('/finance/general-invoices')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal membuat request'))
    }
  }

  if (!open || !template) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <FileText size={18} className="text-green-600" />
            Konfirmasi Request
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Template info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="font-bold text-gray-900">{template.template_name}</p>
            <p className="text-sm text-gray-500">{template.vendor_name}</p>
          </div>

          {/* Nominal breakdown (read-only) */}
          <div className="space-y-2">
            {computedLines.map((line) => (
              <div key={line.line_number} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{line.description}</span>
                <span className="font-semibold text-gray-900">{formatRupiah(line.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-lg font-bold text-green-700">{formatRupiah(totalAmount)}</span>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Tanggal</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Catatan (opsional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mis. token listrik bulan Juni"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            Invoice DRAFT akan dibuat. Admin akan review dan memproses pembayaran.
          </p>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={generate.isPending || totalAmount <= 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Zap size={15} />
            {generate.isPending ? 'Membuat...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
