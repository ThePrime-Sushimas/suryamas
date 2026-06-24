import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { useUrlFilters } from '@/lib/urlFilters'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import {
  usePendingJournalPostingList,
  usePostSinglePendingJournal,
  useBulkPostPendingJournal,
  MODULE_LABELS,
  MODULE_DETAIL_PATHS,
  type PendingModule,
  type PendingPostingRecord,
  type PostBulkResult,
} from '../api/pendingJournalPosting.api'
import { pendingJournalFilterConfig } from '../utils/pendingJournalPostingFilters.url'
import { useToast } from '@/contexts/ToastContext'

// ─── Module Badge Colors ─────────────────────────────────────────────────────

const MODULE_BADGE: Record<PendingModule, string> = {
  purchase_invoices: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  general_invoices: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ap_payments: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  asset_disposals: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  stock_adjustments: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  stock_transfers: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  production_orders: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  marketplace_po: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
}

// ─── Format Helpers ──────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

// ─── Confirmation Modal ──────────────────────────────────────────────────────

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  isLoading,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bulk Result Modal ───────────────────────────────────────────────────────

function BulkResultModal({
  isOpen,
  result,
  onClose,
}: {
  isOpen: boolean
  result: PostBulkResult | null
  onClose: () => void
}) {
  if (!isOpen || !result) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Hasil Bulk Post
        </h3>
        <div className="flex gap-4 mb-4">
          <span className="text-sm text-green-600 font-medium">{result.success_count} berhasil</span>
          {result.failure_count > 0 && (
            <span className="text-sm text-red-600 font-medium">{result.failure_count} gagal</span>
          )}
        </div>
        {result.failure_count > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase">Detail Kegagalan:</p>
            {result.results
              .filter(r => !r.success)
              .map(r => (
                <div key={r.id} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm">
                  <span className="font-mono text-xs text-gray-500">{r.id.slice(0, 8)}...</span>
                  <span className="ml-2 text-red-700 dark:text-red-400">{r.error}</span>
                </div>
              ))}
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Select All Checkbox (with indeterminate support) ────────────────────────

function SelectAllCheckbox({
  records,
  selectedIds,
  isMixedModule,
  onSelectAll,
  onClearAll,
}: {
  records: PendingPostingRecord[]
  selectedIds: Set<string>
  isMixedModule: boolean
  onSelectAll: () => void
  onClearAll: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  const allSelected = records.length > 0 && records.every(r => selectedIds.has(r.id))
  const someSelected = selectedIds.size > 0 && !allSelected
  const isDisabled = isMixedModule || records.length === 0

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = someSelected && !isDisabled
    }
  }, [someSelected, isDisabled])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected && !isDisabled}
      disabled={isDisabled}
      onChange={e => e.target.checked ? onSelectAll() : onClearAll()}
      title={isDisabled ? 'Filter 1 module untuk mengaktifkan pilih semua' : 'Pilih semua'}
      className="rounded border-gray-300 dark:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
    />
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PendingJournalPostingPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { branches } = useBranchContextStore()

  // Multi-company detection: show company column if user has access to multiple companies
  const isMultiCompany = useMemo(() => {
    const companyIds = new Set(branches.map(b => b.company_id))
    return companyIds.size > 1
  }, [branches])

  // URL Filters
  const { filters, setFilters, resetFilters, setPage } = useUrlFilters(pendingJournalFilterConfig)

  // Data fetching
  const { data: queryResult, isLoading } = usePendingJournalPostingList({
    page: filters.page,
    limit: filters.limit,
    module: filters.module || undefined,
    branch_id: filters.branch_id || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  })

  const records = queryResult?.data?.records ?? []
  const summary = queryResult?.data?.summary ?? []
  const pagination = queryResult?.pagination

  // Detect mixed modules in current view (for select-all behavior)
  const isMixedModule = useMemo(() => {
    const uniqueModules = new Set(records.map(r => r.module))
    return uniqueModules.size > 1
  }, [records])

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedModule, setSelectedModule] = useState<PendingModule | null>(null)

  // Confirm modal state
  const [confirmTarget, setConfirmTarget] = useState<PendingPostingRecord | null>(null)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkResult, setBulkResult] = useState<PostBulkResult | null>(null)

  // Mutations
  const postSingle = usePostSinglePendingJournal()
  const postBulk = useBulkPostPendingJournal()

  // Handlers
  const handleCheckRow = useCallback((record: PendingPostingRecord) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(record.id)) {
        next.delete(record.id)
        if (next.size === 0) setSelectedModule(null)
        return next
      }
      // If selecting from a different module, clear previous selection
      if (selectedModule && selectedModule !== record.module) {
        toast.info('Bulk post hanya bisa untuk 1 module yang sama. Selection sebelumnya di-reset.')
        setSelectedModule(record.module)
        return new Set([record.id])
      }
      if (!selectedModule) setSelectedModule(record.module)
      next.add(record.id)
      return next
    })
  }, [selectedModule, toast])

  const handleSelectAll = useCallback(() => {
    if (records.length === 0 || isMixedModule) return
    const targetModule = records[0].module
    setSelectedModule(targetModule)
    setSelectedIds(new Set(records.map(r => r.id)))
  }, [records, isMixedModule])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectedModule(null)
  }, [])

  const handlePostSingle = useCallback((record: PendingPostingRecord) => {
    setConfirmTarget(record)
  }, [])

  const confirmPostSingle = useCallback(async () => {
    if (!confirmTarget) return
    await postSingle.mutateAsync({ module: confirmTarget.module, id: confirmTarget.id })
    setConfirmTarget(null)
    clearSelection()
  }, [confirmTarget, postSingle, clearSelection])

  const handleBulkPost = useCallback(() => {
    setShowBulkConfirm(true)
  }, [])

  const confirmBulkPost = useCallback(async () => {
    if (!selectedModule || selectedIds.size === 0) return
    const result = await postBulk.mutateAsync({ module: selectedModule, ids: Array.from(selectedIds) })
    setShowBulkConfirm(false)
    setBulkResult(result)
    clearSelection()
  }, [selectedModule, selectedIds, postBulk, clearSelection])

  const handleOpenDetail = useCallback((record: PendingPostingRecord) => {
    const basePath = MODULE_DETAIL_PATHS[record.module]
    navigate(`${basePath}/${record.id}`)
  }, [navigate])

  const hasFilters = filters.module || filters.branch_id || filters.date_from || filters.date_to

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Pending Journal Posting</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Transaksi yang sudah dibuat tapi journal-nya belum di-post
          </p>
        </div>
      </div>

      {/* Summary Badges */}
      {summary.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {summary.map(s => (
              <button
                key={s.module}
                onClick={() => setFilters({ module: filters.module === s.module ? '' : s.module })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filters.module === s.module
                    ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800'
                    : ''
                } ${MODULE_BADGE[s.module]}`}
              >
                {MODULE_LABELS[s.module]}
                <span className="font-bold">{s.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filters.module}
            onChange={e => setFilters({ module: e.target.value as any })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none"
          >
            <option value="">Semua Module</option>
            {Object.entries(MODULE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={filters.branch_id}
            onChange={e => setFilters({ branch_id: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none"
          >
            <option value="">Semua Cabang</option>
            {branches.map(b => (
              <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
            ))}
          </select>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => setFilters({ date_from: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none"
            placeholder="Dari tanggal"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={e => setFilters({ date_to: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none"
            placeholder="Sampai tanggal"
          />
          {hasFilters && (
            <button onClick={resetFilters} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-2.5 flex items-center justify-between">
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {selectedIds.size} record dipilih ({MODULE_LABELS[selectedModule!]})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Batal Pilih
            </button>
            <button
              onClick={handleBulkPost}
              className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Post Selected ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <CheckCircle2 className="w-12 h-12 mb-3 text-green-400 opacity-60" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Semua transaksi sudah ter-posting</p>
            <p className="text-xs text-gray-400 mt-1">Tidak ada record yang pending</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <SelectAllCheckbox
                    records={records}
                    selectedIds={selectedIds}
                    isMixedModule={isMixedModule}
                    onSelectAll={handleSelectAll}
                    onClearAll={clearSelection}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Module</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                {isMultiCompany && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Company</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cabang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Jumlah</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {records.map(record => (
                <tr key={`${record.module}-${record.id}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(record.id)}
                      onChange={() => handleCheckRow(record)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${MODULE_BADGE[record.module]}`}>
                      {MODULE_LABELS[record.module]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {record.ref_number}
                  </td>
                  {isMultiCompany && (
                    <td className="px-4 py-3 text-xs text-gray-500">{record.company_name ?? '-'}</td>
                  )}
                  <td className="px-4 py-3 text-xs text-gray-500">{record.branch_name ?? '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{record.transaction_date}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                    {record.amount > 0 ? formatCurrency(record.amount) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {record.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handlePostSingle(record)}
                        disabled={postSingle.isPending}
                        className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
                        title="Post Journal"
                      >
                        Post
                      </button>
                      <button
                        onClick={() => handleOpenDetail(record)}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Buka detail"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700/60 px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {pagination.total} item &bull; Halaman {pagination.page} dari {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPage(filters.page - 1)}
              className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Prev
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(filters.page + 1)}
              className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Confirm Single Post Modal */}
      <ConfirmModal
        isOpen={!!confirmTarget}
        title="Konfirmasi Post Journal"
        message={confirmTarget
          ? `Post journal untuk:\n\nModule: ${MODULE_LABELS[confirmTarget.module]}\nReference: ${confirmTarget.ref_number}\nJumlah: ${formatCurrency(confirmTarget.amount)}`
          : ''}
        confirmLabel="Post"
        isLoading={postSingle.isPending}
        onConfirm={confirmPostSingle}
        onCancel={() => setConfirmTarget(null)}
      />

      {/* Confirm Bulk Post Modal */}
      <ConfirmModal
        isOpen={showBulkConfirm}
        title="Konfirmasi Bulk Post"
        message={`Post ${selectedIds.size} record dari module ${selectedModule ? MODULE_LABELS[selectedModule] : ''}?`}
        confirmLabel={`Post ${selectedIds.size} Record`}
        isLoading={postBulk.isPending}
        onConfirm={confirmBulkPost}
        onCancel={() => setShowBulkConfirm(false)}
      />

      {/* Bulk Result Modal */}
      <BulkResultModal
        isOpen={!!bulkResult}
        result={bulkResult}
        onClose={() => setBulkResult(null)}
      />
    </div>
  )
}
