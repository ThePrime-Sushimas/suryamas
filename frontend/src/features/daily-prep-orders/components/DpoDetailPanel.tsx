import { useState } from 'react'
import { format } from 'date-fns'
import { X, CheckCircle2, XCircle, Trash2, AlertTriangle, Printer, ArrowLeft } from 'lucide-react'
import { DpoStatusBadge } from './DpoStatusBadge'
import { DpoLinesTable } from './DpoLinesTable'
import { DpoConfirmDialog } from './DpoConfirmDialog'
import { PrintDpoModal } from './PrintDpoModal'
import type { DailyPrepOrderDetail } from '../types/dpo.types'

interface DpoDetailPanelProps {
  dpo: DailyPrepOrderDetail
  canUpdate: boolean
  canDelete: boolean
  onClose: () => void
  onCancel: () => void
  onDelete: () => void
}

export function DpoDetailPanel({ dpo, canUpdate, canDelete, onClose, onCancel, onDelete }: DpoDetailPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  const isDraft = dpo.status === 'DRAFT'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{dpo.dpo_number}</h2>
              <DpoStatusBadge status={dpo.status} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {dpo.branch_name} · {format(new Date(dpo.prep_date), 'dd MMM yyyy')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPrintOpen(true)}
            disabled={dpo.lines.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
            title="Print Thermal"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
          {isDraft && (
            <>
              <button
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Konfirmasi</span>
              </button>
              {canUpdate && (
                <button
                  onClick={onCancel}
                  className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                  title="Cancel DPO"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400"
                  title="Hapus DPO"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="hidden lg:block p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
            title="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Info cards */}
        <div className="grid grid-cols-2 gap-2">
          <InfoCard label="Source" value={dpo.source_warehouse_name} />
          <InfoCard label="Target" value={dpo.target_warehouse_name} />
          <InfoCard label="Coverage" value={`${dpo.coverage_days} hari`} />
          <InfoCard label="Weights" value={`${dpo.weight_7d}/${dpo.weight_30d}/${dpo.weight_dow}`} />
        </div>

        {/* Holiday badge */}
        {dpo.has_upcoming_holiday && (
          <div className="flex items-center gap-2 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-xs text-yellow-700 dark:text-yellow-300">
              Holiday factor: {dpo.holiday_factor_applied}x
            </span>
          </div>
        )}

        {/* Status info */}
        {dpo.status === 'CONFIRMED' && dpo.confirmed_at && (
          <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span className="text-xs text-green-700 dark:text-green-300">
              Dikonfirmasi oleh {dpo.confirmed_by_name ?? '—'} · {format(new Date(dpo.confirmed_at), 'dd MMM yyyy HH:mm')}
            </span>
          </div>
        )}
        {dpo.status === 'CANCELLED' && dpo.cancelled_at && (
          <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
            <XCircle className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-300">
              Dibatalkan: {dpo.cancel_reason} · {format(new Date(dpo.cancelled_at), 'dd MMM yyyy HH:mm')}
            </span>
          </div>
        )}

        {/* Lines table */}
        <DpoLinesTable dpo={dpo} readOnly={!isDraft} />
      </div>

      {/* Confirm Dialog */}
      <DpoConfirmDialog dpo={dpo} open={confirmOpen} onOpenChange={setConfirmOpen} />

      {/* Print Modal */}
      {printOpen && (
        <PrintDpoModal dpoId={dpo.id} lines={dpo.lines} onClose={() => setPrintOpen(false)} />
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
      <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>
    </div>
  )
}
