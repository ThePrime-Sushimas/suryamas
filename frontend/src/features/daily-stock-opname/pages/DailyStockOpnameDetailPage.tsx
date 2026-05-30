import { useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  AlertTriangle,
} from 'lucide-react'
import { useListNavigation } from '@/lib/urlFilters'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import {
  useOpnameDetail,
  useConfirmOpname,
  useCancelOpname,
  useOpnameConfig,
  useBulkUpdateLines,
} from '../api/dailyStockOpname'
import { OpnameStatusBadge } from '../components/OpnameStatusBadge'
import { OpnameSummaryCard } from '../components/OpnameSummaryCard'
import { OpnameLineRow } from '../components/OpnameLineRow'
import { ResolveModal } from '../components/ResolveModal'
import type { OpnameDisplayStatus } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function getDisplayStatus(status: string, closingDate: string): OpnameDisplayStatus {
  if (status === 'DRAFT') {
    const today = todayJakarta()
    if (closingDate < today) return 'MISSED'
  }
  return status as OpnameDisplayStatus
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DailyStockOpnameDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { backToList } = useListNavigation('/inventory/daily-stock-opname')
  const toast = useToast()
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canUpdate = hasPermission('daily_stock_opname', 'update')
  const canApprove = hasPermission('daily_stock_opname', 'approve')

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: detail, isLoading, isError } = useOpnameDetail(id ?? '')
  const { data: config } = useOpnameConfig(detail?.branch_id ?? '')

  const threshold = config?.variance_threshold_pct ?? 15

  // ── Mutations ─────────────────────────────────────────────────────────────
  const confirmOpname = useConfirmOpname()
  const cancelOpname = useCancelOpname()
  const bulkUpdateLines = useBulkUpdateLines()

  // ── Local state ───────────────────────────────────────────────────────────
  const [localActuals, setLocalActuals] = useState<Record<string, number | null>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filterHighRisk, setFilterHighRisk] = useState(false)
  const [filterHasVariance, setFilterHasVariance] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // ── Derived state ─────────────────────────────────────────────────────────
  const displayStatus = detail
    ? getDisplayStatus(detail.status, detail.closing_date)
    : 'DRAFT'
  const isDraft = detail?.status === 'DRAFT'
  const isFlagged = detail?.status === 'FLAGGED'
  const isExpired = displayStatus === 'MISSED'
  const isEditable = isDraft && !isExpired && canUpdate

  // ── Filtered lines ────────────────────────────────────────────────────────
  const filteredLines = useMemo(() => {
    if (!detail?.lines) return []
    let lines = detail.lines

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      lines = lines.filter(
        (l) =>
          l.product_name.toLowerCase().includes(q) ||
          l.product_code.toLowerCase().includes(q),
      )
    }

    if (filterHighRisk) {
      lines = lines.filter((l) => l.is_high_risk)
    }

    if (filterHasVariance) {
      lines = lines.filter((l) => {
        const actual = localActuals[l.id] ?? l.actual_qty
        if (actual === null) return false
        const variance = actual - l.expected_qty
        return Math.abs(variance) > 0.001
      })
    }

    return lines
  }, [detail?.lines, searchQuery, filterHighRisk, filterHasVariance, localActuals])

  // ── Summary with local actuals ────────────────────────────────────────────
  const liveSummary = useMemo(() => {
    if (!detail) return null
    let totalActualCost = 0
    let totalVarianceCost = 0
    let completedCount = 0

    for (const line of detail.lines) {
      const actual = localActuals[line.id] ?? line.actual_qty
      if (actual !== null) {
        completedCount++
        totalActualCost += actual * line.cost_per_unit
        totalVarianceCost += (actual - line.expected_qty) * line.cost_per_unit
      }
    }

    return {
      total_expected_cost: detail.summary.total_expected_cost,
      total_actual_cost: totalActualCost || detail.summary.total_actual_cost,
      total_variance_cost: totalVarianceCost || detail.summary.total_variance_cost,
      completion_pct:
        detail.lines.length > 0
          ? (completedCount / detail.lines.length) * 100
          : 0,
      line_count: detail.lines.length,
      completed_count: completedCount || detail.summary.completed_count,
      flagged_line_count: detail.summary.flagged_line_count,
    }
  }, [detail, localActuals])

  // ── Progress bar ──────────────────────────────────────────────────────────
  const progressPct = liveSummary
    ? Math.round(
        (liveSummary.completed_count / Math.max(liveSummary.line_count, 1)) * 100,
      )
    : 0

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleActualChange = useCallback((lineId: string, value: number | null) => {
    setLocalActuals((prev) => ({ ...prev, [lineId]: value }))
  }, [])

  const handleConfirm = async () => {
    if (!detail) return

    // Save pending local changes first
    const pendingUpdates = Object.entries(localActuals)
      .filter(([, v]) => v !== null)
      .map(([lineId, actual]) => ({ line_id: lineId, actual_qty: actual as number }))

    try {
      if (pendingUpdates.length > 0) {
        await bulkUpdateLines.mutateAsync({
          sessionId: detail.id,
          body: { lines: pendingUpdates },
        })
      }

      await confirmOpname.mutateAsync(detail.id)
      toast.success('Opname berhasil dikonfirmasi')
      setLocalActuals({})
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal konfirmasi opname'))
    }
  }

  const handleCancel = async () => {
    if (!detail) return
    try {
      await cancelOpname.mutateAsync(detail.id)
      toast.success('Opname dibatalkan')
      backToList()
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membatalkan opname'))
    }
  }

  // ── Loading / Error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (isError || !detail) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600 dark:text-gray-400">Gagal memuat data opname</p>
        <button
          onClick={backToList}
          className="text-sm text-blue-600 hover:underline"
        >
          Kembali ke daftar
        </button>
      </div>
    )
  }

  const isConfirming = confirmOpname.isPending || bulkUpdateLines.isPending
  const isCancelling = cancelOpname.isPending

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={backToList}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {detail.branch_name}
              </h1>
              <OpnameStatusBadge status={displayStatus} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {fmtDate(detail.closing_date)} · PIC: {detail.pic_name}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        {liveSummary && <OpnameSummaryCard summary={liveSummary} />}

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span className="font-mono">
              {liveSummary?.completed_count ?? 0}/{liveSummary?.line_count ?? 0} item ({progressPct}%)
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari produk..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterHighRisk}
              onChange={(e) => setFilterHighRisk(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            High Risk Only
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterHasVariance}
              onChange={(e) => setFilterHasVariance(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            Has Variance
          </label>
          <span className="text-xs text-gray-400 ml-auto">
            {filteredLines.length} / {detail.lines.length} item
          </span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Produk
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Expected
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actual
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Variance
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Var %
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Foto
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  MAIN Bal.
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 text-sm">
                    Tidak ada item yang cocok
                  </td>
                </tr>
              ) : (
                filteredLines.map((line) => (
                  <OpnameLineRow
                    key={line.id}
                    line={line}
                    sessionId={detail.id}
                    isEditable={isEditable}
                    threshold={threshold}
                    localActual={localActuals[line.id] ?? line.actual_qty}
                    onActualChange={handleActualChange}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Action Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          {/* Left actions */}
          <div>
            {isEditable && (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                disabled={isCancelling}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Batalkan
              </button>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {isFlagged && canApprove && (
              <button
                type="button"
                onClick={() => setShowResolveModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Resolve
              </button>
            )}
            {isEditable && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirming}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {isConfirming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Konfirmasi Opname
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <ResolveModal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        sessionId={detail.id}
      />

      {/* Cancel Confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isCancelling && setShowCancelConfirm(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Batalkan Opname?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Sesi opname ini akan dibatalkan dan tidak dapat dikembalikan. Semua data input akan hilang.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={() => {
                  setShowCancelConfirm(false)
                  handleCancel()
                }}
                disabled={isCancelling}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isCancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
