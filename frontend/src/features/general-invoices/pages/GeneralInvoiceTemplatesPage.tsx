import { useState } from 'react'
import { Plus, RefreshCw, Trash2, Zap, Settings, Building2 } from 'lucide-react'
import {
  useGeneralInvoiceTemplates,
  useDeleteGeneralInvoiceTemplate,
  useUpdateGeneralInvoiceTemplatePreferredBank,
  type GeneralInvoiceTemplate,
} from '../api/generalApi.api'
import { formatRupiah, RECURRENCE_OPTIONS } from '../constants'
import { TemplateFormModal } from '../components/TemplateFormModal'
import { GenerateFromTemplateModal } from '../components/GenerateFromTemplateModal'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import type { RecurrenceType } from '../api/generalApi.api'

const recurrenceLabel = (r: RecurrenceType) =>
  RECURRENCE_OPTIONS.find((o) => o.value === r)?.label ?? r

export default function GeneralInvoiceTemplatesPage() {
  const toast = useToast()
  const { data: templates = [], isLoading, refetch } = useGeneralInvoiceTemplates()
  const deleteMutation = useDeleteGeneralInvoiceTemplate()
  const updatePreferredBankMutation = useUpdateGeneralInvoiceTemplatePreferredBank()

  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canInsert = hasPermission('general_invoice_templates', 'insert')
  const canUpdate = hasPermission('general_invoice_templates', 'update')
  const canDelete = hasPermission('general_invoice_templates', 'delete')

  const branches = useBranchContextStore((s) => s.branches)
  const currentBranch = useBranchContextStore((s) => s.currentBranch)
  const isMultiBranch = branches.length > 1

  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [generateTarget, setGenerateTarget] = useState<GeneralInvoiceTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GeneralInvoiceTemplate | null>(null)
  const [bankDraft, setBankDraft] = useState<Record<string, number | ''>>({})
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null)

  // Filter templates by branch — single-branch user only sees their branch
  const filteredTemplates = templates.filter((t) => {
    const filterBranch = selectedBranchId || currentBranch?.branch_id
    if (!filterBranch) return true
    return t.branch_id === filterBranch
  })

  const getPreferredBankValue = (template: GeneralInvoiceTemplate): number | '' =>
    bankDraft[template.id] ?? template.preferred_vendor_bank_account_id ?? ''

  const hasBankDraft = (template: GeneralInvoiceTemplate) => {
    const draft = bankDraft[template.id]
    if (draft === undefined) return false
    return draft !== (template.preferred_vendor_bank_account_id ?? '')
  }

  const handlePreferredBankDraft = (templateId: string, bankAccountId: string) => {
    setBankDraft((prev) => ({
      ...prev,
      [templateId]: bankAccountId ? Number(bankAccountId) : '',
    }))
  }

  const handlePreferredBankSave = async (template: GeneralInvoiceTemplate) => {
    const nextId = getPreferredBankValue(template)
    const normalized = nextId === '' ? null : nextId
    if (normalized === template.preferred_vendor_bank_account_id) {
      setBankDraft((prev) => {
        const next = { ...prev }
        delete next[template.id]
        return next
      })
      return
    }
    setPendingTemplateId(template.id)
    try {
      await updatePreferredBankMutation.mutateAsync({
        id: template.id,
        preferred_vendor_bank_account_id: normalized,
      })
      setBankDraft((prev) => {
        const next = { ...prev }
        delete next[template.id]
        return next
      })
      toast.success('Rekening preferred diperbarui')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal memperbarui rekening'))
    } finally {
      setPendingTemplateId(null)
    }
  }

  const handlePreferredBankCancel = (templateId: string) => {
    setBankDraft((prev) => {
      const next = { ...prev }
      delete next[templateId]
      return next
    })
  }

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Request Tagihan</h1>
          <p className="text-sm text-gray-500">
            Pilih tagihan yang ingin diajukan. Invoice DRAFT akan dibuat otomatis.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => refetch()} className="p-2 border rounded-lg hover:bg-gray-50" title="Refresh">
            <RefreshCw size={16} />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800"
            >
              <Settings size={16} /> Kelola Template
            </button>
          )}
        </div>
      </div>

      {/* Branch filter — only show for multi-branch users */}
      {isMultiBranch && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Cabang:</span>
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedBranchId('')}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                !selectedBranchId
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Semua
            </button>
            {branches.map((b) => (
              <button
                key={b.branch_id}
                type="button"
                onClick={() => setSelectedBranchId(b.branch_id)}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                  selectedBranchId === b.branch_id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {b.branch_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Template Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <Zap size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-sm">Belum ada template tagihan.</p>
          {canDelete && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              <Plus size={16} /> Buat Template Pertama
            </button>
          )}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">Tidak ada template untuk cabang ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((t) => (
            <div
              key={t.id}
              className={`bg-white rounded-2xl border p-5 flex flex-col justify-between hover:shadow-md transition-shadow ${
                pendingTemplateId === t.id
                  ? 'border-blue-300 ring-2 ring-blue-100'
                  : hasBankDraft(t)
                    ? 'border-amber-200 ring-1 ring-amber-100'
                    : 'border-gray-200'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-gray-900 text-sm leading-tight">{t.template_name}</h3>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(t) }}
                      className="p-1 text-gray-300 hover:text-red-500 shrink-0"
                      title="Hapus template"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">{t.vendor_name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                    {recurrenceLabel(t.recurrence)}
                  </span>
                  {t.default_amount != null && (
                    <span className="text-xs text-gray-500">
                      ± {formatRupiah(t.default_amount)}
                    </span>
                  )}
                </div>
                {/* Vendor Bank Account Display */}
                {t.vendor_bank_accounts && t.vendor_bank_accounts.length > 0 && (
                  <div className="pt-1">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Building2 size={12} className="shrink-0" />
                      <span>Rekening vendor:</span>
                    </div>
                    {t.vendor_bank_accounts.length === 1 ? (
                      <p className="text-xs text-gray-600 ml-5">
                        {t.vendor_bank_accounts[0].bank_name} – {t.vendor_bank_accounts[0].account_number}
                        {t.preferred_vendor_bank_account_id === t.vendor_bank_accounts[0].id ? ' (preferred)' : ''}
                      </p>
                    ) : (
                      <div className="ml-5 space-y-1.5">
                        <select
                          value={getPreferredBankValue(t)}
                          onChange={(e) => handlePreferredBankDraft(t.id, e.target.value)}
                          disabled={!canUpdate || pendingTemplateId === t.id}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-full bg-white disabled:opacity-60"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="" disabled>Pilih rekening</option>
                          {t.vendor_bank_accounts.map((ba) => (
                            <option key={ba.id} value={ba.id}>
                              {ba.bank_name} – {ba.account_number} ({ba.account_name})
                            </option>
                          ))}
                        </select>
                        {hasBankDraft(t) && canUpdate && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handlePreferredBankSave(t) }}
                              disabled={pendingTemplateId === t.id}
                              className="text-[11px] px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {pendingTemplateId === t.id ? 'Menyimpan...' : 'Simpan'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handlePreferredBankCancel(t.id) }}
                              disabled={pendingTemplateId === t.id}
                              className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                            >
                              Batal
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {t.last_generated_at && (
                  <p className="text-[11px] text-gray-400">
                    Terakhir: {new Date(t.last_generated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>

              {canInsert && (
                <button
                  type="button"
                  onClick={() => setGenerateTarget(t)}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm rounded-xl font-medium hover:bg-green-700 transition-colors"
                >
                  <Zap size={15} /> Request Tagihan
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <TemplateFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <GenerateFromTemplateModal
        open={!!generateTarget}
        template={generateTarget}
        onClose={() => setGenerateTarget(null)}
      />

      {/* Confirm Delete */}
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
