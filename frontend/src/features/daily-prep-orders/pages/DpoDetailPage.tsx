import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, CheckCircle2, XCircle, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { useListNavigation } from '@/lib/urlFilters'
import { useDpoDetail } from '../api/dpo.queries'
import { DpoStatusBadge } from '../components/DpoStatusBadge'
import { DpoLinesTable } from '../components/DpoLinesTable'
import { DpoConfirmDialog } from '../components/DpoConfirmDialog'
import { DpoCancelDialog } from '../components/DpoCancelDialog'
import { DpoDeleteDialog } from '../components/DpoDeleteDialog'

const DPO_LIST_PATH = '/daily-prep-orders'

export default function DpoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { backToList } = useListNavigation(DPO_LIST_PATH)

  const { data: dpo, isLoading, error } = useDpoDetail(id ?? '')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !dpo) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">DPO tidak ditemukan</p>
        <button onClick={backToList} className="mt-4 text-blue-600 hover:underline text-sm">
          ← Kembali ke list
        </button>
      </div>
    )
  }

  const isDraft = dpo.status === 'DRAFT'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={backToList}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{dpo.dpo_number}</h1>
            <DpoStatusBadge status={dpo.status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {dpo.branch_name} · Prep Date: {format(new Date(dpo.prep_date), 'dd MMM yyyy')}
          </p>
        </div>

        {/* Action buttons */}
        {isDraft && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
            >
              <CheckCircle2 className="h-4 w-4" /> Konfirmasi
            </button>
            <button
              onClick={() => setCancelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <XCircle className="h-4 w-4" /> Cancel
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" /> Hapus
            </button>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard label="Source Warehouse" value={dpo.source_warehouse_name} />
        <InfoCard label="Target Warehouse" value={dpo.target_warehouse_name} />
        <InfoCard label="Coverage Days" value={dpo.coverage_days.toString()} />
        <InfoCard label="Weights (7d/30d/DOW)" value={`${dpo.weight_7d} / ${dpo.weight_30d} / ${dpo.weight_dow}`} />
      </div>

      {/* Holiday badge */}
      {dpo.has_upcoming_holiday && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm text-yellow-700 dark:text-yellow-300">
            Holiday factor diterapkan: {dpo.holiday_factor_applied}x
          </span>
        </div>
      )}

      {/* Status info */}
      {dpo.status === 'CONFIRMED' && dpo.confirmed_at && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-700 dark:text-green-300">
            Dikonfirmasi oleh {dpo.confirmed_by_name ?? '—'} pada {format(new Date(dpo.confirmed_at), 'dd MMM yyyy HH:mm')}
          </span>
        </div>
      )}
      {dpo.status === 'CANCELLED' && dpo.cancelled_at && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
          <XCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Dibatalkan: {dpo.cancel_reason} — {format(new Date(dpo.cancelled_at), 'dd MMM yyyy HH:mm')}
          </span>
        </div>
      )}

      {/* Lines table */}
      <DpoLinesTable dpo={dpo} readOnly={!isDraft} />

      {/* Dialogs */}
      {isDraft && (
        <>
          <DpoConfirmDialog dpo={dpo} open={confirmOpen} onOpenChange={setConfirmOpen} />
          <DpoCancelDialog dpoId={dpo.id} open={cancelOpen} onOpenChange={setCancelOpen} />
          <DpoDeleteDialog
            dpoId={dpo.id}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onSuccess={() => navigate(DPO_LIST_PATH)}
          />
        </>
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{value}</p>
    </div>
  )
}
