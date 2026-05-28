import { useState } from 'react'
import { Plus, RefreshCw, Trash2, Play } from 'lucide-react'
import {
  useGeneralInvoiceTemplates,
  useDeleteGeneralInvoiceTemplate,
  type GeneralInvoiceTemplate,
} from '../api/generalApi.api'
import { RECURRENCE_OPTIONS, formatDate } from '../constants'
import { TemplateFormModal } from '../components/TemplateFormModal'
import { GenerateFromTemplateModal } from '../components/GenerateFromTemplateModal'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { RecurrenceType } from '../api/generalApi.api'

const recurrenceLabel = (r: RecurrenceType) =>
  RECURRENCE_OPTIONS.find((o) => o.value === r)?.label ?? r

export default function GeneralInvoiceTemplatesPage() {
  const toast = useToast()
  const { data: templates = [], isLoading, refetch } = useGeneralInvoiceTemplates()
  const deleteMutation = useDeleteGeneralInvoiceTemplate()

  const [createOpen, setCreateOpen] = useState(false)
  const [generateTarget, setGenerateTarget] = useState<GeneralInvoiceTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GeneralInvoiceTemplate | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Template dihapus')
      setDeleteTarget(null)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menghapus template'))
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Template Tagihan Rutin</h1>
        <p className="text-sm text-gray-500">
          Template untuk tagihan rutin (listrik, sewa, langganan, dll). Generate = invoice DRAFT.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Template Tagihan Rutin</h2>
            <p className="text-xs text-gray-500">{templates.length} template · generate = invoice DRAFT</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => refetch()} className="p-2 border rounded-lg hover:bg-gray-50" title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              <Plus size={16} /> Template Baru
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat...</div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            Belum ada template. Buat untuk listrik, sewa, langganan, dll.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {templates.map((t) => (
              <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-gray-900">{t.template_name}</p>
                  <p className="text-sm text-gray-600">{t.vendor_name}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>{recurrenceLabel(t.recurrence)}</span>
                    <span>Jatuh tempo +{t.due_date_offset_days} hari</span>
                    {t.last_generated_at && (
                      <span>Terakhir generate: {formatDate(t.last_generated_at)}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {t.lines.length} baris COA
                    {t.default_amount != null && ` · default ${new Intl.NumberFormat('id-ID').format(t.default_amount)}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setGenerateTarget(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Play size={14} /> Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(t)}
                    className="p-2 text-red-500 border border-red-100 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TemplateFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <GenerateFromTemplateModal
        open={!!generateTarget}
        template={generateTarget}
        onClose={() => setGenerateTarget(null)}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold">Hapus template?</h3>
            <p className="text-sm text-gray-600">{deleteTarget.template_name}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border rounded-lg">Batal</button>
              <button type="button" onClick={handleDelete} disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
