import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useGoodsProcessingList, useGoodsProcessingDetail, useBulkConfirmLines, useConfirmLine, useSubmitLineQc } from '../api/goodsProcessing.api'
import type { GoodsProcessing, GoodsProcessingInput } from '../api/goodsProcessing.api'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

const LINE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Menunggu', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: '⏳' },
  PROCESSING: { label: 'Diproses', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: '🔄' },
  QC_REVIEW: { label: 'Review QC', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: '👁' },
  CONFIRMED: { label: 'Selesai', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: '✓' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: '✗' },
}

export default function GoodsProcessingPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canApprove = hasPermission('goods_processing', 'approve')
  const canUpdate = hasPermission('goods_processing', 'update')

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedGps, setExpandedGps] = useState<Set<string>>(new Set())
  const [selectedLines, setSelectedLines] = useState<string[]>([])
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  const queryParams = useMemo(() => ({
    page, limit: 25,
    status: statusFilter || undefined,
  }), [page, statusFilter])

  const { data, isLoading } = useGoodsProcessingList(queryParams)
  const bulkConfirmMutation = useBulkConfirmLines()
  const confirmLineMutation = useConfirmLine()
  const submitQcMutation = useSubmitLineQc()

  const items = data?.data ?? []
  const pagination = data?.pagination

  const toggleExpand = (gpId: string) => {
    setExpandedGps(prev => {
      const next = new Set(prev)
      if (next.has(gpId)) next.delete(gpId)
      else next.add(gpId)
      return next
    })
  }

  const toggleLineSelect = (lineId: string) => {
    setSelectedLines(prev => prev.includes(lineId) ? prev.filter(x => x !== lineId) : [...prev, lineId])
  }

  const handleBulkConfirm = async () => {
    try {
      const result = await bulkConfirmMutation.mutateAsync(selectedLines)
      toast.success(`${result.success.length} item dikonfirmasi`)
      if (result.failed.length > 0) toast.error(`${result.failed.length} item gagal`)
      setSelectedLines([])
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal konfirmasi'))
    } finally {
      setShowBulkConfirm(false)
    }
  }

  const handleQuickConfirm = async (lineId: string) => {
    try {
      await confirmLineMutation.mutateAsync(lineId)
      toast.success('Item dikonfirmasi')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal konfirmasi'))
    }
  }

  const handleQuickSubmitQc = async (lineId: string) => {
    try {
      await submitQcMutation.mutateAsync(lineId)
      toast.success('Dikirim ke QC')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal submit'))
    }
  }

  // Auto-expand GPs that have pending items
  useMemo(() => {
    const autoExpand = new Set<string>()
    for (const gp of items) {
      if (['DRAFT', 'PARTIAL', 'PROCESSING'].includes(gp.status)) {
        autoExpand.add(gp.id)
      }
    }
    if (autoExpand.size > 0 && expandedGps.size === 0) {
      setExpandedGps(autoExpand)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-orange-600" />
            <div>
              <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">Barang Masuk</h1>
              <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">Proses barang sebelum masuk gudang</p>
            </div>
          </div>
          {selectedLines.length > 0 && canApprove && (
            <button onClick={() => setShowBulkConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Konfirmasi {selectedLines.length} Item
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-3">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); setSelectedLines([]) }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
          <option value="">Semua</option>
          <option value="DRAFT,PARTIAL,PROCESSING">Belum Selesai</option>
          <option value="CONFIRMED">Selesai</option>
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Package className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Tidak ada data</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(gp => (
              <GPCard
                key={gp.id}
                gp={gp}
                expanded={expandedGps.has(gp.id)}
                onToggleExpand={() => toggleExpand(gp.id)}
                selectedLines={selectedLines}
                onToggleLineSelect={toggleLineSelect}
                onNavigateDetail={(lineId) => navigate(`/inventory/goods-processing/${gp.id}?line=${lineId}`)}
                onQuickConfirm={canApprove ? handleQuickConfirm : undefined}
                onQuickSubmitQc={canUpdate ? handleQuickSubmitQc : undefined}
                canApprove={canApprove}
              />
            ))}
          </div>
        )}

        {pagination && pagination.total > 0 && (
          <div className="mt-4">
            <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={() => {}} currentLength={items.length} loading={isLoading} />
          </div>
        )}
      </div>

      {/* Bulk Confirm Modal */}
      <ConfirmModal isOpen={showBulkConfirm} onClose={() => setShowBulkConfirm(false)} onConfirm={handleBulkConfirm}
        title="Konfirmasi Barang Masuk" message={`Konfirmasi ${selectedLines.length} item? Stock akan masuk ke gudang.`}
        confirmText="Konfirmasi" variant="success" isLoading={bulkConfirmMutation.isPending} />
    </div>
  )
}

// ─── GP Card with expand/collapse ────────────────────────────────────────────

function GPCard({ gp, expanded, onToggleExpand, selectedLines, onToggleLineSelect, onNavigateDetail, onQuickConfirm, onQuickSubmitQc, canApprove }: {
  gp: GoodsProcessing
  expanded: boolean
  onToggleExpand: () => void
  selectedLines: string[]
  onToggleLineSelect: (id: string) => void
  onNavigateDetail: (lineId: string) => void
  onQuickConfirm?: (lineId: string) => void
  onQuickSubmitQc?: (lineId: string) => void
  canApprove: boolean
}) {
  // Fetch detail only when expanded
  const { data: detail } = useGoodsProcessingDetail(expanded ? gp.id : '')
  const inputs = detail?.inputs ?? []
  const confirmedCount = inputs.filter(i => i.status === 'CONFIRMED').length
  const totalCount = inputs.length || gp.input_count

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* GP Header — clickable to expand/collapse */}
      <div onClick={onToggleExpand}
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30">
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-gray-900 dark:text-white truncate">{gp.processing_number}</span>
              {gp.status === 'CONFIRMED' && <span className="text-xs text-green-600">✓</span>}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {gp.supplier_name} · {gp.branch_name} · {fmtDate(gp.processing_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {confirmedCount}/{totalCount} selesai
          </span>
          {confirmedCount === totalCount && totalCount > 0 ? (
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
          ) : confirmedCount > 0 ? (
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-gray-300"></span>
          )}
        </div>
      </div>

      {/* Expanded: show lines */}
      {expanded && inputs.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {/* GR info */}
          <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-700/20 text-xs text-gray-500 dark:text-gray-400">
            GR: {gp.gr_number} · {gp.input_count} item
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {inputs.map(inp => (
              <LineRow
                key={inp.id}
                inp={inp}
                selected={selectedLines.includes(inp.id)}
                onToggleSelect={() => onToggleLineSelect(inp.id)}
                onNavigate={() => onNavigateDetail(inp.id)}
                onQuickConfirm={onQuickConfirm}
                onQuickSubmitQc={onQuickSubmitQc}
                canApprove={canApprove}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expanded but no inputs loaded (list endpoint doesn't return inputs) */}
      {expanded && inputs.length === 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 text-center text-xs text-gray-400">
          <button onClick={() => onNavigateDetail('')} className="text-blue-600 hover:underline">
            Buka detail →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Line Row ────────────────────────────────────────────────────────────────

function LineRow({ inp, selected, onToggleSelect, onNavigate, onQuickConfirm, onQuickSubmitQc, canApprove }: {
  inp: GoodsProcessingInput
  selected: boolean
  onToggleSelect: () => void
  onNavigate: () => void
  onQuickConfirm?: (lineId: string) => void
  onQuickSubmitQc?: (lineId: string) => void
  canApprove: boolean
}) {
  const statusCfg = LINE_STATUS_CONFIG[inp.status] ?? LINE_STATUS_CONFIG.PENDING
  const isPassThrough = !inp.requires_processing
  const canSelect = canApprove && inp.status === 'QC_REVIEW'

  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/20">
      {/* Checkbox for bulk confirm */}
      {canSelect && (
        <input type="checkbox" checked={selected} onChange={onToggleSelect}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 shrink-0" />
      )}
      {!canSelect && <div className="w-4 shrink-0"></div>}

      {/* Product info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{inp.product_name}</span>
          {isPassThrough
            ? <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded shrink-0">Pass</span>
            : <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded shrink-0">Proses</span>
          }
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-mono">{fmt(inp.qty_input)} {inp.uom}</span>
          {inp.status === 'CONFIRMED' && inp.qc_confirmed_by_name && (
            <span className="text-green-600 dark:text-green-400">· ✓ {inp.qc_confirmed_by_name}</span>
          )}
          {inp.status === 'REJECTED' && inp.rejection_reason && (
            <span className="text-red-500">· {inp.rejection_reason}</span>
          )}
        </div>
        {/* Output summary for disassembly */}
        {!isPassThrough && inp.outputs && inp.outputs.length > 0 && inp.outputs[0].product_id !== inp.product_id && (
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
            → {inp.outputs.filter(o => !o.is_waste).map(o => `${o.product_name} ${fmt(o.qty_output)}${o.uom}`).join(' + ')}
            {inp.outputs.some(o => o.is_waste) && ` + Waste ${fmt(inp.outputs.filter(o => o.is_waste).reduce((s, o) => s + o.qty_output, 0))}`}
          </p>
        )}
      </div>

      {/* Status badge */}
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${statusCfg.color}`}>
        {statusCfg.icon} {statusCfg.label}
      </span>

      {/* Quick actions */}
      <div className="flex gap-1 shrink-0">
        {inp.status === 'PENDING' && isPassThrough && onQuickSubmitQc && (
          <button onClick={e => { e.stopPropagation(); onQuickSubmitQc(inp.id) }}
            className="px-2 py-1 text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded hover:bg-yellow-200">
            Submit QC
          </button>
        )}
        {inp.status === 'QC_REVIEW' && onQuickConfirm && (
          <button onClick={e => { e.stopPropagation(); onQuickConfirm(inp.id) }}
            className="px-2 py-1 text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded hover:bg-green-200">
            Confirm
          </button>
        )}
      </div>
    </div>
  )
}
