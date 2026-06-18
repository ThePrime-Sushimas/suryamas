import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Plus, RefreshCw, Loader2, X, CheckCircle2, FileText } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import {
  useMaintenance,
  useCreateMaintenance,
  useCompleteMaintenance,
  useAssets,
  type MaintenanceStatus,
  type CreateMaintenanceDto,
} from '../api/fixed-assets.api'
import { useVendors } from '@/features/general-invoices/api/generalApi.api'

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<MaintenanceStatus, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  POSTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  POSTED: 'Posted',
}

function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

// ─── Create Maintenance Form Modal ──────────────────────────────────────────

interface MaintenanceFormModalProps {
  open: boolean
  onClose: () => void
}

function MaintenanceFormModal({ open, onClose }: MaintenanceFormModalProps) {
  const toast = useToast()
  const createMutation = useCreateMaintenance()

  const [form, setForm] = useState({
    fixed_asset_id: '',
    maintenance_date: new Date().toISOString().split('T')[0],
    description: '',
    vendor_id: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch only ACTIVE assets for selection
  const { data: assetsData } = useAssets({ status: 'ACTIVE', limit: 100 })
  const activeAssets = assetsData?.data ?? []

  // Fetch vendors for selection
  const { data: vendorsData } = useVendors({ is_active: true, limit: 200 })
  const vendors = vendorsData?.data ?? []

  useEffect(() => {
    if (!open) return
    setForm({
      fixed_asset_id: '',
      maintenance_date: new Date().toISOString().split('T')[0],
      description: '',
      vendor_id: '',
    })
    setErrors({})
  }, [open])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.fixed_asset_id) errs.fixed_asset_id = 'Pilih aset terlebih dahulu'
    if (!form.maintenance_date) errs.maintenance_date = 'Tanggal wajib diisi'
    if (!form.description.trim()) errs.description = 'Deskripsi wajib diisi'
    if (!form.vendor_id) errs.vendor_id = 'Pilih vendor terlebih dahulu'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    try {
      const body: CreateMaintenanceDto = {
        fixed_asset_id: form.fixed_asset_id,
        maintenance_date: form.maintenance_date,
        description: form.description,
        vendor_id: form.vendor_id,
      }

      await createMutation.mutateAsync(body)
      toast.success('Maintenance berhasil dicatat')
      onClose()
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal mencatat maintenance'))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 dark:bg-black/70 overflow-y-auto py-6 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Request Maintenance Baru
          </h2>
          <button type="button" onClick={onClose} disabled={createMutation.isPending} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Asset Selection */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Aset *</label>
            <select
              value={form.fixed_asset_id}
              onChange={(e) => setForm(prev => ({ ...prev, fixed_asset_id: e.target.value }))}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.fixed_asset_id ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
              }`}
            >
              <option value="">Pilih aset aktif...</option>
              {activeAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.asset_code} - {asset.asset_name}
                </option>
              ))}
            </select>
            {errors.fixed_asset_id && <p className="text-xs text-red-500">{errors.fixed_asset_id}</p>}
          </div>

          {/* Vendor Selection */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Vendor *</label>
            <select
              value={form.vendor_id}
              onChange={(e) => setForm(prev => ({ ...prev, vendor_id: e.target.value }))}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.vendor_id ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
              }`}
            >
              <option value="">Pilih vendor...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendor_code} - {v.vendor_name}
                </option>
              ))}
            </select>
            {errors.vendor_id && <p className="text-xs text-red-500">{errors.vendor_id}</p>}
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Tanggal Maintenance *</label>
            <input
              type="date"
              value={form.maintenance_date}
              onChange={(e) => setForm(prev => ({ ...prev, maintenance_date: e.target.value }))}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.maintenance_date ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
              }`}
            />
            {errors.maintenance_date && <p className="text-xs text-red-500">{errors.maintenance_date}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Deskripsi *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Deskripsi pekerjaan maintenance..."
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none ${
                errors.description ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
              }`}
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function AssetMaintenancePage() {
  const toast = useToast()
  const navigate = useNavigate()

  // State
  const [formOpen, setFormOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pendingCompleteRec, setPendingCompleteRec] = useState<typeof records[number] | null>(null)

  // Queries
  const { data, isLoading, refetch, isFetching } = useMaintenance({ page, limit: 25 })
  const records = data?.data ?? []
  const pagination = data?.pagination

  // Mutations
  const completeMutation = useCompleteMaintenance()

  // Handlers
  const handleCompleteAndInvoice = async () => {
    if (!pendingCompleteRec) return
    try {
      await completeMutation.mutateAsync(pendingCompleteRec.id)
      toast.success('Maintenance selesai')
      // Navigate to general invoice create with pre-fill
      const params = new URLSearchParams()
      if (pendingCompleteRec.vendor_id) params.set('vendor_id', pendingCompleteRec.vendor_id)
      if (pendingCompleteRec.asset_branch_id) params.set('branch_id', pendingCompleteRec.asset_branch_id)
      const notes = `Pemeliharaan Aset ${pendingCompleteRec.asset_code ?? ''} - ${pendingCompleteRec.asset_name ?? ''}: ${pendingCompleteRec.description}`
      params.set('notes', notes)
      params.set('source', 'maintenance')
      params.set('account_code', '610601')
      setPendingCompleteRec(null)
      navigate(`/finance/general-invoices?${params.toString()}`)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal menyelesaikan maintenance'))
      setPendingCompleteRec(null)
    }
  }

  const handleNavigateToInvoice = (rec: typeof records[number]) => {
    const params = new URLSearchParams()
    if (rec.vendor_id) params.set('vendor_id', rec.vendor_id)
    if (rec.asset_branch_id) params.set('branch_id', rec.asset_branch_id)
    const notes = `Pemeliharaan Aset ${rec.asset_code ?? ''} - ${rec.asset_name ?? ''}: ${rec.description}`
    params.set('notes', notes)
    params.set('source', 'maintenance')
    params.set('account_code', '610601')
    navigate(`/finance/general-invoices?${params.toString()}`)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
              <Wrench className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Maintenance Aset
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {pagination?.total ?? 0} catatan maintenance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Request Maintenance
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kode Aset</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Aset</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-6 py-5">
                      <div className="h-5 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
                    </td></tr>
                  ))
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-16 text-center">
                    <Wrench className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">Belum ada catatan maintenance</p>
                  </td></tr>
                ) : records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/30">
                    <td className="px-6 py-4 font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                      {rec.asset_code || '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {rec.asset_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {fmtDate(rec.maintenance_date)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 max-w-[200px] truncate">
                      {rec.description}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {rec.vendor_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <MaintenanceStatusBadge status={rec.status} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {rec.status === 'IN_PROGRESS' && (
                          <button
                            type="button"
                            onClick={() => setPendingCompleteRec(rec)}
                            disabled={completeMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Selesai & Buat Invoice
                          </button>
                        )}
                        {rec.status === 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => handleNavigateToInvoice(rec)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Buat Invoice
                          </button>
                        )}
                        {rec.status === 'POSTED' && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">Belum ada catatan maintenance</div>
            ) : records.map((rec) => (
              <div key={rec.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">
                      {rec.asset_code || '—'}
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white truncate">{rec.asset_name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {fmtDate(rec.maintenance_date)} · {rec.vendor_name || 'No vendor'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                      {rec.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <MaintenanceStatusBadge status={rec.status} />
                    {rec.status === 'IN_PROGRESS' && (
                      <button
                        type="button"
                        onClick={() => setPendingCompleteRec(rec)}
                        disabled={completeMutation.isPending}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                      >
                        Selesai & Buat Invoice
                      </button>
                    )}
                    {rec.status === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => handleNavigateToInvoice(rec)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors"
                      >
                        Buat Invoice
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/50 p-4">
              <Pagination
                pagination={pagination}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── Create Form Modal ──────────────────────────────────────────── */}
      <MaintenanceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />

      {/* ─── Complete & Invoice Confirmation Modal ───────────────────── */}
      <ConfirmModal
        isOpen={!!pendingCompleteRec}
        onClose={() => setPendingCompleteRec(null)}
        onConfirm={handleCompleteAndInvoice}
        title="Selesai & Buat Invoice"
        message="Maintenance akan ditandai selesai, status aset kembali ACTIVE, dan Anda akan diarahkan ke halaman pembuatan invoice. Lanjutkan?"
        confirmText="Selesai & Buat Invoice"
        variant="success"
        isLoading={completeMutation.isPending}
      />
    </div>
  )
}
