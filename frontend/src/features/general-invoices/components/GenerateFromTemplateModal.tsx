import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
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
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [lineAmounts, setLineAmounts] = useState<Record<number, { amount: string; tax: string }>>({})
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open || !template) return
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setInvoiceNumber('')
    setNotes(template.notes ?? '')
    const amounts: Record<number, { amount: string; tax: string }> = {}
    for (const line of template.lines) {
      const fromDefault =
        template.default_amount && line.amount_ratio
          ? String(template.default_amount * line.amount_ratio)
          : ''
      amounts[line.line_number] = { amount: fromDefault, tax: '0' }
    }
    setLineAmounts(amounts)
  }, [open, template])

  const handleSubmit = async () => {
    if (!template) return
    const line_amounts = template.lines
      .map((l) => {
        const a = lineAmounts[l.line_number]
        const amount = parseFloat(a?.amount ?? '0')
        if (amount <= 0) return null
        return {
          line_number: l.line_number,
          amount,
          tax_amount: parseFloat(a?.tax ?? '0') || 0,
        }
      })
      .filter(Boolean) as Array<{ line_number: number; amount: number; tax_amount?: number }>

    if (line_amounts.length === 0) {
      toast.warning('Isi minimal satu nominal baris')
      return
    }

    try {
      const inv = await generate.mutateAsync({
        template_id: template.id,
        invoice_date: invoiceDate,
        invoice_number: invoiceNumber.trim() || undefined,
        line_amounts,
        notes: notes || null,
      })
      toast.success(`Invoice ${inv.invoice_number} dibuat (DRAFT). Review lalu posting.`)
      onClose()
      navigate('/finance/general-invoices')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal generate invoice'))
    }
  }

  if (!open || !template) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold text-gray-900">Generate dari Template</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            <p className="font-semibold">{template.template_name}</p>
            <p className="text-gray-500">{template.vendor_name}</p>
            {template.default_amount != null && (
              <p className="text-xs text-gray-500 mt-1">Default: {formatRupiah(template.default_amount)}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Tgl tagihan</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border rounded-lg" />
            </div>
            <div>
              <label className="text-xs text-gray-600">No. invoice (opsional)</label>
              <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Auto-generate"
                className="w-full mt-1 px-3 py-2 text-sm border rounded-lg" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">Nominal per baris</p>
            {template.lines.map((line) => (
              <div key={line.line_number} className="text-xs border rounded-lg p-2 space-y-1">
                <p className="font-medium text-gray-700">{line.account_code} — {line.account_name}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Nominal"
                    value={lineAmounts[line.line_number]?.amount ?? ''}
                    onChange={(e) =>
                      setLineAmounts((prev) => ({
                        ...prev,
                        [line.line_number]: { ...prev[line.line_number], amount: e.target.value, tax: prev[line.line_number]?.tax ?? '0' },
                      }))
                    }
                    className="px-2 py-1.5 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Pajak"
                    value={lineAmounts[line.line_number]?.tax ?? '0'}
                    onChange={(e) =>
                      setLineAmounts((prev) => ({
                        ...prev,
                        [line.line_number]: { amount: prev[line.line_number]?.amount ?? '', tax: e.target.value },
                      }))
                    }
                    className="px-2 py-1.5 border rounded-lg"
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-500">
            Invoice dibuat status DRAFT. Anda masih perlu review dan posting manual (tidak auto-jurnal).
          </p>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Batal</button>
          <button type="button" onClick={handleSubmit} disabled={generate.isPending}
            className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-60">
            {generate.isPending ? 'Membuat...' : 'Generate Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
