import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Printer, CheckCircle, XCircle,
  Trash2, AlertTriangle, RefreshCw, Zap
} from 'lucide-react'
import { useDailyPrepOrder, useUpdateDpoLines, useDeleteDpoLine, useCancelDpo } from '../api/dailyPrepOrders.api'
import { DpoStatusBadge } from '../components/DpoStatusBadge'
import { DpoConfirmModal } from '../components/DpoConfirmModal'
import { DpoPrintModal } from '../components/DpoPrintModal'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'

const fmt = (n: number, unit?: string | null) =>
  `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n)}${unit ? ` ${unit}` : ''}`
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

export default function DailyPrepOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(s => s.hasPermission)
  const canUpdate = hasPermission('daily_prep_orders', 'update')
  const canDelete = hasPermission('daily_prep_orders', 'delete')

  const { data: dpo, isLoading, refetch } = useDailyPrepOrder(id!)
  const updateLines = useUpdateDpoLines()
  const deleteLine = useDeleteDpoLine()
  const cancelDpo = useCancelDpo()

  const [showConfirm, setShowConfirm] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [editingQty, setEditingQty] = useState<Map<string, string>>(new Map())
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelForm, setShowCancelForm] = useState(false)

  // Queue for blur saves — prevents concurrent mutateAsync calls
  const saveQueueRef = useRef<Map<string, number | null>>(new Map())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushSaveQueueRef = useRef<() => Promise<void>>(async () => {})

  flushSaveQueueRef.current = async () => {
    if (!dpo || saveQueueRef.current.size === 0) return
    if (updateLines.isPending) {
      saveTimerRef.current = setTimeout(() => flushSaveQueueRef.current(), 200)
      return
    }

    const lines = Array.from(saveQueueRef.current.entries()).map(([lineId, qty]) => ({
      id: lineId,
      confirmed_qty: qty,
    }))
    saveQueueRef.current.clear()

    try {
      await updateLines.mutateAsync({ id: dpo.id, lines })
      setEditingQty(prev => {
        const next = new Map(prev)
        lines.forEach(l => next.delete(l.id))
        return next
      })
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal update qty'))
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 border-b px-6 py-5">
          <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!dpo) return null

  const isDraft = dpo.status === 'DRAFT'
  const lines = dpo.lines ?? []

  const getQty = (lineId: string, suggested: number, confirmed: number | null) => {
    if (editingQty.has(lineId)) return editingQty.get(lineId)!
    return (confirmed ?? suggested).toString()
  }

  const handleQtyBlur = async (lineId: string, originalQty: number | null) => {
    const val = editingQty.get(lineId)
    if (val === undefined) return

    const parsed = val === '' ? 0 : parseFloat(val)
    if (isNaN(parsed)) { setEditingQty(prev => { const n = new Map(prev); n.delete(lineId); return n }); return }
    if (parsed === (originalQty ?? 0)) { setEditingQty(prev => { const n = new Map(prev); n.delete(lineId); return n }); return }

    // Add to save queue and debounce flush (300ms)
    saveQueueRef.current.set(lineId, parsed)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => flushSaveQueueRef.current(), 300)
  }

  const handleDeleteLine = async (lineId: string, productName: string) => {
    if (!confirm(`Hapus ${productName} dari daftar?`)) return
    try {
      await deleteLine.mutateAsync({ id: dpo.id, lineId })
      toast.success('Item dihapus')
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal hapus item'))
    }
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast.error('Alasan wajib diisi'); return }
    try {
      await cancelDpo.mutateAsync({ id: dpo.id, reason: cancelReason })
      toast.success('DPO dibatalkan')
      setShowCancelForm(false)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membatalkan'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/inventory/daily-prep-orders')}
              className="p-2 -ml-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white font-mono">
                  {dpo.dpo_number}
                </h1>
                <DpoStatusBadge status={dpo.status} />
                {dpo.has_upcoming_holiday && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3" /> Hari libur
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {dpo.branch_name} · {fmtDate(dpo.prep_date)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowPrint(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            {isDraft && canUpdate && (
              <>
                <button
                  type="button"
                  onClick={() => setShowCancelForm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <XCircle className="w-4 h-4" /> Batalkan
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" /> Konfirmasi Transfer
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-4">
        {/* Info card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-1">Gudang Sumber</p>
              <p className="font-medium text-gray-900 dark:text-white">{dpo.source_warehouse_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Gudang Tujuan</p>
              <p className="font-medium text-gray-900 dark:text-white">{dpo.target_warehouse_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Formula</p>
              <p className="font-medium text-gray-900 dark:text-white text-xs">
                7d×{dpo.weight_7d} · 30d×{dpo.weight_30d} · dow×{dpo.weight_dow}
              </p>
              <p className="text-xs text-gray-400">coverage {dpo.coverage_days} hari</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Holiday Factor</p>
              <p className={`font-medium text-sm ${dpo.has_upcoming_holiday ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>
                ×{dpo.holiday_factor_applied}
                {dpo.has_upcoming_holiday && ' (libur)'}
              </p>
            </div>
          </div>

          {dpo.status === 'CONFIRMED' && dpo.confirmed_by_name && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Dikonfirmasi oleh <strong>{dpo.confirmed_by_name}</strong> pada {dpo.confirmed_at ? fmtDate(dpo.confirmed_at) : '—'}</span>
            </div>
          )}
        </div>

        {/* Cancel form */}
        {showCancelForm && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800/50 p-4">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Batalkan DPO ini?</p>
            <input
              type="text"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Alasan pembatalan (wajib)"
              className="w-full px-3 py-2 text-sm border border-red-200 dark:border-red-800/50 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-400/30 mb-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelDpo.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Ya, Batalkan
              </button>
              <button
                type="button"
                onClick={() => { setShowCancelForm(false); setCancelReason('') }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm"
              >
                Tidak
              </button>
            </div>
          </div>
        )}

        {/* Lines */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                Daftar Barang ({lines.length} item)
              </h2>
            </div>
            {isDraft && (
              <p className="text-xs text-gray-400">
                Klik qty untuk edit · Hapus baris yang tidak perlu
              </p>
            )}
          </div>

          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg 7d</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg 30d</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prediksi</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stok Ready</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Suggested</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {isDraft ? 'Qty Ambil' : 'Qty Ambil'}
                  </th>
                  {isDraft && canDelete && <th className="px-4 py-3 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {lines.map(line => {
                  const confirmedQty = line.confirmed_qty ?? line.suggested_qty
                  const isZero = confirmedQty === 0
                  return (
                    <tr
                      key={line.id}
                      className={`transition-colors ${isZero ? 'opacity-50' : ''} hover:bg-gray-50/50 dark:hover:bg-gray-700/20`}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{line.product_name}</p>
                        <p className="text-xs text-gray-400 font-mono">{line.product_code}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 font-mono">
                        {fmt(line.avg_sales_7d, line.base_unit_name)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 font-mono">
                        {fmt(line.avg_sales_30d, line.base_unit_name)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-blue-600 dark:text-blue-400 font-mono">
                        {fmt(line.predicted_need, line.base_unit_name)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono">
                        <span className={line.live_ready_stock < line.predicted_need ? 'text-amber-600' : 'text-gray-500'}>
                          {fmt(line.live_ready_stock ?? line.current_ready_stock, line.base_unit_name)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400 font-mono">
                        {fmt(line.suggested_qty, line.base_unit_name)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isDraft && canUpdate ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={getQty(line.id, line.suggested_qty, line.confirmed_qty)}
                            onChange={e => setEditingQty(prev => new Map(prev).set(line.id, e.target.value))}
                            onBlur={() => handleQtyBlur(line.id, line.confirmed_qty)}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            className="w-24 text-right text-sm font-mono font-semibold px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">
                            {fmt(confirmedQty, line.base_unit_name)}
                          </span>
                        )}
                      </td>
                      {isDraft && canDelete && (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleDeleteLine(line.id, line.product_name)}
                            className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {lines.map(line => {
              const confirmedQty = line.confirmed_qty ?? line.suggested_qty
              return (
                <div key={line.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{line.product_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{line.product_code}</p>
                    </div>
                    {isDraft && canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLine(line.id, line.product_name)}
                        className="p-1 text-gray-300 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div>
                      <p className="text-gray-400">Prediksi</p>
                      <p className="font-mono text-blue-600">{fmt(line.predicted_need, line.base_unit_name)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Stok Ready</p>
                      <p className="font-mono">{fmt(line.live_ready_stock ?? line.current_ready_stock, line.base_unit_name)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Suggested</p>
                      <p className="font-mono text-gray-500">{fmt(line.suggested_qty, line.base_unit_name)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Qty Ambil:</span>
                    {isDraft && canUpdate ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={getQty(line.id, line.suggested_qty, line.confirmed_qty)}
                        onChange={e => setEditingQty(prev => new Map(prev).set(line.id, e.target.value))}
                        onBlur={() => handleQtyBlur(line.id, line.confirmed_qty)}
                        className="w-28 text-right text-sm font-mono font-semibold px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    ) : (
                      <span className="font-mono font-semibold text-gray-900 dark:text-white text-sm">
                        {fmt(confirmedQty, line.base_unit_name)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showConfirm && dpo && (
        <DpoConfirmModal
          dpo={dpo}
          onClose={() => setShowConfirm(false)}
          onConfirmed={() => { setShowConfirm(false); refetch() }}
        />
      )}

      {showPrint && dpo && (
        <DpoPrintModal
          dpo={dpo}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}