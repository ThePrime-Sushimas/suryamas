import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useListNavigation } from '@/lib/urlFilters'
import { parseApiError } from '@/lib/errorParser'
import {
  ArrowLeft,
  ArrowRightLeft,
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
} from 'lucide-react'
import { useAsset, useAssetMovements, useActivateAsset } from '../api/fixed-assets.api'
import type { AssetStatus, MovementType, AssetMovement } from '../api/fixed-assets.api'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'

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

  const { data: asset, isLoading } = useAsset(id ?? '')
  const { data: movementsResult, isLoading: movementsLoading } = useAssetMovements(id ?? '')
  const { mutateAsync: activateAsset, isPending: isActivating } = useActivateAsset()

  const [showActivateConfirm, setShowActivateConfirm] = useState(false)

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
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal mengaktifkan aset'))
    }
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
              <button className="flex items-center gap-2 px-3 py-2 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm font-medium transition-colors">
                <ArrowRightLeft className="w-4 h-4" /> Transfer
              </button>
            )}
            {canMaintenance && (
              <button className="flex items-center gap-2 px-3 py-2 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-sm font-medium transition-colors">
                <Wrench className="w-4 h-4" /> Maintenance
              </button>
            )}
            {canDispose && (
              <button className="flex items-center gap-2 px-3 py-2 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
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
                  <AssetMovementTimeline movements={sortedMovements} />
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

function AssetMovementTimeline({ movements }: { movements: AssetMovement[] }) {
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

                {(movement.from_value || movement.to_value) && (
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                    {movement.from_value && movement.to_value ? (
                      <span>{movement.from_value} → {movement.to_value}</span>
                    ) : movement.to_value ? (
                      <span>{movement.to_value}</span>
                    ) : (
                      <span>{movement.from_value}</span>
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
