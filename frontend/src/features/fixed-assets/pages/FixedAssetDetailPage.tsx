import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useListNavigation } from '@/lib/urlFilters'
import { parseApiError } from '@/lib/errorParser'
import {
  ArrowLeft,
  ArrowRightLeft,
  Edit2,
  Wrench,
  Trash2,
  QrCode,
  TrendingDown,
  ArrowUpRight,
  Package,
  Calendar,
  Building,
  Hash,
  MapPin,
  FileText,
  PlayCircle,
  Loader2,
  X,
  Camera,
  ImagePlus,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import {
  useAsset,
  useAssetMovements,
  useActivateAsset,
  useCreateDisposal,
  useCreateMaintenance,
  useCreateTransfer,
  useUpdateAsset,
  useAssetPhotos,
  useUploadAssetPhoto,
  useDeleteAssetPhoto,
} from '../api/fixed-assets.api'
import type {
  AssetStatus,
  CreateDisposalDto,
  CreateMaintenanceDto,
  CreateTransferDto,
  DisposalMethod,
  FixedAsset,
  MovementType,
  AssetMovement,
  UpdateAssetDto,
} from '../api/fixed-assets.api'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'

interface BranchOption {
  id: string
  branch_name: string
  branch_code: string
  company_id: string
}

const today = () => new Date().toISOString().split('T')[0]

const useCompanyBranches = (companyId: string | undefined) =>
  useQuery({
    queryKey: ['branches', 'active', companyId],
    queryFn: async () => {
      const { data } = await api.get('/branches', {
        params: { limit: 100, status: 'active' },
      })
      return ((data.data || []) as BranchOption[]).filter(
        (branch) => branch.company_id === companyId
      )
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  })

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<AssetStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MAINTENANCE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  DISPOSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_LABELS: Record<AssetStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Aktif',
  MAINTENANCE: 'Maintenance',
  DISPOSED: 'Disposed',
}

// ─── Movement Type Config ────────────────────────────────────────────────────

const MOVEMENT_STYLES: Record<MovementType, { label: string; color: string; icon: typeof ArrowUpRight }> = {
  CAPITALIZE: { label: 'Kapitalisasi', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: ArrowUpRight },
  DEPRECIATION: { label: 'Penyusutan', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: TrendingDown },
  TRANSFER: { label: 'Transfer', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: ArrowRightLeft },
  MAINTENANCE: { label: 'Maintenance', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Wrench },
  MAINTENANCE_COMPLETE: { label: 'Selesai Maintenance', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', icon: Wrench },
  DISPOSAL: { label: 'Pelepasan', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Trash2 },
  COST_ADJUSTMENT: { label: 'Penyesuaian Biaya', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: FileText },
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtCurrency = (n: number) =>
  `Rp ${n.toLocaleString('id-ID')}`

// ─── Page Component ──────────────────────────────────────────────────────────

export default function FixedAssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { backToList } = useListNavigation('/fixed-assets')
  const hasPermission = usePermissionStore((state) => state.hasPermission)
  const toast = useToast()

  const canUpdate = hasPermission('fixed_assets', 'update')
  const canApprove = hasPermission('fixed_assets', 'approve')

  const { data: asset, isLoading, refetch: refetchAsset } = useAsset(id ?? '')
  const { data: movementsResult, isLoading: movementsLoading, refetch: refetchMovements } = useAssetMovements(id ?? '')
  const { mutateAsync: activateAsset, isPending: isActivating } = useActivateAsset()
  const updateAssetMutation = useUpdateAsset()
  const createTransferMutation = useCreateTransfer()
  const createMaintenanceMutation = useCreateMaintenance()
  const createDisposalMutation = useCreateDisposal()

  // Fetch branches for resolving branch names in movement timeline (before early returns to respect Rules of Hooks)
  const { data: branchesData } = useCompanyBranches(asset?.company_id)
  const branchMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const branch of branchesData ?? []) {
      map.set(branch.id, branch.branch_name)
    }
    return map
  }, [branchesData])

  const [showActivateConfirm, setShowActivateConfirm] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [disposeOpen, setDisposeOpen] = useState(false)

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading detail...</div>
  if (!asset) return <div className="p-8 text-center text-gray-500">Aset tidak ditemukan</div>

  // Action button visibility based on status
  const isDraft = asset.status === 'DRAFT'
  const canTransfer = asset.status === 'ACTIVE' && canUpdate
  const canMaintenance = asset.status === 'ACTIVE' && canUpdate
  const canDispose = (asset.status === 'ACTIVE' || asset.status === 'MAINTENANCE') && canApprove

  // Sort movements chronologically (newest first)
  const sortedMovements = [...(movementsResult?.data ?? [])].sort(
    (a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime()
  )

  const handleActivate = async () => {
    try {
      await activateAsset({ id: asset.id })
      toast.success('Aset berhasil diaktifkan')
      setShowActivateConfirm(false)
      refetchAsset()
      refetchMovements()
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal mengaktifkan aset'))
    }
  }

  const refreshDetail = () => {
    refetchAsset()
    refetchMovements()
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={backToList}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {asset.asset_code}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[asset.status]}`}>
                  {STATUS_LABELS[asset.status]}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {asset.asset_name}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {canUpdate && (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            )}
            {isDraft && canUpdate && (
              <button
                onClick={() => setShowActivateConfirm(true)}
                disabled={isActivating}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                <PlayCircle className="w-4 h-4" /> Aktifkan
              </button>
            )}
            {canTransfer && (
              <button
                onClick={() => setTransferOpen(true)}
                className="flex items-center gap-2 px-3 py-2 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm font-medium transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" /> Transfer
              </button>
            )}
            {canMaintenance && (
              <button
                onClick={() => setMaintenanceOpen(true)}
                className="flex items-center gap-2 px-3 py-2 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-sm font-medium transition-colors"
              >
                <Wrench className="w-4 h-4" /> Maintenance
              </button>
            )}
            {canDispose && (
              <button
                onClick={() => setDisposeOpen(true)}
                className="flex items-center gap-2 px-3 py-2 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Dispose
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* Detail Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DetailCard label="Harga Perolehan" value={fmtCurrency(asset.cost)} icon={Package} />
          <DetailCard label="Nilai Sisa" value={fmtCurrency(asset.salvage_value)} icon={TrendingDown} />
          <DetailCard label="Akumulasi Penyusutan" value={fmtCurrency(asset.accumulated_depreciation)} icon={TrendingDown} />
          <DetailCard label="Nilai Buku" value={fmtCurrency(asset.book_value)} icon={Package} highlight />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Asset Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Asset Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Informasi Aset</h2>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={Calendar} label="Tgl Perolehan" value={fmtDate(asset.acquisition_date)} />
                <InfoRow
                  icon={Calendar}
                  label="Tgl Kapitalisasi"
                  value={asset.capitalized_date ? fmtDate(asset.capitalized_date) : '—'}
                />
                <InfoRow icon={Building} label="Branch" value={asset.branch_name || '—'} />
                <InfoRow icon={Package} label="Kategori" value={asset.category_name || '—'} />
                <InfoRow icon={Hash} label="Serial Number" value={asset.serial_number || '—'} />
                <InfoRow icon={MapPin} label="Lokasi" value={asset.location_note || '—'} />
                <InfoRow
                  icon={TrendingDown}
                  label="Metode Penyusutan"
                  value={asset.depreciation_method === 'STRAIGHT_LINE' ? 'Garis Lurus' : 'Saldo Menurun'}
                />
                <InfoRow icon={Calendar} label="Masa Manfaat" value={`${asset.useful_life_months} bulan`} />
                {asset.description && (
                  <div className="sm:col-span-2">
                    <InfoRow icon={FileText} label="Deskripsi" value={asset.description} />
                  </div>
                )}
              </div>
            </div>

            {/* Asset Photos */}
            <AssetPhotoGallery assetId={asset.id} canEdit={!!canUpdate} />

            {/* Movement Timeline */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Riwayat Pergerakan Aset</h2>
              </div>
              <div className="p-5">
                {movementsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : sortedMovements.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Belum ada riwayat pergerakan</p>
                ) : (
                  <AssetMovementTimeline movements={sortedMovements} branchMap={branchMap} />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: QR Code */}
          <div className="space-y-6">
            {asset.qr_code_url && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <QrCode className="w-4 h-4" /> QR Code
                  </h2>
                </div>
                <div className="p-5 flex justify-center">
                  <img
                    src={asset.qr_code_url}
                    alt={`QR Code - ${asset.asset_code}`}
                    className="w-48 h-48 object-contain rounded-lg border border-gray-200 dark:border-gray-600"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activate Confirmation Modal */}
      <ConfirmModal
        isOpen={showActivateConfirm}
        onClose={() => setShowActivateConfirm(false)}
        onConfirm={handleActivate}
        title="Aktifkan Aset"
        message={`Apakah Anda yakin ingin mengaktifkan ${asset.asset_code} - ${asset.asset_name}? Aset akan berubah status dari Draft menjadi Aktif dan dapat digunakan.`}
        confirmText={isActivating ? 'Mengaktifkan...' : 'Ya, Aktifkan'}
        cancelText="Batal"
        variant="info"
        isLoading={isActivating}
      />

      <EditAssetModal
        asset={asset}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        isSaving={updateAssetMutation.isPending}
        onSubmit={async (body) => {
          try {
            await updateAssetMutation.mutateAsync({ id: asset.id, body })
            toast.success('Aset berhasil diperbarui')
            setEditOpen(false)
            refreshDetail()
          } catch (err) {
            toast.error(parseApiError(err, 'Gagal memperbarui aset'))
          }
        }}
      />

      <TransferAssetModal
        asset={asset}
        branches={branchesData ?? []}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        isSaving={createTransferMutation.isPending}
        onSubmit={async (body) => {
          try {
            await createTransferMutation.mutateAsync(body)
            toast.success('Transfer aset berhasil')
            setTransferOpen(false)
            refreshDetail()
          } catch (err) {
            toast.error(parseApiError(err, 'Gagal transfer aset'))
          }
        }}
      />

      <MaintenanceAssetModal
        asset={asset}
        open={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        isSaving={createMaintenanceMutation.isPending}
        onSubmit={async (body) => {
          try {
            await createMaintenanceMutation.mutateAsync(body)
            toast.success('Maintenance berhasil dicatat')
            setMaintenanceOpen(false)
            refreshDetail()
          } catch (err) {
            toast.error(parseApiError(err, 'Gagal mencatat maintenance'))
          }
        }}
      />

      <DisposeAssetModal
        asset={asset}
        open={disposeOpen}
        onClose={() => setDisposeOpen(false)}
        isSaving={createDisposalMutation.isPending}
        onSubmit={async (body) => {
          try {
            await createDisposalMutation.mutateAsync(body)
            toast.success('Draft disposisi berhasil dibuat')
            setDisposeOpen(false)
            refreshDetail()
          } catch (err) {
            toast.error(parseApiError(err, 'Gagal membuat disposisi'))
          }
        }}
      />
    </div>
  )
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 dark:bg-black/70 overflow-y-auto py-6 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function EditAssetModal({
  asset,
  open,
  onClose,
  onSubmit,
  isSaving,
}: {
  asset: FixedAsset
  open: boolean
  onClose: () => void
  onSubmit: (body: UpdateAssetDto) => Promise<void>
  isSaving: boolean
}) {
  const [form, setForm] = useState({
    asset_name: asset.asset_name,
    serial_number: asset.serial_number ?? '',
    location_note: asset.location_note ?? '',
    description: asset.description ?? '',
    salvage_value: String(asset.salvage_value),
    useful_life_months: String(asset.useful_life_months),
  })

  useEffect(() => {
    if (!open) return
    setForm({
      asset_name: asset.asset_name,
      serial_number: asset.serial_number ?? '',
      location_note: asset.location_note ?? '',
      description: asset.description ?? '',
      salvage_value: String(asset.salvage_value),
      useful_life_months: String(asset.useful_life_months),
    })
  }, [asset, open])

  if (!open) return null

  const handleSubmit = () => {
    const body: UpdateAssetDto = {
      asset_name: form.asset_name.trim(),
      serial_number: form.serial_number.trim() || null,
      location_note: form.location_note.trim() || null,
      description: form.description.trim() || null,
      salvage_value: Number(form.salvage_value) || 0,
      useful_life_months: Number(form.useful_life_months) || 1,
    }
    onSubmit(body)
  }

  return (
    <ModalShell title="Edit Aset" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Nama Aset *</label>
          <input
            value={form.asset_name}
            onChange={(e) => setForm((prev) => ({ ...prev, asset_name: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Nilai Sisa</label>
            <input
              type="number"
              min={0}
              value={form.salvage_value}
              onChange={(e) => setForm((prev) => ({ ...prev, salvage_value: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Masa Manfaat (bulan)</label>
            <input
              type="number"
              min={1}
              value={form.useful_life_months}
              onChange={(e) => setForm((prev) => ({ ...prev, useful_life_months: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Serial Number</label>
            <input
              value={form.serial_number}
              onChange={(e) => setForm((prev) => ({ ...prev, serial_number: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Lokasi</label>
            <input
              value={form.location_note}
              onChange={(e) => setForm((prev) => ({ ...prev, location_note: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Deskripsi</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
        </div>
      </div>
      <ModalActions
        onClose={onClose}
        onSubmit={handleSubmit}
        disabled={!form.asset_name.trim() || isSaving}
        isSaving={isSaving}
        submitLabel="Simpan"
      />
    </ModalShell>
  )
}

function TransferAssetModal({
  asset,
  branches: allBranches,
  open,
  onClose,
  onSubmit,
  isSaving,
}: {
  asset: FixedAsset
  branches: BranchOption[]
  open: boolean
  onClose: () => void
  onSubmit: (body: CreateTransferDto) => Promise<void>
  isSaving: boolean
}) {
  const branches = allBranches.filter((branch) => branch.id !== asset.branch_id)
  const [destinationBranchId, setDestinationBranchId] = useState('')
  const [transferDate, setTransferDate] = useState(today())
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setDestinationBranchId('')
    setTransferDate(today())
    setReason('')
  }, [open])

  if (!open) return null

  const handleSubmit = () => {
    onSubmit({
      fixed_asset_id: asset.id,
      destination_branch_id: destinationBranchId,
      transfer_date: transferDate || undefined,
      reason: reason.trim() || undefined,
    })
  }

  return (
    <ModalShell title="Transfer Aset" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 p-3 text-sm text-gray-700 dark:text-gray-300">
          {asset.asset_code} - {asset.asset_name}
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cabang saat ini: {asset.branch_name ?? '-'}</div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Cabang Tujuan *</label>
          <select
            value={destinationBranchId}
            onChange={(e) => setDestinationBranchId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Pilih cabang tujuan...</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branch_code} - {branch.branch_name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Tanggal Transfer</label>
          <input
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Alasan</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
        </div>
      </div>
      <ModalActions
        onClose={onClose}
        onSubmit={handleSubmit}
        disabled={!destinationBranchId || isSaving}
        isSaving={isSaving}
        submitLabel="Transfer"
      />
    </ModalShell>
  )
}

function MaintenanceAssetModal({
  asset,
  open,
  onClose,
  onSubmit,
  isSaving,
}: {
  asset: FixedAsset
  open: boolean
  onClose: () => void
  onSubmit: (body: CreateMaintenanceDto) => Promise<void>
  isSaving: boolean
}) {
  const [maintenanceDate, setMaintenanceDate] = useState(today())
  const [description, setDescription] = useState('')
  const [vendorId, setVendorId] = useState('')

  // Fetch vendors
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', { is_active: true, limit: 200 }],
    queryFn: async () => {
      const { data } = await api.get('/vendors', { params: { is_active: true, limit: 200 } })
      return data.data as Array<{ id: string; vendor_code: string; vendor_name: string }>
    },
    staleTime: 30_000,
  })
  const vendors = vendorsData ?? []

  useEffect(() => {
    if (!open) return
    setMaintenanceDate(today())
    setDescription('')
    setVendorId('')
  }, [open])

  if (!open) return null

  const handleSubmit = () => {
    if (!vendorId || !description.trim()) return
    const body: CreateMaintenanceDto = {
      fixed_asset_id: asset.id,
      maintenance_date: maintenanceDate,
      description: description.trim(),
      vendor_id: vendorId,
    }
    onSubmit(body)
  }

  return (
    <ModalShell title="Request Maintenance" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 p-3 text-sm text-gray-700 dark:text-gray-300">
          {asset.asset_code} - {asset.asset_name}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Tanggal *</label>
            <input
              type="date"
              value={maintenanceDate}
              onChange={(e) => setMaintenanceDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Vendor *</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Pilih vendor...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendor_code} - {v.vendor_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Deskripsi *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Deskripsi pekerjaan maintenance..."
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
        </div>
      </div>
      <ModalActions
        onClose={onClose}
        onSubmit={handleSubmit}
        disabled={!maintenanceDate || !description.trim() || !vendorId || isSaving}
        isSaving={isSaving}
        submitLabel="Simpan"
      />
    </ModalShell>
  )
}

function DisposeAssetModal({
  asset,
  open,
  onClose,
  onSubmit,
  isSaving,
}: {
  asset: FixedAsset
  open: boolean
  onClose: () => void
  onSubmit: (body: CreateDisposalDto) => Promise<void>
  isSaving: boolean
}) {
  const [disposalDate, setDisposalDate] = useState(today())
  const [method, setMethod] = useState<DisposalMethod>('SOLD')
  const [proceedsAmount, setProceedsAmount] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setDisposalDate(today())
    setMethod('SOLD')
    setProceedsAmount('')
    setNotes('')
  }, [open])

  const preview = useMemo(() => {
    const proceeds = Number(proceedsAmount) || 0
    const bookValue = asset.cost - asset.accumulated_depreciation
    return { proceeds, bookValue, gainLoss: proceeds - bookValue }
  }, [asset, proceedsAmount])

  if (!open) return null

  const handleSubmit = () => {
    onSubmit({
      fixed_asset_id: asset.id,
      disposal_date: disposalDate,
      disposal_method: method,
      proceeds_amount: Number(proceedsAmount) || 0,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <ModalShell title="Dispose Aset" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 p-3 text-sm text-red-800 dark:text-red-300">
          Draft disposisi akan dibuat untuk {asset.asset_code} - {asset.asset_name}. Posting jurnal dilakukan dari halaman Disposisi Aset.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Tanggal *</label>
            <input
              type="date"
              value={disposalDate}
              onChange={(e) => setDisposalDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Metode *</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as DisposalMethod)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="SOLD">Dijual</option>
              <option value="SCRAPPED">Dibuang</option>
              <option value="DONATED">Didonasikan</option>
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Nilai Hasil</label>
          <input
            type="number"
            min={0}
            value={proceedsAmount}
            onChange={(e) => setProceedsAmount(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600 dark:text-gray-400">Nilai buku</span>
            <span className="font-medium text-gray-900 dark:text-white">{fmtCurrency(preview.bookValue)}</span>
          </div>
          <div className="flex justify-between gap-4 mt-1">
            <span className="text-gray-600 dark:text-gray-400">{preview.gainLoss >= 0 ? 'Gain' : 'Loss'}</span>
            <span className={preview.gainLoss >= 0 ? 'font-bold text-green-700 dark:text-green-400' : 'font-bold text-red-700 dark:text-red-400'}>
              {fmtCurrency(Math.abs(preview.gainLoss))}
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Catatan</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
        </div>
      </div>
      <ModalActions
        onClose={onClose}
        onSubmit={handleSubmit}
        disabled={!disposalDate || isSaving}
        isSaving={isSaving}
        submitLabel="Buat Draft"
        danger
      />
    </ModalShell>
  )
}

function ModalActions({
  onClose,
  onSubmit,
  disabled,
  isSaving,
  submitLabel,
  danger = false,
}: {
  onClose: () => void
  onSubmit: () => void
  disabled: boolean
  isSaving: boolean
  submitLabel: string
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={onClose}
        disabled={isSaving}
        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
      >
        Batal
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
          danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  )
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function DetailCard({
  label,
  value,
  icon: Icon,
  highlight = false,
}: {
  label: string
  value: string
  icon: typeof Package
  highlight?: boolean
}) {
  return (
    <div className={`p-4 rounded-xl border shadow-sm ${
      highlight
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${highlight ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className={`text-sm font-semibold ${
        highlight ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
      }`}>
        {value}
      </p>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm text-gray-900 dark:text-white mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function AssetMovementTimeline({ movements, branchMap }: { movements: AssetMovement[]; branchMap: Map<string, string> }) {
  const resolveValue = (val: string | null | undefined, movementType: MovementType): string => {
    if (!val) return ''
    // Only TRANSFER movements store branch UUIDs in from_value/to_value
    if (movementType === 'TRANSFER') {
      return branchMap.get(val) ?? val
    }
    return val
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-4">
        {movements.map((movement) => {
          const config = MOVEMENT_STYLES[movement.movement_type] ?? {
            label: movement.movement_type,
            color: 'bg-gray-100 text-gray-700',
            icon: FileText,
          }
          const Icon = config.icon
          const fromLabel = resolveValue(movement.from_value, movement.movement_type)
          const toLabel = resolveValue(movement.to_value, movement.movement_type)

          return (
            <div key={movement.id} className="relative flex items-start gap-3 pl-1">
              {/* Timeline dot */}
              <div className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 ${config.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {fmtDate(movement.movement_date)}
                  </span>
                </div>

                {(fromLabel || toLabel) && (
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                    {fromLabel && toLabel ? (
                      <span>{fromLabel} → {toLabel}</span>
                    ) : toLabel ? (
                      <span>{toLabel}</span>
                    ) : (
                      <span>{fromLabel}</span>
                    )}
                  </div>
                )}

                {movement.notes && (
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {movement.notes}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Asset Photo Gallery Component ───────────────────────────────────────────

function AssetPhotoGallery({ assetId, canEdit }: { assetId: string; canEdit: boolean }) {
  const toast = useToast()
  const { data: photos, isLoading } = useAssetPhotos(assetId)
  const uploadMutation = useUploadAssetPhoto()
  const deleteMutation = useDeleteAssetPhoto()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File terlalu besar. Maksimal 10MB.')
      return
    }

    uploadMutation.mutate(
      { assetId, file },
      {
        onSuccess: () => toast.success('Foto berhasil diupload'),
        onError: (err) => toast.error(parseApiError(err, 'Gagal upload foto')),
      },
    )
  }

  const confirmDelete = (photoId: string) => {
    setDeleteConfirmId(photoId)
  }

  const handleDelete = () => {
    if (!deleteConfirmId) return
    deleteMutation.mutate(
      { assetId, photoId: deleteConfirmId },
      {
        onSuccess: () => {
          toast.success('Foto berhasil dihapus')
          setDeleteConfirmId(null)
        },
        onError: (err) => {
          toast.error(parseApiError(err, 'Gagal hapus foto'))
          setDeleteConfirmId(null)
        },
      },
    )
  }

  const photoCount = photos?.length ?? 0
  const canUploadMore = canEdit && photoCount < 5

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Foto Aset</h2>
          <span className="text-xs text-gray-400">({photoCount}/5)</span>
        </div>
        {canUploadMore && (
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors">
            {uploadMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImagePlus className="w-3.5 h-3.5" />
            )}
            Upload
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleUpload}
              className="hidden"
              disabled={uploadMutation.isPending}
            />
          </label>
        )}
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !photos || photos.length === 0 ? (
          <div className="text-center py-8">
            <Camera className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400">Belum ada foto</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <img
                  src={photo.url}
                  alt={photo.file_name}
                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                  onClick={() => setPreviewUrl(photo.url)}
                />
                {canEdit && (
                  <button
                    onClick={() => confirmDelete(photo.id)}
                    className="absolute top-1.5 right-1.5 p-1 bg-red-600/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <ConfirmModal
          isOpen={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          onConfirm={handleDelete}
          title="Hapus Foto"
          message="Apakah Anda yakin ingin menghapus foto ini? Tindakan ini tidak dapat dibatalkan."
          confirmText={deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus'}
          variant="danger"
        />
      )}

      {/* Fullscreen Preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
