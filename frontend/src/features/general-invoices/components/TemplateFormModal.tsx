import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useCreateGeneralInvoiceTemplate, useVendors } from '../api/generalApi.api'
import { RECURRENCE_OPTIONS } from '../constants'
import { AccountSelector } from '@/features/accounting/journals/shared/AccountSelector'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import type { RecurrenceType } from '../api/generalApi.api'

interface LineForm {
  line_number: number
  account_id: string
  description: string
  amount_ratio: string
}

interface Props {
  open: boolean
  onClose: () => void
}

const emptyLine = (n: number): LineForm => ({
  line_number: n,
  account_id: '',
  description: '',
  amount_ratio: '',
})

export function TemplateFormModal({ open, onClose }: Props) {
  const toast = useToast()
  const createMutation = useCreateGeneralInvoiceTemplate()
  const { data: vendorsData } = useVendors({ is_active: true, limit: 200 })
  const vendors = vendorsData?.data ?? []
  const branches = useBranchContextStore((s) => s.branches)
  const currentBranch = useBranchContextStore((s) => s.currentBranch)

  const [branchId, setBranchId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [recurrence, setRecurrence] = useState<RecurrenceType>('MONTHLY')
  const [defaultAmount, setDefaultAmount] = useState('')
  const [dueOffset, setDueOffset] = useState('14')
  const [isConfidential, setIsConfidential] = useState(false)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineForm[]>([emptyLine(1)])

  useEffect(() => {
    if (!open) return
    setBranchId(currentBranch?.branch_id ?? '')
    setTemplateName('')
    setVendorId('')
    setRecurrence('MONTHLY')
    setDefaultAmount('')
    setDueOffset('14')
    setIsConfidential(false)
    setNotes('')
    setLines([emptyLine(1)])
  }, [open])

  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  const handleSubmit = async () => {
    if (!branchId) {
      toast.warning('Cabang wajib dipilih')
      return
    }
    if (!templateName.trim() || !vendorId) {
      toast.warning('Nama template dan vendor wajib diisi')
      return
    }
    if (lines.some((l) => !l.account_id)) {
      toast.warning('Semua baris harus punya COA')
      return
    }

    try {
      await createMutation.mutateAsync({
        branch_id: branchId,
        template_name: templateName.trim(),
        vendor_id: vendorId,
        recurrence,
        default_amount: defaultAmount ? parseFloat(defaultAmount) : null,
        due_date_offset_days: parseInt(dueOffset, 10) || 14,
        is_confidential: isConfidential,
        notes: notes || null,
        lines: lines.map((l) => ({
          line_number: l.line_number,
          account_id: l.account_id,
          description: l.description || null,
          amount_ratio: l.amount_ratio ? parseFloat(l.amount_ratio) : null,
        })),
      })
      toast.success('Template berhasil dibuat')
      onClose()
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal membuat template'))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Template Tagihan Rutin</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <input
            placeholder="Nama template (mis. Listrik Cabang A)"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg"
          />
          <div className="grid grid-cols-2 gap-3">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="px-3 py-2 text-sm border rounded-lg">
              <option value="">-- Cabang --</option>
              {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
            </select>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="px-3 py-2 text-sm border rounded-lg">
              <option value="">-- Vendor --</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
            </select>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as RecurrenceType)} className="px-3 py-2 text-sm border rounded-lg">
              {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="number" placeholder="Default amount (opsional)" value={defaultAmount} onChange={(e) => setDefaultAmount(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg" />
            <input type="number" placeholder="Jatuh tempo +hari" value={dueOffset} onChange={(e) => setDueOffset(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg" />
          </div>

          <div className="space-y-2 border rounded-xl p-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-600">Baris COA</span>
              <button type="button" onClick={() => setLines((p) => [...p, emptyLine(p.length + 1)])} className="text-xs text-blue-600">
                <Plus size={12} className="inline" /> Baris
              </button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <AccountSelector value={line.account_id} onChange={(id) => updateLine(idx, 'account_id', id)} placeholder="COA" />
                </div>
                <input className="col-span-3 px-2 py-1.5 text-xs border rounded-lg" placeholder="Ket." value={line.description}
                  onChange={(e) => updateLine(idx, 'description', e.target.value)} />
                <input className="col-span-3 px-2 py-1.5 text-xs border rounded-lg" placeholder="Rasio 0-1" value={line.amount_ratio}
                  onChange={(e) => updateLine(idx, 'amount_ratio', e.target.value)} />
                <button type="button" disabled={lines.length <= 1} onClick={() => setLines((p) => p.filter((_, i) => i !== idx).map((l, i) => ({ ...l, line_number: i + 1 })))}
                  className="col-span-1 text-red-400 disabled:opacity-30"><Trash2 size={13} /></button>
              </div>
            ))}
            <p className="text-[11px] text-gray-500">Rasio: bagian dari default amount (mis. 1 = 100%). Kosongkan jika nominal diisi manual saat generate.</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isConfidential} onChange={(e) => setIsConfidential(e.target.checked)} />
            Konfidensial
          </label>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Batal</button>
          <button type="button" onClick={handleSubmit} disabled={createMutation.isPending}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-60">
            {createMutation.isPending ? 'Menyimpan...' : 'Simpan Template'}
          </button>
        </div>
      </div>
    </div>
  )
}
