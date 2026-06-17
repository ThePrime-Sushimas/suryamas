import { useState } from 'react'
import { Calculator, RefreshCw, Play, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  useDepreciationRuns,
  usePreviewDepreciation,
  useConfirmDepreciation,
  useReverseDepreciation,
  type DepreciationPreviewEntry,
  type DepreciationRunStatus,
  type DepreciationRun,
} from '../api/fixed-assets.api'
import { fiscalPeriodsApi } from '@/features/accounting/fiscal-periods/api/fiscalPeriods.api'
import { useQuery } from '@tanstack/react-query'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

function StatusBadge({ status }: { status: DepreciationRunStatus }) {
  const styles: Record<DepreciationRunStatus, string> = {
    PREVIEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    POSTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    REVERSED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DepreciationRunPage() {
  const toast = useToast()

  // ─── State ──────────────────────────────────────────────────────────────────
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [previewEntries, setPreviewEntries] = useState<DepreciationPreviewEntry[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [reverseModalOpen, setReverseModalOpen] = useState(false)
  const [reverseTargetId, setReverseTargetId] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: periodsData } = useQuery({
    queryKey: ['fiscal-periods-open'],
    queryFn: async () => {
      const res = await fiscalPeriodsApi.list({ is_open: true, limit: 50 })
      return res.data
    },
    staleTime: 60_000,
  })
  const periods = periodsData ?? []

  const { data: runsData, isLoading: runsLoading, refetch: refetchRuns } = useDepreciationRuns({
    page: historyPage,
    limit: 15,
  })
  const runs = runsData?.data ?? []
  const runsPagination = runsData?.pagination

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const previewMutation = usePreviewDepreciation()
  const confirmMutation = useConfirmDepreciation()
  const reverseMutation = useReverseDepreciation()

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!selectedPeriodId) {
      toast.error('Pilih periode fiskal terlebih dahulu')
      return
    }
    try {
      const result = await previewMutation.mutateAsync({ fiscal_period_id: selectedPeriodId })
      setPreviewEntries(result.entries)
      setPreviewTotal(result.total_depreciation_amount)
      setShowPreview(true)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal preview penyusutan'))
    }
  }

  const handleConfirm = async () => {
    if (!selectedPeriodId) return
    try {
      await confirmMutation.mutateAsync({ fiscal_period_id: selectedPeriodId })
      toast.success('Penyusutan berhasil diposting')
      setShowPreview(false)
      setPreviewEntries([])
      setConfirmModalOpen(false)
      refetchRuns()
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal posting penyusutan'))
      setConfirmModalOpen(false)
    }
  }

  const handleReverse = async () => {
    if (!reverseTargetId) return
    try {
      await reverseMutation.mutateAsync(reverseTargetId)
      toast.success('Penyusutan berhasil di-reverse')
      setReverseModalOpen(false)
      setReverseTargetId(null)
      refetchRuns()
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal reverse penyusutan'))
      setReverseModalOpen(false)
    }
  }

  const openReverseModal = (run: DepreciationRun) => {
    setReverseTargetId(run.id)
    setReverseModalOpen(true)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <Calculator className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Penyusutan Aset
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Preview dan posting penyusutan bulanan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetchRuns()}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* ─── Action Area ──────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Run Penyusutan Baru
          </h2>

          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Periode Fiskal
              </label>
              <select
                value={selectedPeriodId}
                onChange={(e) => {
                  setSelectedPeriodId(e.target.value)
                  setShowPreview(false)
                  setPreviewEntries([])
                }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
              >
                <option value="">Pilih periode...</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period} ({fmtDate(p.period_start)} - {fmtDate(p.period_end)})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handlePreview}
              disabled={!selectedPeriodId || previewMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {previewMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Preview
            </button>

            {showPreview && previewEntries.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmModalOpen(true)}
                disabled={confirmMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Posting Jurnal
              </button>
            )}
          </div>

          {/* Preview Results Table */}
          {showPreview && (
            <div className="mt-6">
              {previewEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Calculator className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Tidak ada aset yang perlu disusutkan pada periode ini.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {previewEntries.length} aset &middot; Total: <span className="font-semibold text-gray-900 dark:text-white">{fmtCurrency(previewTotal)}</span>
                    </p>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-750">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kode Aset</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama Aset</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga Perolehan</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Akum. Sebelum</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Penyusutan</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Akum. Sesudah</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nilai Buku</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {previewEntries.map((entry) => (
                          <tr key={entry.fixed_asset_id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">{entry.asset_code}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{entry.asset_name}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{fmtCurrency(entry.cost)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{fmtCurrency(entry.accumulated_before)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-amber-700 dark:text-amber-400">{fmtCurrency(entry.depreciation_amount)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{fmtCurrency(entry.accumulated_after)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">{fmtCurrency(entry.book_value_after)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-gray-750">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white text-right">Total Penyusutan</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-amber-700 dark:text-amber-400">{fmtCurrency(previewTotal)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── History Area ─────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Riwayat Penyusutan
          </h2>

          {runsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Calculator className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Belum ada riwayat penyusutan.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-750">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Periode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal Run</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Jumlah Aset</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Penyusutan</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {runs.map((run) => (
                      <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {run.period_name ?? run.fiscal_period_id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {fmtDate(run.run_date)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={run.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                          {run.asset_count}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                          {fmtCurrency(run.total_depreciation_amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {run.status === 'POSTED' && (
                            <button
                              type="button"
                              onClick={() => openReverseModal(run)}
                              disabled={reverseMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {runsPagination && runsPagination.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    pagination={runsPagination}
                    onPageChange={setHistoryPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Confirm Modal ──────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirm}
        title="Posting Penyusutan"
        message={`Anda akan memposting penyusutan sebesar ${fmtCurrency(previewTotal)} untuk ${previewEntries.length} aset. Jurnal akan dibuat secara otomatis. Lanjutkan?`}
        confirmText="Posting"
        variant="success"
        isLoading={confirmMutation.isPending}
      />

      {/* ─── Reverse Confirm Modal ──────────────────────────────────────── */}
      <ConfirmModal
        isOpen={reverseModalOpen}
        onClose={() => { setReverseModalOpen(false); setReverseTargetId(null) }}
        onConfirm={handleReverse}
        title="Reverse Penyusutan"
        message="Anda akan melakukan reverse pada run penyusutan ini. Jurnal reversal akan dibuat dan akumulasi penyusutan aset akan dikembalikan. Lanjutkan?"
        confirmText="Reverse"
        variant="danger"
        isLoading={reverseMutation.isPending}
      />
    </div>
  )
}
