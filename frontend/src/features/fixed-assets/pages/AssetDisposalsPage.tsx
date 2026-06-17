import { useState, useMemo } from 'react'
import { Trash2, Plus, Loader2, Send, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  useDisposals,
  useCreateDisposal,
  usePostDisposal,
  useAssets,
  type AssetDisposal,
  type DisposalMethod,
  type CreateDisposalDto,
} from '../api/fixed-assets.api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

function DisposalStatusBadge({ status }: { status: 'DRAFT' | 'POSTED' }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
    POSTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

function DisposalMethodBadge({ method }: { method: DisposalMethod }) {
  const labels: Record<DisposalMethod, string> = {
    SOLD: 'Dijual',
    SCRAPPED: 'Dibuang',
    DONATED: 'Didonasikan',
  }
  return (
    <span className="text-sm text-gray-700 dark:text-gray-300">{labels[method]}</span>
  )
}

// ─── Create Disposal Modal ────────────────────────────────────────────────────

interface CreateDisposalModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function CreateDisposalModal({ isOpen, onClose, onSuccess }: CreateDisposalModalProps) {
  const toast = useToast()
  const createMutation = useCreateDisposal()

  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [disposalMethod, setDisposalMethod] = useState<DisposalMethod>('SOLD')
  const [proceedsAmount, setProceedsAmount] = useState('')
  const [disposalDate, setDisposalDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  // Fetch only ACTIVE/MAINTENANCE assets for selection
  const { data: assetsData, isLoading: assetsLoading } = useAssets({
    limit: 200,
    status: '' as never, // we'll filter client-side
  })

  const eligibleAssets = useMemo(() => {
    if (!assetsData?.data) return []
    return assetsData.data.filter(
      (a) => a.status === 'ACTIVE' || a.status === 'MAINTENANCE'
    )
  }, [assetsData])

  const selectedAsset = useMemo(
    () => eligibleAssets.find((a) => a.id === selectedAssetId),
    [eligibleAssets, selectedAssetId]
  )

  // Gain/Loss preview calculation
  const gainLossPreview = useMemo(() => {
    if (!selectedAsset) return null
    const proceeds = parseFloat(proceedsAmount) || 0
    const bookValue = selectedAsset.cost - selectedAsset.accumulated_depreciation
    const gainLoss = proceeds - bookValue
    return { bookValue, gainLoss, proceeds }
  }, [selectedAsset, proceedsAmount])

  const resetForm = () => {
    setSelectedAssetId('')
    setDisposalMethod('SOLD')
    setProceedsAmount('')
    setDisposalDate(new Date().toISOString().split('T')[0])
    setNotes('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssetId) {
      toast.error('Pilih aset yang akan didisposisi')
      return
    }

    const body: CreateDisposalDto = {
      fixed_asset_id: selectedAssetId,
      disposal_date: disposalDate,
      disposal_method: disposalMethod,
      proceeds_amount: parseFloat(proceedsAmount) || 0,
    }
    if (notes.trim()) body.notes = notes.trim()

    try {
      await createMutation.mutateAsync(body)
      toast.success('Disposisi berhasil dibuat')
      resetForm()
      onSuccess()
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membuat disposisi'))
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-disposal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 id="create-disposal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Buat Disposisi Aset
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Asset Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Aset <span className="text-red-500">*</span>
            </label>
            {assetsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat aset...
              </div>
            ) : (
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                required
              >
                <option value="">Pilih aset (ACTIVE/MAINTENANCE)...</option>
                {eligibleAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_code} - {a.asset_name} ({a.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Disposal Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Metode Disposisi <span className="text-red-500">*</span>
            </label>
            <select
              value={disposalMethod}
              onChange={(e) => setDisposalMethod(e.target.value as DisposalMethod)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
            >
              <option value="SOLD">Dijual (SOLD)</option>
              <option value="SCRAPPED">Dibuang (SCRAPPED)</option>
              <option value="DONATED">Didonasikan (DONATED)</option>
            </select>
          </div>

          {/* Proceeds Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nilai Hasil Penjualan
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={proceedsAmount}
              onChange={(e) => setProceedsAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
            />
          </div>

          {/* Disposal Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tanggal Disposisi <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={disposalDate}
              onChange={(e) => setDisposalDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Catatan
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Catatan tambahan..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Gain/Loss Preview */}
          {selectedAsset && gainLossPreview && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Preview Gain/Loss</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Harga Perolehan:</span>
                <span className="text-right font-medium text-gray-900 dark:text-white">{fmtCurrency(selectedAsset.cost)}</span>
                <span className="text-gray-600 dark:text-gray-400">Akum. Penyusutan:</span>
                <span className="text-right font-medium text-gray-900 dark:text-white">{fmtCurrency(selectedAsset.accumulated_depreciation)}</span>
                <span className="text-gray-600 dark:text-gray-400">Nilai Buku:</span>
                <span className="text-right font-medium text-gray-900 dark:text-white">{fmtCurrency(gainLossPreview.bookValue)}</span>
                <span className="text-gray-600 dark:text-gray-400">Hasil Penjualan:</span>
                <span className="text-right font-medium text-gray-900 dark:text-white">{fmtCurrency(gainLossPreview.proceeds)}</span>
                <span className="text-gray-600 dark:text-gray-400 font-semibold">
                  {gainLossPreview.gainLoss >= 0 ? 'Gain:' : 'Loss:'}
                </span>
                <span className={`text-right font-bold ${gainLossPreview.gainLoss >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {fmtCurrency(Math.abs(gainLossPreview.gainLoss))}
                  {gainLossPreview.gainLoss >= 0 ? ' (Untung)' : ' (Rugi)'}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !selectedAssetId}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Buat Draft
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function AssetDisposalsPage() {
  const toast = useToast()

  // ─── State ──────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'DRAFT' | 'POSTED' | ''>('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [postTarget, setPostTarget] = useState<AssetDisposal | null>(null)

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: disposalsData, isLoading, refetch } = useDisposals({
    page,
    limit: 25,
    status: statusFilter || undefined,
  })
  const disposals = disposalsData?.data ?? []
  const pagination = disposalsData?.pagination

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const postMutation = usePostDisposal()

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const openPostModal = (disposal: AssetDisposal) => {
    setPostTarget(disposal)
    setPostModalOpen(true)
  }

  const handlePost = async () => {
    if (!postTarget) return
    try {
      await postMutation.mutateAsync(postTarget.id)
      toast.success('Disposisi berhasil diposting. Jurnal telah dibuat.')
      setPostModalOpen(false)
      setPostTarget(null)
      refetch()
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal posting disposisi'))
      setPostModalOpen(false)
    }
  }

  const handleCreateSuccess = () => {
    setCreateModalOpen(false)
    refetch()
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Disposisi Aset
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Kelola pelepasan dan penghapusan aset tetap
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Buat Disposisi
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-3">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
          >
            <option value="">Semua</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : disposals.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Belum ada data disposisi aset.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-750">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kode Aset</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama Aset</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Metode</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hasil</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nilai Buku</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gain/Loss</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {disposals.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                          {d.asset_code ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {d.asset_name ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {fmtDate(d.disposal_date)}
                        </td>
                        <td className="px-4 py-3">
                          <DisposalMethodBadge method={d.disposal_method} />
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                          {fmtCurrency(d.proceeds_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                          {fmtCurrency(d.book_value_at_disposal)}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${d.gain_loss_amount >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          {d.gain_loss_amount >= 0 ? '+' : ''}{fmtCurrency(d.gain_loss_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <DisposalStatusBadge status={d.status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {d.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => openPostModal(d)}
                              disabled={postMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Post
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <Pagination
                    pagination={pagination}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Disposal Modal */}
      <CreateDisposalModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Post Confirmation Modal */}
      <ConfirmModal
        isOpen={postModalOpen}
        onClose={() => { setPostModalOpen(false); setPostTarget(null) }}
        onConfirm={handlePost}
        title="Posting Disposisi"
        message={
          postTarget ? (
            <div className="space-y-2">
              <p>Anda akan memposting disposisi untuk aset <strong>{postTarget.asset_name ?? postTarget.fixed_asset_id}</strong>.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Jurnal akan dibuat secara otomatis dan status aset akan berubah menjadi DISPOSED.
              </p>
              {postTarget.gain_loss_amount !== 0 && (
                <p className="text-sm font-medium">
                  {postTarget.gain_loss_amount > 0
                    ? `Gain: ${fmtCurrency(postTarget.gain_loss_amount)}`
                    : `Loss: ${fmtCurrency(Math.abs(postTarget.gain_loss_amount))}`
                  }
                </p>
              )}
            </div>
          ) : ''
        }
        confirmText="Posting"
        variant="success"
        isLoading={postMutation.isPending}
      />
    </div>
  )
}
